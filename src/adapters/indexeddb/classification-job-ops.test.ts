import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import {
  CLASSIFICATION_JOB_LEASE_MS,
  CLASSIFICATION_JOB_MAX_ATTEMPTS,
  DomainErrorCode
} from "~/domain"
import { STORES } from "~/adapters/indexeddb/stores"

function uuid(): string {
  return crypto.randomUUID()
}

function testDbName(): string {
  return `bookmation-job-test-${uuid()}`
}

async function seedPendingJob(layer: LocalDataLayer): Promise<{
  bookmarkId: string
  jobId: string
}> {
  const bookmarkId = uuid()
  const jobId = uuid()
  await layer.saveBookmarkWithJob({
    id: bookmarkId,
    rawUrl: `https://example.com/${uuid()}`,
    title: "Job test",
    creationRequestId: uuid(),
    jobId,
    now: 1_000
  })
  return { bookmarkId, jobId }
}

async function seedTag(
  layer: LocalDataLayer,
  input: { categoryName?: string; tagName?: string } = {}
) {
  const category = await layer.createCategory({
    id: uuid(),
    name: input.categoryName ?? "Development",
    creationRequestId: uuid()
  })
  const tag = await layer.createTag({
    id: uuid(),
    name: input.tagName ?? "TypeScript",
    parentCategoryId: category.id,
    expectedParentRevision: category.revision,
    creationRequestId: uuid()
  })
  return { category, tag }
}

