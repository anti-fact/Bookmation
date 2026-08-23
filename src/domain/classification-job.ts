/**
 * ClassificationJob Domain エンティティ（簡略型・状態遷移）
 * policy 検証は classification-policy.ts を正本とする。
 */
import type { Id, EpochMs, ClassificationState, ClassificationPolicySnapshot } from "./types"
import { DomainError, DomainErrorCode } from "./errors"
import { assertClassificationPolicyValid } from "./classification-policy"

export {
  assertClassificationPolicyValid,
  policyFromGranularity,
  policyV1FromGranularity,
  isPolicyV2,
  isCreateImportanceAllowed,
} from "./classification-policy"

/** @deprecated BE-01 簡略型。永続 Job は PersistedClassificationJobRecord を正本とする。 */
export interface ClassificationJobRecord {
  readonly schemaVersion: number
  readonly id: Id
  readonly bookmarkId: Id
  readonly triggeredBy: "BOOKMARK_SAVED" | "TAG_DELETED" | "CATEGORY_DELETED" | "MANUAL"
  readonly policySnapshot: ClassificationPolicySnapshot
  readonly state: ClassificationState
  readonly startedAt: EpochMs | null
  readonly completedAt: EpochMs | null
  readonly errorCode: string | null
  readonly errorMessage: string | null
  readonly retryCount: number
  readonly createdAt: EpochMs
  readonly updatedAt: EpochMs
  readonly revision: number
}

export function assertClassificationJobInvariants(record: ClassificationJobRecord): void {
  assertClassificationPolicyValid(record.policySnapshot)

  if (
    (record.state === "RUNNING" || record.state === "SUCCEEDED" || record.state === "FAILED") &&
    record.startedAt === null
  ) {
    throw new DomainError(
      DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
      `Job state=${record.state} requires startedAt to be set`,
    )
  }

  if (
    (record.state === "SUCCEEDED" ||
      record.state === "FAILED" ||
      record.state === "NEEDS_REVIEW" ||
      record.state === "CANCELED") &&
    record.completedAt === null
  ) {
    throw new DomainError(
      DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
      `Job state=${record.state} requires completedAt to be set`,
    )
  }

  if (!Number.isInteger(record.retryCount) || record.retryCount < 0) {
    throw new DomainError(
      DomainErrorCode.INVALID_REVISION,
      `retryCount must be a non-negative integer: ${record.retryCount}`,
    )
  }
}

const VALID_TRANSITIONS: Readonly<
  Record<ClassificationState, ReadonlyArray<ClassificationState>>
> = {
  PENDING: ["RUNNING", "CANCELED"],
  RUNNING: ["SUCCEEDED", "FAILED", "NEEDS_REVIEW", "CANCELED", "PENDING"],
  SUCCEEDED: [],
  FAILED: ["PENDING"],
  NEEDS_REVIEW: ["PENDING"],
  CANCELED: [],
}

export function assertValidStateTransition(
  from: ClassificationState,
  to: ClassificationState,
): void {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new DomainError(
      DomainErrorCode.BOOKMARK_CLASSIFICATION_STATE_INVALID_TRANSITION,
      `Invalid state transition: ${from} → ${to}. Allowed: ${allowed.join(", ")}`,
    )
  }
}
