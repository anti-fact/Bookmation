import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { CLASSIFICATION_JOB_LEASE_MS, CLASSIFICATION_JOB_MAX_ATTEMPTS, DomainErrorCode } from "~/domain"
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
    now: 1_000,
  })
  return { bookmarkId, jobId }
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
      now,
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
      now: 1_000,
    })
    expect(claimed).toBeNull()
  })

  it("rejects claim when job is not pending", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    await layer.claimClassificationJob({ executorInstanceId: executorId, jobId, now: 1_000 })

    await expect(
      layer.claimClassificationJob({ executorInstanceId: uuid(), jobId, now: 2_000 }),
    ).rejects.toMatchObject({ code: DomainErrorCode.CLASSIFICATION_JOB_CLAIM_CONFLICT })
  })

  it("recovers expired running jobs back to pending", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    const claimTime = 1_000
    await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: claimTime,
    })

    const recovered = await layer.recoverStaleClassificationJobs(
      claimTime + CLASSIFICATION_JOB_LEASE_MS + 1,
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
      await layer.claimClassificationJob({ executorInstanceId: executorId, jobId, now })
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
      now,
    })

    const result = await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "FAILED",
      errorCode: "PROMPT_UNAVAILABLE",
      now: now + 1,
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
      now,
    })

    await expect(
      layer.applyClassificationResultShell({
        jobId,
        executorInstanceId: executorId,
        bookmarkRevision: claimed!.job.bookmarkRevision + 1,
        outcome: "SUCCEEDED",
        now: now + 1,
      }),
    ).rejects.toMatchObject({ code: DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED })
  })

  it("rejects apply when tagIds are provided (BE-08)", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    const now = 5_000
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now,
    })

    await expect(
      layer.applyClassificationResultShell({
        jobId,
        executorInstanceId: executorId,
        bookmarkRevision: claimed!.job.bookmarkRevision,
        outcome: "SUCCEEDED",
        tagIds: [uuid()],
        now: now + 1,
      }),
    ).rejects.toMatchObject({ code: DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED })
  })

  it("deduplicates succeeded fingerprint without creating duplicate edges", async () => {
    const { jobId: firstJobId, bookmarkId } = await seedPendingJob(layer)
    const firstJob = (await layer.getClassificationJob(firstJobId))!
    const executorId = uuid()

    const claimedFirst = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId: firstJobId,
      now: 2_000,
    })
    await layer.applyClassificationResultShell({
      jobId: firstJobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimedFirst!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      now: 2_500,
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
      updatedAt: 3_000,
    }
    await layer.rawDb.put(STORES.classificationJobs, duplicatePendingJob)

    const claimedSecond = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId: secondJobId,
      now: 4_000,
    })
    const deduped = await layer.applyClassificationResultShell({
      jobId: secondJobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimedSecond!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      now: 4_500,
    })

    expect(deduped.deduplicated).toBe(true)
    expect(deduped.job.state).toBe("SUCCEEDED")

    const edges = await layer.rawDb.getAll(STORES.bookmarkLabels)
    expect(edges.filter((edge) => edge.deletedAt === null && edge.bookmarkId === bookmarkId)).toHaveLength(0)
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
    const claimed = await layer.claimClassificationJob({ executorInstanceId: executorId, jobId, now })
    await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "FAILED",
      now: now + 1,
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
    await layer.updateBookmarkMetadata({
      bookmarkId,
      expectedRevision: 1,
      title: "Updated title",
    })

    const executorId = uuid()
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: 1_000,
    })

    expect(claimed?.job.bookmarkRevision).toBe(2)

    const applied = await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      now: 1_001,
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
      now: 1_000,
    })

    await layer.updateBookmarkMetadata({
      bookmarkId,
      expectedRevision: 1,
      title: "Changed after claim",
    })

    await expect(
      layer.applyClassificationResultShell({
        jobId,
        executorInstanceId: executorId,
        bookmarkRevision: claimed!.job.bookmarkRevision,
        outcome: "SUCCEEDED",
        now: 1_001,
      }),
    ).rejects.toMatchObject({ code: DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED })
  })

  it("is idempotent when applying to a terminal job", async () => {
    const { jobId } = await seedPendingJob(layer)
    const executorId = uuid()
    const now = 1_000
    const claimed = await layer.claimClassificationJob({ executorInstanceId: executorId, jobId, now })
    await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      now: now + 1,
    })

    const again = await layer.applyClassificationResultShell({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.job.bookmarkRevision,
      outcome: "SUCCEEDED",
      now: now + 2,
    })
    expect(again.deduplicated).toBe(true)
    expect(again.job.state).toBe("SUCCEEDED")
  })
})
