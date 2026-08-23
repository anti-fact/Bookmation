import { describe, expect, it, vi } from "vitest"
import { policyFromGranularity } from "~/domain"
import { runOneClassificationJob } from "./classification-host-runner"
import type { ClassificationProvider } from "~/ports/classification-provider"

describe("runOneClassificationJob", () => {
  it("applies validated USER Tag REUSE from provider output", async () => {
    const provider: ClassificationProvider = {
      capability: vi.fn().mockResolvedValue({
        state: "AVAILABLE",
        providerModel: "mock",
      }),
      classify: vi.fn().mockResolvedValue({
        rawText: "{}",
        parsed: {
          outcome: "CLASSIFIED",
          categoryId: "cat-tech",
          reviewReasonCode: "NONE",
          tagDecisions: [
            {
              action: "REUSE",
              tagId: "tag-typescript",
              importance: "CORE",
              evidenceText: "Vitest",
              confidence: 0.9,
            },
          ],
        },
      }),
    }

    const applyValidated = vi.fn().mockResolvedValue(undefined)
    const applyTerminal = vi.fn().mockResolvedValue(undefined)

    const result = await runOneClassificationJob({
      provider,
      ports: {
        claim: async () => ({
          jobId: "job-1",
          executorInstanceId: "exec-1",
          bookmarkRevision: 1,
          bookmarkTitle: "Vitest Unit Testing Guide",
          bookmarkNormalizedUrl: "https://example.test/docs/vitest-guide",
          policy: policyFromGranularity(2),
          categories: [{ id: "cat-tech", name: "Technology", revision: 1 }],
          existingTags: [
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
          ],
        }),
        applyValidated,
        applyTerminal,
      },
    })

    expect(result.status).toBe("APPLIED")
    expect(applyValidated).toHaveBeenCalledTimes(1)
    expect(applyTerminal).not.toHaveBeenCalled()
    const args = applyValidated.mock.calls[0]![0]
    expect(args.candidates[0].action).toBe("REUSE")
    expect(args.candidates[0].tagId).toBe("tag-typescript")
    if (result.status === "APPLIED") {
      expect(result.debug.validation.outcome).toBe("APPLIED")
      expect(result.debug.parsed).toMatchObject({ outcome: "CLASSIFIED" })
      expect(result.debug.bookmark).toEqual({
        title: "Vitest Unit Testing Guide",
        normalizedUrl: "https://example.test/docs/vitest-guide",
      })
    }
  })

  it("rejects AI CREATE under production defaults", async () => {
    const applyValidated = vi.fn()
    const applyTerminal = vi.fn().mockResolvedValue(undefined)
    const result = await runOneClassificationJob({
      provider: {
        capability: vi.fn().mockResolvedValue({
          state: "AVAILABLE",
          providerModel: "mock",
        }),
        classify: vi.fn().mockResolvedValue({
          rawText: "{}",
          parsed: {
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
            ],
          },
        }),
      },
      ports: {
        claim: async () => ({
          jobId: "job-create",
          executorInstanceId: "exec-1",
          bookmarkRevision: 1,
          bookmarkTitle: "Vitest Unit Testing Guide",
          bookmarkNormalizedUrl: "https://example.test/docs/vitest-guide",
          policy: policyFromGranularity(2),
          categories: [{ id: "cat-tech", name: "Technology", revision: 1 }],
          existingTags: [],
        }),
        applyValidated,
        applyTerminal,
      },
    })

    expect(result.status).toBe("TERMINAL")
    expect(applyValidated).not.toHaveBeenCalled()
    expect(applyTerminal).toHaveBeenCalled()
    if (result.status === "TERMINAL") {
      expect(result.errorCode).toBe("IMPORTANCE_NOT_ALLOWED")
    }
  })

  it("includes model response debug on CANDIDATE_SCHEMA_INVALID terminal", async () => {
    const result = await runOneClassificationJob({
      provider: {
        capability: vi.fn().mockResolvedValue({
          state: "AVAILABLE",
          providerModel: "mock",
        }),
        classify: vi.fn().mockResolvedValue({
          rawText: '{"outcome":"CLASSIFIED","tagDecisions":[{"action":"CREATE","name":"X"}]}',
          parsed: {
            outcome: "CLASSIFIED",
            categoryId: "cat-tech",
            reviewReasonCode: "NONE",
            tagDecisions: [
              {
                action: "CREATE",
                name: "X",
                importance: "CORE",
                evidenceText: "X",
                confidence: "not-a-number",
              },
            ],
          },
        }),
      },
      ports: {
        claim: async () => ({
          jobId: "job-2",
          executorInstanceId: "exec-1",
          bookmarkRevision: 1,
          bookmarkTitle: "X guide",
          bookmarkNormalizedUrl: "https://example.test/x",
          policy: policyFromGranularity(2),
          categories: [{ id: "cat-tech", name: "Technology", revision: 1 }],
          existingTags: [],
        }),
        applyValidated: vi.fn(),
        applyTerminal: vi.fn(),
      },
    })

    expect(result.status).toBe("TERMINAL")
    if (result.status === "TERMINAL") {
      expect(result.errorCode).toBe("CANDIDATE_SCHEMA_INVALID")
      expect(result.debug).not.toBeNull()
      expect(result.debug!.validation.candidateSchemaInvalidIndexes).toEqual([0])
    }
  })

  it("skips claim when Prompt API is unavailable", async () => {
    const claim = vi.fn()
    const result = await runOneClassificationJob({
      provider: {
        capability: async () => ({ state: "UNAVAILABLE", providerModel: null }),
        classify: vi.fn(),
      },
      ports: {
        claim,
        applyValidated: vi.fn(),
        applyTerminal: vi.fn(),
      },
    })
    expect(result.status).toBe("SKIPPED_UNAVAILABLE")
    expect(claim).not.toHaveBeenCalled()
  })
})