describe("classification job ops", () => {
  let dbName: string
  let layer: LocalDataLayer

  beforeEach(async () => {
    dbName = testDbName()
    layer = await LocalDataLayer.open(dbName)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  it("claims a pending job and records lease metadata", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    const now = 10_000

    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now
    })

    expect(claimed).not.toBeNull()
    expect(claimed?.job.state).toBe("RUNNING")
    expect(claimed?.job.attempt).toBe(1)
    expect(claimed?.job.executorInstanceId).toBe(executorId)
    expect(claimed?.job.leaseExpiresAt).toBe(now + CLASSIFICATION_JOB_LEASE_MS)
    expect(claimed?.bookmark.classificationState).toBe("PENDING")
  })

  it("returns null when no pending jobs exist", async () => {
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: uuid(),
      now: 1_000
    })
    expect(claimed).toBeNull()
  })

  it("rejects claim when job is not pending", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: 1_000
    })

    await expect(
      layer.claimClassificationJob({
        executorInstanceId: uuid(),
        jobId,
        now: 2_000
      })
    ).rejects.toMatchObject({
      code: DomainErrorCode.CLASSIFICATION_JOB_CLAIM_CONFLICT
    })
  })

  it("recovers expired running jobs back to pending", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    const claimTime = 1_000
    await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: claimTime
    })

    const recovered = await layer.recoverStaleClassificationJobs(
      claimTime + CLASSIFICATION_JOB_LEASE_MS + 1
    )
    expect(recovered).toBe(1)

    const job = await layer.getClassificationJob(jobId)
    expect(job?.state).toBe("PENDING")
    expect(job?.leaseExpiresAt).toBeNull()
    expect(job?.executorInstanceId).toBeNull()
    expect(job?.attempt).toBe(1)
  })

  it("marks job failed after max attempts on lease expiry", async () => {
    const { jobId, bookmarkId } = await seedPendingJob(layer)
    const executorId = uuid()
    let now = 1_000

    for (let round = 0; round < CLASSIFICATION_JOB_MAX_ATTEMPTS; round += 1) {
      await layer.claimClassificationJob({
        executorInstanceId: executorId,
        jobId,
        now
      })
      now += CLASSIFICATION_JOB_LEASE_MS + 1
      await layer.recoverStaleClassificationJobs(now)
    }

    const job = await layer.getClassificationJob(jobId)
    expect(job?.state).toBe("FAILED")
    expect(job?.errorCode).toBe("MAX_ATTEMPTS_EXCEEDED")

    const bookmark = await layer.getBookmark(bookmarkId)
    expect(bookmark?.classificationState).toBe("FAILED")
  })

  it("applies failed outcome and syncs bookmark state", async () => {
    const { jobId, bookmarkId } = await seedPendingJob(layer)
    const executorId = uuid()
    const now = 5_000
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now
    })

    const result = await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "FAILED",
      errorCode: "PROMPT_UNAVAILABLE",
      now: now + 1
    })

    expect(result.job.state).toBe("FAILED")
    expect(result.bookmark.classificationState).toBe("FAILED")
    const bookmark = await layer.getBookmark(bookmarkId)
    expect(bookmark?.classificationState).toBe("FAILED")
  })

  it("rejects apply with stale bookmark revision", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    const now = 5_000
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now
    })

    await expect(
      layer.applyClassificationResultShell({
        jobId,
        executorInstanceId: executorId,
        bookmarkRevision: claimed!.job.bookmarkRevision + 1,
        outcome: "SUCCEEDED",
        now: now + 1
      })
    ).rejects.toMatchObject({
      code: DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED
    })
  })

  it("applies active AI tags and their derived category atomically", async () => {
    const { bookmarkId, jobId } = await seedPendingJob(layer)
    const { category, tag } = await seedTag(layer)
    const executorId = uuid()
    const now = 5_000
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now
    })

    const result = await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [tag.id],
      now: now + 1
    })

    expect(result.job.state).toBe("SUCCEEDED")
    expect(result.bookmark.classificationState).toBe("CLASSIFIED")
    expect(result.bookmark.revision).toBe(claimed!.bookmark.revision + 1)
    expect(
      (await layer.listBookmarksByLabel(tag.id, null)).items.map(
        (bookmark) => bookmark.id
      )
    ).toEqual([bookmarkId])
    expect(
      (await layer.listBookmarksByLabel(category.id, null)).items.map(
        (bookmark) => bookmark.id
      )
    ).toEqual([bookmarkId])
    expect(
      (await layer.rawDb.getAll(STORES.bookmarkLabels)).find(
        (edge) => edge.bookmarkId === bookmarkId && edge.labelId === tag.id
      )
    ).toMatchObject({ assignedBy: "AI", classificationJobId: jobId })
    expect(await layer.rawDb.getAll(STORES.bookmarkRevisions)).toContainEqual(
      expect.objectContaining({
        actor: "AI",
        after: expect.objectContaining({ tagIds: [tag.id] }),
        reason: "AI_CLASSIFICATION"
      })
    )
  })

  it("rejects tags from multiple categories", async () => {
    const { jobId } = await seedPendingJob(layer)
    const first = await seedTag(layer)
    const second = await seedTag(layer, {
      categoryName: "Reading",
      tagName: "Reference"
    })
    const executorId = uuid()
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: 5_000
    })

    await expect(
      layer.applyClassificationResultShell({
        jobId,
        executorInstanceId: executorId,
        bookmarkRevision: claimed!.job.bookmarkRevision,
        outcome: "SUCCEEDED",
        tagIds: [first.tag.id, second.tag.id],
        now: 5_001
      })
    ).rejects.toMatchObject({
      code: DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED
    })
  })

  it("replaces prior AI tags while preserving manually assigned tags", async () => {
    const { bookmarkId, jobId } = await seedPendingJob(layer)
    const { category, tag: firstAiTag } = await seedTag(layer, {
      tagName: "TypeScript"
    })
    const manualTag = await layer.createTag({
      id: uuid(),
      name: "Manual",
      parentCategoryId: category.id,
      expectedParentRevision: category.revision,
      creationRequestId: uuid()
    })
    const secondAiTag = await layer.createTag({
      id: uuid(),
      name: "React",
      parentCategoryId: category.id,
      expectedParentRevision: category.revision,
      creationRequestId: uuid()
    })
    const initialBookmark = (await layer.getBookmark(bookmarkId))!
    await layer.assignTagEdge({
      bookmarkId,
      expectedBookmarkRevision: initialBookmark.revision,
      tagId: manualTag.id,
      assignedBy: "USER"
    })

    const executorId = uuid()
    const firstClaim = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: 2_000
    })
    await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: firstClaim!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [firstAiTag.id],
      now: 2_001
    })

    const firstJob = (await layer.getClassificationJob(jobId))!
    const replacementJobId = uuid()
    await layer.rawDb.put(STORES.classificationJobs, {
      ...firstJob,
      id: replacementJobId,
      requestId: uuid(),
      inputFingerprint: uuid(),
      state: "PENDING",
      attempt: 0,
      executorInstanceId: null,
      leaseExpiresAt: null,
      executionContext: null,
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      createdAt: 3_000,
      updatedAt: 3_000
    })
    const secondClaim = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId: replacementJobId,
      now: 4_000
    })
    await layer.applyClassificationResultShell({
      jobId: replacementJobId,
      executorInstanceId: executorId,
      bookmarkRevision: secondClaim!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [secondAiTag.id],
      now: 4_001
    })

    const activeEdges = (
      await layer.rawDb.getAll(STORES.bookmarkLabels)
    ).filter(
      (edge) => edge.bookmarkId === bookmarkId && edge.deletedAt === null
    )
    expect(activeEdges.map((edge) => edge.labelId)).toEqual(
      expect.arrayContaining([category.id, manualTag.id, secondAiTag.id])
    )
    expect(activeEdges.map((edge) => edge.labelId)).not.toContain(firstAiTag.id)
    expect(
      activeEdges.find((edge) => edge.labelId === manualTag.id)
    ).toMatchObject({ assignedBy: "USER" })
    expect(
      activeEdges.find((edge) => edge.labelId === secondAiTag.id)
    ).toMatchObject({
      assignedBy: "AI",
      classificationJobId: replacementJobId
    })
  })

  it("deduplicates succeeded fingerprint without creating duplicate edges", async () => {
    const { jobId: firstJobId, bookmarkId } = await seedPendingJob(layer)
    const { tag } = await seedTag(layer)
    const firstJob = (await layer.getClassificationJob(firstJobId))!
    const executorId = uuid()

    const claimedFirst = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId: firstJobId,
      now: 2_000
    })
    await layer.applyClassificationResultShell({
      jobId: firstJobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimedFirst!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [tag.id],
      now: 2_500
    })

    const secondJobId = uuid()
    const duplicatePendingJob = {
      ...firstJob,
      id: secondJobId,
      requestId: uuid(),
      state: "PENDING" as const,
      attempt: 0,
      executorInstanceId: null,
      leaseExpiresAt: null,
      executionContext: null,
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      createdAt: 3_000,
      updatedAt: 3_000
    }
    await layer.rawDb.put(STORES.classificationJobs, duplicatePendingJob)

    const claimedSecond = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId: secondJobId,
      now: 4_000
    })
    const deduped = await layer.applyClassificationResultShell({
      jobId: secondJobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimedSecond!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [tag.id],
      now: 4_500
    })

    expect(deduped.deduplicated).toBe(true)
    expect(deduped.job.state).toBe("SUCCEEDED")

    const edges = await layer.rawDb.getAll(STORES.bookmarkLabels)
    expect(
      edges.filter(
        (edge) =>
          edge.deletedAt === null &&
          edge.bookmarkId === bookmarkId &&
          edge.labelId === tag.id
      )
    ).toHaveLength(1)
  })

  it("cancels pending jobs", async () => {
    const { jobId, bookmarkId } = await seedPendingJob(layer)
    const canceled = await layer.cancelClassificationJob(jobId, 9_000)
    expect(canceled.state).toBe("CANCELED")
    const bookmark = await layer.getBookmark(bookmarkId)
    expect(bookmark?.classificationState).toBe("UNCLASSIFIED")
  })

  it("retries failed jobs back to pending", async () => {
    const { jobId, bookmarkId } = await seedPendingJob(layer)
    const executorId = uuid()
    const now = 1_000
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now
    })
    await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "FAILED",
      now: now + 1
    })

    const retried = await layer.retryClassificationJob(jobId, now + 2)
    expect(retried.state).toBe("PENDING")
    const bookmark = await layer.getBookmark(bookmarkId)
    expect(bookmark?.classificationState).toBe("PENDING")
  })

  it("returns latest job for bookmark", async () => {
    const { bookmarkId, jobId } = await seedPendingJob(layer)
    const latest = await layer.getLatestClassificationJobForBookmark(bookmarkId)
    expect(latest?.id).toBe(jobId)
  })

  it("claims with current bookmark revision after metadata update", async () => {
    const { jobId, bookmarkId } = await seedPendingJob(layer)
    const { tag } = await seedTag(layer)
    await layer.updateBookmarkMetadata({
      bookmarkId,
      expectedRevision: 1,
      title: "Updated title"
    })

    const executorId = uuid()
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: 1_000
    })

    expect(claimed?.job.bookmarkRevision).toBe(2)

    const applied = await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [tag.id],
      now: 1_001
    })

    expect(applied.job.state).toBe("SUCCEEDED")
    expect(applied.bookmark.classificationState).toBe("CLASSIFIED")
  })

  it("rejects apply when bookmark revision changed after claim", async () => {
    const { jobId, bookmarkId } = await seedPendingJob(layer)
    const executorId = uuid()
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: 1_000
    })

    await layer.updateBookmarkMetadata({
      bookmarkId,
      expectedRevision: 1,
      title: "Changed after claim"
    })

    await expect(
      layer.applyClassificationResultShell({
        jobId,
        executorInstanceId: executorId,
        bookmarkRevision: claimed!.job.bookmarkRevision,
        outcome: "SUCCEEDED",
        now: 1_001
      })
    ).rejects.toMatchObject({
      code: DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED
    })
  })

  it("is idempotent when applying to a terminal job", async () => {
    const { jobId } = await seedPendingJob(layer)
    const { tag } = await seedTag(layer)
    const executorId = uuid()
    const now = 1_000
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now
    })
    await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [tag.id],
      now: now + 1
    })

    const again = await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      tagIds: [tag.id],
      now: now + 2
    })
    expect(again.deduplicated).toBe(true)
    expect(again.job.state).toBe("SUCCEEDED")
  })
})
