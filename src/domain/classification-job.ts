/**
 * ClassificationJob Domain エンティティ
 *
 * DB-SCHEMA.md §classification_jobs の型定義と不変条件バリデーター。
 * AI 分類ジョブと policy snapshot を管理する。
 *
 * 不変条件:
 * - granularity と maxNewTags の組み合わせは仕様で固定された 5 種のみ
 * - claim 後のジョブ policy は変更不可
 * - Job status の遷移は仕様通りのみ許可
 */
import type { Id, EpochMs, ClassificationState, ClassificationPolicySnapshot } from "./types"
import { DomainError, DomainErrorCode } from "./errors"

// ---------------------------------------------------------------------------
// ClassificationJobRecord 型定義
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Policy Snapshot 検証
// ---------------------------------------------------------------------------

/**
 * 許可された granularity + maxNewTags の組み合わせ。
 * 仕様で固定された 5 種のみ有効。
 */
const VALID_POLICY_COMBOS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 4],
  [4, 6],
] as const

/**
 * ClassificationPolicySnapshot の不変条件を検証する。
 * granularity と maxNewTags の組み合わせが仕様の 5 種に一致しなければエラー。
 */
export function assertClassificationPolicyValid(
  policy: ClassificationPolicySnapshot,
): void {
  const isValid = VALID_POLICY_COMBOS.some(
    ([g, m]) => g === policy.granularity && m === policy.maxNewTags,
  )
  if (!isValid) {
    throw new DomainError(
      DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
      `Invalid policy combination: granularity=${policy.granularity}, maxNewTags=${policy.maxNewTags}. ` +
      `Allowed: ${VALID_POLICY_COMBOS.map(([g, m]) => `(${g},${m})`).join(", ")}`,
    )
  }

  if (policy.policyVersion !== 1) {
    throw new DomainError(
      DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
      `policyVersion must be 1, got: ${policy.policyVersion}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Job 不変条件検証
// ---------------------------------------------------------------------------

/**
 * ClassificationJobRecord の不変条件を検証する。
 */
export function assertClassificationJobInvariants(record: ClassificationJobRecord): void {
  // policy snapshot 検証
  assertClassificationPolicyValid(record.policySnapshot)

  // state 整合性
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
    (record.state === "SUCCEEDED" || record.state === "FAILED" || record.state === "NEEDS_REVIEW" || record.state === "CANCELED") &&
    record.completedAt === null
  ) {
    throw new DomainError(
      DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
      `Job state=${record.state} requires completedAt to be set`,
    )
  }

  // retryCount は非負整数
  if (!Number.isInteger(record.retryCount) || record.retryCount < 0) {
    throw new DomainError(
      DomainErrorCode.INVALID_REVISION,
      `retryCount must be a non-negative integer: ${record.retryCount}`,
    )
  }
}

// ---------------------------------------------------------------------------
// State 遷移検証
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Readonly<Record<ClassificationState, ReadonlyArray<ClassificationState>>> = {
  PENDING: ["RUNNING", "CANCELED"],
  RUNNING: ["SUCCEEDED", "FAILED", "NEEDS_REVIEW", "CANCELED"],
  SUCCEEDED: [],
  FAILED: ["PENDING"], // retry
  NEEDS_REVIEW: ["PENDING"], // manual re-trigger
  CANCELED: [],
}

/**
 * ClassificationJob の状態遷移が有効かを確認する。
 */
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

// ---------------------------------------------------------------------------
// Policy from granularity
// ---------------------------------------------------------------------------

/**
 * granularity 値から対応する policyVersion=1 の snapshot を作成する。
 */
export function policyFromGranularity(granularity: 0 | 1 | 2 | 3 | 4): ClassificationPolicySnapshot {
  switch (granularity) {
    case 0: return { policyVersion: 1, granularity: 0, maxNewTags: 0 }
    case 1: return { policyVersion: 1, granularity: 1, maxNewTags: 1 }
    case 2: return { policyVersion: 1, granularity: 2, maxNewTags: 2 }
    case 3: return { policyVersion: 1, granularity: 3, maxNewTags: 4 }
    case 4: return { policyVersion: 1, granularity: 4, maxNewTags: 6 }
  }
}
