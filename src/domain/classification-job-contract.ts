import type { ClassificationState } from "./types"

/** AI Host が Job を独占する lease 期間（ms）。 */
export const CLASSIFICATION_JOB_LEASE_MS = 300_000

/** lease 回収後に claim できる最大 attempt 数。 */
export const CLASSIFICATION_JOB_MAX_ATTEMPTS = 3

export type ClassificationApplyOutcome = Extract<
  ClassificationState,
  "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW" | "CANCELED"
>

/** BE-08 Tag 作成冪等用の安定 requestId。 */
export function proposalCreationRequestId(jobId: string, proposalKey: string): string {
  return `${jobId}:${proposalKey}`
}
