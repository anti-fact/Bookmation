import { describe, expect, it } from "vitest"
import {
  materializeAttemptFromScript,
  scriptedProvider,
} from "./fake-provider"
import { emptyPromptMeta } from "../prompt-input"
import { policyV2FromGranularity } from "../policy-v2"

const baseInput = {
  ...emptyPromptMeta(),
  policy: policyV2FromGranularity(2),
  bookmark: { title: "t", normalizedUrl: "https://example.test/x" },
  categories: [{ id: "cat", name: "Cat", revision: 1, tags: [] }],
  existingTags: [],
  retryContext: null,
}

describe("fake provider control paths", () => {
  it("records mixed valid/invalid candidates without partial success semantics", () => {
    const { attempt } = materializeAttemptFromScript({
      attemptId: "a1",
      ordinal: 1,
      script: {
        kind: "CLASSIFIED",
        categoryId: "cat",
        tagDecisions: [
          {
            action: "CREATE",
            name: "good",
            importance: "CORE",
            evidenceText: "t",
            confidence: 1,
          },
          { action: "REUSE" }, // invalid
          {
            action: "CREATE",
            name: "also",
            importance: "MAJOR",
            evidenceText: "t",
            confidence: 0.5,
          },
        ],
        validDecisionIndexes: [0, 2],
        applicable: [
          {
            sourceIndex: 0,
            action: "CREATE",
            name: "good",
            normalizedName: "good",
            importance: "CORE",
          },
          {
            sourceIndex: 2,
            action: "CREATE",
            name: "also",
            normalizedName: "also",
            importance: "MAJOR",
          },
        ],
      },
    })
    expect(attempt.responseDisposition).toBe("ENVELOPE_VALID")
    expect(attempt.candidateSchemaInvalidIndexes).toEqual([1])
    expect(attempt.modelDecisionCandidates.map((c) => c.sourceIndex)).toEqual([
      0, 2,
    ])
    expect(attempt.applicableCandidates).toHaveLength(2)
    expect(attempt.outcome).toBe("APPLIED")
  })

  it("maps timeout/truncated/process loss to TECHNICAL_FAILURE", () => {
    for (const code of [
      "MODEL_TIMEOUT",
      "MODEL_RESPONSE_TRUNCATED",
      "MODEL_RESULT_LOST",
    ] as const) {
      const { attempt } = materializeAttemptFromScript({
        attemptId: "a",
        ordinal: 1,
        script: { kind: "TECHNICAL_FAILURE", code },
      })
      expect(attempt.outcome).toBe("TECHNICAL_FAILURE")
      expect(attempt.diagnosticReasonCodes).toContain(code)
    }
  })

  it("rejects late response without accepting it as APPLIED", () => {
    const { attempt, lateRejected } = materializeAttemptFromScript({
      attemptId: "a",
      ordinal: 1,
      script: {
        kind: "LATE_RESPONSE",
        categoryId: "cat",
        tagDecisions: [],
      },
      acceptLate: false,
    })
    expect(lateRejected).toBe(true)
    expect(attempt.outcome).toBe("TECHNICAL_FAILURE")
  })

  it("records DB rollback without COMMITTED semantics", () => {
    const { attempt, rolledBack } = materializeAttemptFromScript({
      attemptId: "a",
      ordinal: 1,
      script: {
        kind: "DB_ROLLBACK",
        categoryId: "cat",
        applicable: [
          {
            sourceIndex: 0,
            action: "CREATE",
            name: "x",
            normalizedName: "x",
            importance: "CORE",
          },
        ],
      },
    })
    expect(rolledBack).toBe(true)
    expect(attempt.outcome).toBe("TECHNICAL_FAILURE")
  })

  it("scripts three quality-zero outcomes for NEEDS_REVIEW path", () => {
    const provider = scriptedProvider([
      { kind: "NEEDS_REVIEW", reviewReasonCode: "AMBIGUOUS" },
      { kind: "JSON_INVALID", rawText: "{" },
      { kind: "NEEDS_REVIEW", reviewReasonCode: "AMBIGUOUS" },
    ])
    const outcomes = [1, 2, 3].map((ordinal) => {
      const script = provider.next(baseInput)
      return materializeAttemptFromScript({
        attemptId: `a${ordinal}`,
        ordinal: ordinal as 1 | 2 | 3,
        script,
      }).attempt.outcome
    })
    expect(outcomes.every((o) => o === "GLOBAL_INVALID")).toBe(true)
  })
})
