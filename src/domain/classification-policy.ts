/**
 * Classification policy version 2（AI_GUIDE 正本）
 * evaluation と本番が同じ snapshot を共有する。
 */
import type {
  AiGranularity,
  ClassificationPolicySnapshot,
  ClassificationPolicySnapshotV1,
  ClassificationPolicySnapshotV2,
  TagImportance,
} from "./types"
import { DomainError, DomainErrorCode } from "./errors"

const VALID_V1: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 4],
  [4, 6],
]

/**
 * 細分化度から現行正本の policy version 2 snapshot を作る。
 */
export function policyFromGranularity(
  granularity: AiGranularity,
): ClassificationPolicySnapshotV2 {
  switch (granularity) {
    case 0:
      return {
        policyVersion: 2,
        granularity: 0,
        reusePolicy: "STRONG_REUSE",
        allowedCreateImportance: ["CORE"],
      }
    case 1:
      return {
        policyVersion: 2,
        granularity: 1,
        reusePolicy: "PREFER_REUSE",
        allowedCreateImportance: ["CORE"],
      }
    case 2:
      return {
        policyVersion: 2,
        granularity: 2,
        reusePolicy: "BALANCED",
        allowedCreateImportance: ["CORE", "MAJOR"],
      }
    case 3:
      return {
        policyVersion: 2,
        granularity: 3,
        reusePolicy: "NEAR_EXACT_REUSE",
        allowedCreateImportance: ["CORE", "MAJOR", "SUPPORTING"],
      }
    case 4:
      return {
        policyVersion: 2,
        granularity: 4,
        reusePolicy: "EXACT_EQUIVALENT_REUSE",
        allowedCreateImportance: ["CORE", "MAJOR", "SUPPORTING", "DETAIL"],
      }
  }
}

/** 履歴・移行テスト用。新規 Job では使わない。 */
export function policyV1FromGranularity(
  granularity: AiGranularity,
): ClassificationPolicySnapshotV1 {
  switch (granularity) {
    case 0:
      return { policyVersion: 1, granularity: 0, maxNewTags: 0 }
    case 1:
      return { policyVersion: 1, granularity: 1, maxNewTags: 1 }
    case 2:
      return { policyVersion: 1, granularity: 2, maxNewTags: 2 }
    case 3:
      return { policyVersion: 1, granularity: 3, maxNewTags: 4 }
    case 4:
      return { policyVersion: 1, granularity: 4, maxNewTags: 6 }
  }
}

export function isPolicyV2(
  policy: ClassificationPolicySnapshot,
): policy is ClassificationPolicySnapshotV2 {
  return policy.policyVersion === 2
}

export function isCreateImportanceAllowed(
  policy: ClassificationPolicySnapshotV2,
  importance: TagImportance,
): boolean {
  return (policy.allowedCreateImportance as readonly string[]).includes(
    importance,
  )
}

/**
 * Job に埋め込まれた policy snapshot の不変条件。
 * v1 履歴と v2 正本の両方を受け入れる。
 */
export function assertClassificationPolicyValid(
  policy: ClassificationPolicySnapshot,
): void {
  if (policy.policyVersion === 1) {
    const ok = VALID_V1.some(
      ([g, m]) => g === policy.granularity && m === policy.maxNewTags,
    )
    if (!ok) {
      throw new DomainError(
        DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
        `Invalid v1 policy: granularity=${policy.granularity}, maxNewTags=${policy.maxNewTags}`,
      )
    }
    return
  }

  if (policy.policyVersion === 2) {
    const expected = policyFromGranularity(policy.granularity)
    if (
      policy.reusePolicy !== expected.reusePolicy ||
      policy.allowedCreateImportance.length !==
        expected.allowedCreateImportance.length ||
      policy.allowedCreateImportance.some(
        (v, i) => v !== expected.allowedCreateImportance[i],
      )
    ) {
      throw new DomainError(
        DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
        `Invalid v2 policy fields for granularity=${policy.granularity}`,
      )
    }
    return
  }

  throw new DomainError(
    DomainErrorCode.CLASSIFICATION_POLICY_INVALID,
    `Unsupported policyVersion`,
  )
}
