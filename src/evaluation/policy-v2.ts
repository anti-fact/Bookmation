/**
 * policy version 2 snapshots（評価・prompt 注入用。Domain v1 とは分離）
 */
import type { ClassificationPolicySnapshotV2, Granularity } from "./types"

export function policyV2FromGranularity(
  granularity: Granularity,
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

export function allowedCreateImportances(
  policy: ClassificationPolicySnapshotV2,
): ReadonlySet<string> {
  return new Set(policy.allowedCreateImportance)
}
