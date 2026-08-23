import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import {
  buildClassificationPromptInput,
  isPolicyV2,
  policyFromGranularity,
  validateClassificationModelResult,
} from "~/domain"
import { policyV2FromGranularity } from "~/evaluation/policy-v2"

function uuid(): string {
  return crypto.randomUUID()
}

describe("TASK-008 apply + evaluation consistency", () => {
  let dbName: string
  let layer: LocalDataLayer

  beforeEach(async () => {
    dbName = `bookmation-apply-${uuid()}`
    layer = await LocalDataLayer.open(dbName)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  it("Domain policyFromGranularity matches evaluation policyV2FromGranularity", () => {
    for (const g of [0, 1, 2, 3, 4] as const) {
      expect(policyFromGranularity(g)).toEqual(policyV2FromGranularity(g))
      expect(isPolicyV2(policyFromGranularity(g))).toBe(true)
    }
  })

  it("validates then applies CREATE and REUSE in one transaction", async () => {
    const bookmarkId = uuid()
    const jobId = uuid()
    const now = 1_000

    await layer.saveBookmarkWithJob({
      id: bookmarkId,
      rawUrl: `https://example.test/docs/vitest-${uuid()}`,
      title: "Vitest Unit Testing Guide",
      creationRequestId: uuid(),
      jobId,
      now,
      policy: policyFromGranularity(2),
    })

    const category = await layer.createCategory({
      id: "cat-tech",
      name: "Technology",
      creationRequestId: uuid(),
      now,
    })

    const existingTag = await layer.createTag({
      id: "tag-typescript",
      name: "TypeScript",
      parentCategoryId: category.id,
      expectedParentRevision: category.revision,
      creationRequestId: uuid(),
      now,
    })

    const executorId = uuid()
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: executorId,
      jobId,
      now: now + 1,
    })
    expect(claimed?.job.state).toBe("RUNNING")
    expect(isPolicyV2(claimed!.job.policy)).toBe(true)
    expect(claimed!.job.maxAssignedTags).toBe(0)

    const promptInput = buildClassificationPromptInput({
      policy: policyFromGranularity(2),
      bookmark: {
        title: "Vitest Unit Testing Guide",
        normalizedUrl: claimed!.bookmark.normalizedUrl,
      },
      categories: [
        { id: category.id, name: category.name, revision: category.revision },
      ],
      existingTags: [
        {
          id: existingTag.id,
          name: existingTag.name,
          origin: "USER",
          revision: existingTag.revision,
          parentCategoryId: category.id,
          parentCategoryRevision: category.revision,
        },
      ],
      retryContext: null,
    })

    const validated = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: category.id,
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "Vitest",
            importance: "CORE",
            evidenceText: "Vitest",
            confidence: 0.95,
          },
          {
            action: "REUSE",
            tagId: existingTag.id,
            importance: "MAJOR",
            evidenceText: "Testing",
            confidence: 0.8,
          },
          { invalid: true },
        ],
      },
      promptInput,
      snapshotTags: [
        {
          id: existingTag.id,
          name: existingTag.name,
          normalizedName: existingTag.normalizedName,
          origin: "USER",
          revision: existingTag.revision,
          parentCategoryId: category.id,
          parentCategoryRevision: category.revision,
          deletedAt: null,
        },
      ],
      policy: policyFromGranularity(2),
    })

    expect(validated.outcome).toBe("APPLIED")
    expect(validated.applicableCandidates).toHaveLength(2)

    const applied = await layer.applyValidatedClassificationResult({
      jobId,
      executorInstanceId: executorId,
      bookmarkRevision: claimed!.bookmark.revision,
      categoryId: validated.applicableCategoryId!,
      candidates: validated.applicableCandidates,
      now: now + 2,
    })

    expect(applied.job.state).toBe("SUCCEEDED")
    expect(applied.bookmark.classificationState).toBe("CLASSIFIED")
    expect(applied.createdTagIds).toHaveLength(1)
    expect(applied.appliedTagIds).toContain(existingTag.id)

    const created = await layer.getLabel(applied.createdTagIds[0]!)
    expect(created?.origin).toBe("AI")
    expect(created?.normalizedName).toBe("vitest")
    expect(created?.parentCategoryId).toBe(category.id)
  })
})
