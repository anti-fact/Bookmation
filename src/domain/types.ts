/**
 * Domain 共通型
 *
 * DB-SCHEMA.md §共通型 および §各エンティティ型 に基づき、
 * UI・DB・AIのどの入口でも共有する最小プリミティブ型のみを定義する。
 * 実装詳細・Chrome API・外部ライブラリへの依存は持たない。
 */

// ---------------------------------------------------------------------------
// プリミティブ型エイリアス
// ---------------------------------------------------------------------------

/** UUID等の衝突しにくい文字列 ID */
export type Id = string

/** UTC Epoch milliseconds */
export type EpochMs = number

// ---------------------------------------------------------------------------
// Enum ユニオン型
// ---------------------------------------------------------------------------

/** エンティティの作成元 */
export type EntityOrigin = "USER" | "AI" | "IMPORT" | "SHARE"

/** Label の種別 — カテゴリ(親) または タグ(子) */
export type LabelKind = "CATEGORY" | "TAG"

/** ブックマークの表示状態 */
export type ArchiveState = "ACTIVE" | "ARCHIVED"

/** AI 分類ジョブの状態 */
export type ClassificationState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "NEEDS_REVIEW"
  | "CANCELED"

/** 訪問集計期間 */
export type FrequentVisitWindow =
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "LAST_365_DAYS"

// ---------------------------------------------------------------------------
// JSON 互換型
// ---------------------------------------------------------------------------

/**
 * JSON として安全にシリアライズできる値の型。
 * undefined・Function・BigInt・循環参照・非有限数を含まない。
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

// ---------------------------------------------------------------------------
// 共通 Envelope
// ---------------------------------------------------------------------------

/**
 * Blob 以外の全永続ドキュメントが満たす共通 Envelope。
 * `schemaVersion` で schema 変更を追跡し、型注釈だけで信用しない。
 */
export interface JsonDocumentEnvelope {
  readonly schemaVersion: number
  readonly id: Id
  readonly createdAt: EpochMs
  readonly updatedAt: EpochMs
}

// ---------------------------------------------------------------------------
// 分類ポリシースナップショット
// ---------------------------------------------------------------------------

export type TagImportance = "CORE" | "MAJOR" | "SUPPORTING" | "DETAIL"

export type AiGranularity = 0 | 1 | 2 | 3 | 4

/**
 * AI 分類 Job に埋め込む policy snapshot。
 * 現行正本は policyVersion 2（reusePolicy + allowedCreateImportance）。
 * version 1（maxNewTags）は端末履歴・移行監査用に型として残す。
 */
export type ClassificationPolicySnapshotV1 =
  | { readonly policyVersion: 1; readonly granularity: 0; readonly maxNewTags: 0 }
  | { readonly policyVersion: 1; readonly granularity: 1; readonly maxNewTags: 1 }
  | { readonly policyVersion: 1; readonly granularity: 2; readonly maxNewTags: 2 }
  | { readonly policyVersion: 1; readonly granularity: 3; readonly maxNewTags: 4 }
  | { readonly policyVersion: 1; readonly granularity: 4; readonly maxNewTags: 6 }

export type ClassificationPolicySnapshotV2 =
  | {
      readonly policyVersion: 2
      readonly granularity: 0
      readonly reusePolicy: "STRONG_REUSE"
      readonly allowedCreateImportance: readonly ["CORE"]
    }
  | {
      readonly policyVersion: 2
      readonly granularity: 1
      readonly reusePolicy: "PREFER_REUSE"
      readonly allowedCreateImportance: readonly ["CORE"]
    }
  | {
      readonly policyVersion: 2
      readonly granularity: 2
      readonly reusePolicy: "BALANCED"
      readonly allowedCreateImportance: readonly ["CORE", "MAJOR"]
    }
  | {
      readonly policyVersion: 2
      readonly granularity: 3
      readonly reusePolicy: "NEAR_EXACT_REUSE"
      readonly allowedCreateImportance: readonly ["CORE", "MAJOR", "SUPPORTING"]
    }
  | {
      readonly policyVersion: 2
      readonly granularity: 4
      readonly reusePolicy: "EXACT_EQUIVALENT_REUSE"
      readonly allowedCreateImportance: readonly [
        "CORE",
        "MAJOR",
        "SUPPORTING",
        "DETAIL",
      ]
    }

export type ClassificationPolicySnapshot =
  | ClassificationPolicySnapshotV1
  | ClassificationPolicySnapshotV2

// ---------------------------------------------------------------------------
// UpdateTag コマンド型（Domain 層で検証する入力）
// ---------------------------------------------------------------------------

/**
 * Tag の名前および親 Category を更新するコマンド。
 * requestId は必ず `tag-update:` prefix を持つ冪等キー。
 */
export interface UpdateTagCommand {
  readonly tagId: Id
  readonly expectedTagRevision: number
  readonly name: string
  readonly parentCategoryId: Id
  readonly expectedParentRevision: number
  readonly requestId: `tag-update:${string}`
}
