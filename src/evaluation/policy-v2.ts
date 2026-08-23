/**
 * policy version 2 — Domain 正本を評価から再エクスポート（二重定義禁止）
 */
export { policyFromGranularity as policyV2FromGranularity } from "~/domain"
export type { ClassificationPolicySnapshotV2 } from "~/domain"

import type { ClassificationPolicySnapshotV2 } from "~/domain"

export function allowedCreateImportances(
  policy: ClassificationPolicySnapshotV2,
): ReadonlySet<string> {
  return new Set(policy.allowedCreateImportance)
}
