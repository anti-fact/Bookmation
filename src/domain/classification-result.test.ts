/**
 * classification-result validator と evaluation 契約の整合
 */
import { describe, expect, it } from "vitest"
import {
  buildClassificationPromptInput,
  policyFromGranularity,
  resolveDispatchBudgetTerminal,
  validateClassificationModelResult,
  type SnapshotTag,
} from "~/domain"

function basePrompt(categoryId = "cat-tech") {
  return buildClassificationPromptInput({
    policy: policyFromGranularity(2),
    bookmark: {
      title: "Vitest Unit Testing Guide",
      normalizedUrl: "https://example.test/docs/vitest-guide",
    },
    categories: [{ id: categoryId, name: "Technology", revision: 1 }],
    existingTags: [
      {
        id: "tag-typescript",
        name: "TypeScript",
        origin: "USER",
        revision: 1,
        parentCategoryId: categoryId,
        parentCategoryRevision: 1,
      },
      {
        id: "tag-outside",
        name: "Lifestyle Tag",
        origin: "USER",
        revision: 1,
        parentCategoryId: "cat-life",
        parentCategoryRevision: 1,
      },
    ],
    retryContext: null,
  })
}

function snapshotTags(): SnapshotTag[] {
  return [
    {
      id: "tag-typescript",
      name: "TypeScript",
      normalizedName: "typescript",
      origin: "USER",
      revision: 1,
      parentCategoryId: "cat-tech",
      parentCategoryRevision: 1,
      deletedAt: null,
    },
    {
      id: "tag-outside",
      name: "Lifestyle Tag",
      normalizedName: "lifestyle tag",
      origin: "USER",
      revision: 1,
      parentCategoryId: "cat-life",
      parentCategoryRevision: 1,
      deletedAt: null,
    },
  ]
}

describe("validateClassificationModelResult", () => {
  it("accepts mixed valid/invalid candidates and keeps all valid", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "Vitest",
            importance: "CORE",
            evidenceText: "Vitest",
            confidence: 0.9,
          },
          { broken: true },
          {
            action: "REUSE",
            tagId: "tag-typescript",
            importance: "CORE",
            evidenceText: "Testing",
            confidence: 0.8,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })

    expect(result.outcome).toBe("APPLIED")
    expect(result.candidateSchemaInvalidIndexes).toEqual([1])
    expect(result.applicableCandidates).toHaveLength(2)
    expect(result.acceptedCount).toBe(2)
    expect(result.rejectedCount).toBeGreaterThanOrEqual(1)
  })

  it("rejects Category-outside REUSE and canonicalizes same-name CREATE to REUSE", () => {
    const outsideReuse = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "REUSE",
            tagId: "tag-outside",
            importance: "CORE",
            evidenceText: "Vitest",
            confidence: 1,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(outsideReuse.outcome).toBe("ZERO_VALID")
    expect(outsideReuse.diagnosticReasonCodes).toContain("REUSE_PARENT_MISMATCH")

    const createToReuse = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "TypeScript",
            importance: "MAJOR",
            evidenceText: "Vitest",
            confidence: 1,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(createToReuse.outcome).toBe("APPLIED")
    expect(createToReuse.applicableCandidates[0]).toMatchObject({
      action: "REUSE",
      tagId: "tag-typescript",
    })
  })

  it("treats NEEDS_REVIEW envelope as GLOBAL_INVALID quality-zero", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "NEEDS_REVIEW",
        categoryId: "UNASSIGNED",
        tagDecisions: [],
        reviewReasonCode: "AMBIGUOUS",
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("GLOBAL_INVALID")
    expect(result.diagnosticReasonCodes).toContain("MODEL_NEEDS_REVIEW")
  })

  it("rejects DETAIL CREATE at granularity 2", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "matchAll",
            importance: "DETAIL",
            evidenceText: "Vitest",
            confidence: 1,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("ZERO_VALID")
    expect(result.diagnosticReasonCodes).toContain("IMPORTANCE_NOT_ALLOWED")
  })

  it("normalizes numeric-string confidence to number", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "Vitest",
            importance: "CORE",
            evidenceText: "Vitest",
            confidence: "0.85",
          },
          {
            action: "REUSE",
            tagId: "tag-typescript",
            importance: "MAJOR",
            evidenceText: "Testing",
            confidence: "0.7",
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("APPLIED")
    expect(result.candidateSchemaInvalidIndexes).toEqual([])
    expect(result.applicableCandidates).toHaveLength(2)
    expect(result.applicableCandidates[0]).toMatchObject({
      action: "CREATE",
      confidence: 0.85,
    })
    expect(result.applicableCandidates[1]).toMatchObject({
      action: "REUSE",
      confidence: 0.7,
    })
  })

  it("rejects non-numeric confidence strings", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "Vitest",
            importance: "CORE",
            evidenceText: "Vitest",
            confidence: "high",
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("ZERO_VALID")
    expect(result.candidateSchemaInvalidIndexes).toEqual([0])
    expect(result.diagnosticReasonCodes).toContain("CANDIDATE_SCHEMA_INVALID")
  })

  it("matches evidenceText case-insensitively for ASCII", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "Vitest",
            importance: "CORE",
            evidenceText: "vitest",
            confidence: 0.9,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("APPLIED")
    expect(result.diagnosticReasonCodes).not.toContain("EVIDENCE_INVALID")
  })

  it("accepts REUSE even when evidenceText is a Tag name absent from title/url", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "REUSE",
            tagId: "tag-typescript",
            importance: "CORE",
            evidenceText: "コンテンツ",
            confidence: 0.8,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("APPLIED")
    expect(result.diagnosticReasonCodes).not.toContain("EVIDENCE_INVALID")
    expect(result.acceptedCount).toBe(1)
  })

  it("rejects CREATE when evidenceText is absent from title/url", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "CREATE",
            name: "コンテンツ",
            importance: "CORE",
            evidenceText: "コンテンツ",
            confidence: 0.8,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      allowAiCreateTags: true,
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("ZERO_VALID")
    expect(result.diagnosticReasonCodes).toContain("EVIDENCE_INVALID")
  })

  it("rejects empty evidenceText on REUSE", () => {
    const result = validateClassificationModelResult({
      raw: {
        outcome: "CLASSIFIED",
        categoryId: "cat-tech",
        reviewReasonCode: "NONE",
        tagDecisions: [
          {
            action: "REUSE",
            tagId: "tag-typescript",
            importance: "CORE",
            evidenceText: "",
            confidence: 0.8,
          },
        ],
      },
      promptInput: basePrompt(),
      snapshotTags: snapshotTags(),
      policy: policyFromGranularity(2),
    })
    expect(result.outcome).toBe("ZERO_VALID")
    expect(result.diagnosticReasonCodes).toContain("EVIDENCE_INVALID")
  })

  it("resolves dispatch budget terminal like evaluation", () => {
    expect(
      resolveDispatchBudgetTerminal([
        "GLOBAL_INVALID",
        "ZERO_VALID",
        "GLOBAL_INVALID",
      ]),
    ).toBe("NEEDS_REVIEW")
    expect(
      resolveDispatchBudgetTerminal([
        "GLOBAL_INVALID",
        "TECHNICAL_FAILURE",
        "ZERO_VALID",
      ]),
    ).toBe("FAILED")
    expect(resolveDispatchBudgetTerminal(["APPLIED", "ZERO_VALID"])).toBe(null)
  })
})
