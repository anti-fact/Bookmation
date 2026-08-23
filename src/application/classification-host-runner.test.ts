import { describe, expect, it, vi } from "vitest"
import { policyFromGranularity } from "~/domain"
import { runOneClassificationJob } from "./classification-host-runner"
import type { ClassificationProvider } from "~/ports/classification-provider"

describe("runOneClassificationJob", () => {
  it("applies validated CREATE from provider output", async () => {
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
              action: "CREATE",
              name: "Vitest",
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
          existingTags: [],
        }),
        applyValidated,
        applyTerminal,
      },
    })

    expect(result.status).toBe("APPLIED")
    expect(applyValidated).toHaveBeenCalledTimes(1)
    expect(applyTerminal).not.toHaveBeenCalled()
    const args = applyValidated.mock.calls[0]![0]
    expect(args.candidates[0].action).toBe("CREATE")
    expect(args.candidates[0].normalizedName).toBe("vitest")
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
