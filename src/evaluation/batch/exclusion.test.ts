import { describe, expect, it } from "vitest"
import {
  assignSampleIndexes,
  canExcludeAndReplenish,
  SampleBudgetError,
} from "./exclusion"
import type { EvaluationRunResultV1 } from "../types"
import { policyV2FromGranularity } from "../policy-v2"

const env = {
  chromeVersion: "test",
  operatingSystem: "test",
  locale: "en-US",
  promptApiState: "AVAILABLE" as const,
  providerModel: null,
}

function included(runSequence: number, runId: string): EvaluationRunResultV1 {
  return {
    runId,
    fixtureId: "f",
    granularity: 0,
    runSequence,
    policy: policyV2FromGranularity(0),
    environment: env,
    executionAttempt: 1,
    disposition: "INCLUDED",
    sampleIndex: 0,
    exclusionPhase: null,
    exclusionReason: null,
    modelAttempt: 1,
    attempts: [
      {
        attemptId: "a1",
        ordinal: 1,
        dispatchReserved: true,
        finalPhase: "CLOSED",
        responseDisposition: "ENVELOPE_VALID",
        outcome: "APPLIED",
        rawCandidateCount: 0,
        modelDecisionCategoryId: "c",
        modelDecisionCandidates: [],
        candidateSchemaInvalidIndexes: [],
        applicableCategoryId: "c",
        applicableCandidates: [
          {
            sourceIndex: 0,
            action: "CREATE",
            name: "x",
            normalizedName: "x",
            importance: "CORE",
          },
        ],
        diagnosticReasonCodes: [],
      },
    ],
    finalJobState: "SUCCEEDED",
    terminalReasonCode: "APPLIED",
    committed: null,
  }
}

function excluded(runSequence: number, runId: string): EvaluationRunResultV1 {
  return {
    runId,
    fixtureId: "f",
    granularity: 0,
    runSequence,
    policy: policyV2FromGranularity(0),
    environment: env,
    executionAttempt: 0,
    disposition: "EXCLUDED",
    sampleIndex: null,
    exclusionPhase: "BEFORE_CLAIM",
    exclusionReason: "MODEL_NOT_READY_BEFORE_FIRST_DISPATCH",
    modelAttempt: 0,
    attempts: [],
    finalJobState: null,
    terminalReasonCode: null,
    committed: null,
  }
}

describe("evaluation exclusion and N=10 sampling", () => {
  it("allows only pre-dispatch environment exclusions", () => {
    expect(
      canExcludeAndReplenish({
        modelAttempt: 0,
        dispatchReservedCommitted: false,
        modelResponseReceived: false,
        phase: "PREPARED",
        reason: "AI_HOST_LOST_BEFORE_FIRST_DISPATCH",
      }),
    ).toBe(true)

    expect(
      canExcludeAndReplenish({
        modelAttempt: 0,
        dispatchReservedCommitted: true,
        modelResponseReceived: false,
        phase: "PREPARED",
        reason: "AI_HOST_LOST_BEFORE_FIRST_DISPATCH",
      }),
    ).toBe(false)
  })

  it("assigns sampleIndex 1..10 skipping exclusions and rejects overflow", () => {
    const runs = [
      excluded(1, "e1"),
      ...Array.from({ length: 10 }, (_, i) => included(i + 2, `i${i}`)),
    ]
    const assigned = assignSampleIndexes(runs)
    expect(assigned.filter((r) => r.disposition === "INCLUDED").map((r) => r.sampleIndex)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])

    expect(() =>
      assignSampleIndexes([
        ...runs,
        included(12, "extra"),
      ]),
    ).toThrow(SampleBudgetError)
  })
})
