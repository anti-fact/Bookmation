/**
 * 初回 dispatch 前だけの環境除外 allowlist と N=10 補充規則
 */
import type {
  EvaluationExclusionReasonV1,
  EvaluationRunResultV1,
  Granularity,
} from "../types"
import { EVAL_SAMPLE_SIZE } from "../types"

export const ENVIRONMENT_EXCLUSION_REASONS: ReadonlySet<EvaluationExclusionReasonV1> =
  new Set([
    "DEVICE_UNSUPPORTED",
    "PROMPT_API_UNAVAILABLE_BEFORE_FIRST_DISPATCH",
    "MODEL_NOT_READY_BEFORE_FIRST_DISPATCH",
    "AI_HOST_LOST_BEFORE_FIRST_DISPATCH",
    "HARNESS_FAILURE_BEFORE_FIRST_DISPATCH",
  ])

export type ExclusionPhase = "BEFORE_CLAIM" | "PREPARED"

export interface ExclusionEligibility {
  modelAttempt: number
  dispatchReservedCommitted: boolean
  modelResponseReceived: boolean
  phase: ExclusionPhase
  reason: EvaluationExclusionReasonV1
}

/**
 * 補充できるのは modelAttempt=0、DISPATCH_RESERVED 未commit、応答未受信、
 * allowlist 理由、BEFORE_CLAIM / PREPARED のみ。
 */
export function canExcludeAndReplenish(input: ExclusionEligibility): boolean {
  if (input.modelAttempt !== 0) return false
  if (input.dispatchReservedCommitted) return false
  if (input.modelResponseReceived) return false
  if (!ENVIRONMENT_EXCLUSION_REASONS.has(input.reason)) return false
  if (input.phase !== "BEFORE_CLAIM" && input.phase !== "PREPARED") return false
  return true
}

export class SampleBudgetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SampleBudgetError"
  }
}

/**
 * runSequence 順の最初の非除外 N 件だけを sampleIndex 1..N とする。
 * 10 件到達後の追加を拒否する。
 */
export function assignSampleIndexes(
  runsInSequence: EvaluationRunResultV1[],
): EvaluationRunResultV1[] {
  let nextSample = 1
  const out: EvaluationRunResultV1[] = []
  for (const run of runsInSequence) {
    if (run.disposition === "EXCLUDED") {
      out.push({ ...run, sampleIndex: null })
      continue
    }
    if (nextSample > EVAL_SAMPLE_SIZE) {
      throw new SampleBudgetError(
        `cell already has ${EVAL_SAMPLE_SIZE} included samples; refusing additional run ${run.runId}`,
      )
    }
    out.push({ ...run, sampleIndex: nextSample })
    nextSample += 1
  }
  if (nextSample <= EVAL_SAMPLE_SIZE) {
    throw new SampleBudgetError(
      `cell has only ${nextSample - 1} included samples; need ${EVAL_SAMPLE_SIZE}`,
    )
  }
  return out
}

export function cellKey(fixtureId: string, granularity: Granularity): string {
  return `${fixtureId}|${granularity}`
}
