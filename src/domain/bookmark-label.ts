/**
 * BookmarkLabel (edge) Domain エンティティ
 *
 * DB-SCHEMA.md §bookmark_labels の型定義と不変条件バリデーター。
 * Bookmark と Label を結ぶ M:N edge。
 */
import type { Id, EpochMs, EntityOrigin, LabelKind } from "./types"
import { DomainError, DomainErrorCode } from "./errors"

// ---------------------------------------------------------------------------
// BookmarkLabelRecord 型定義
// ---------------------------------------------------------------------------

export interface BookmarkLabelRecord {
  readonly schemaVersion: number
  readonly id: Id
  readonly bookmarkId: Id
  readonly labelId: Id
  readonly labelKind: LabelKind
  /**
   * AI が割り当てた場合の信頼スコア (0 〜 1)。
   * USER / IMPORT が割り当てた場合は null。
   */
  readonly confidence: number | null
  readonly origin: EntityOrigin
  readonly createdAt: EpochMs
  readonly updatedAt: EpochMs
  readonly revision: number
}

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

/**
 * BookmarkLabelRecord の不変条件を検証する。
 * - confidence は AI 割当時のみ 0〜1。それ以外は null。
 * - CATEGORY edge は直接作成・編集を拒否。
 */
export function assertBookmarkLabelInvariants(record: BookmarkLabelRecord): void {
  // AI 以外は confidence=null
  if (record.origin !== "AI") {
    if (record.confidence !== null) {
      throw new DomainError(
        DomainErrorCode.INVALID_JSON_VALUE,
        `confidence must be null for origin=${record.origin}, got: ${record.confidence}`,
      )
    }
  } else {
    // AI は confidence が 0〜1
    if (record.confidence === null) {
      throw new DomainError(
        DomainErrorCode.INVALID_JSON_VALUE,
        `confidence must be 0-1 for AI origin, got null`,
      )
    }
    if (typeof record.confidence !== "number" || record.confidence < 0 || record.confidence > 1) {
      throw new DomainError(
        DomainErrorCode.INVALID_JSON_VALUE,
        `confidence must be 0-1 for AI origin, got: ${record.confidence}`,
      )
    }
  }
}

/**
 * CATEGORY edge の直接作成・更新を拒否する。
 * Bookmark の Category edge は Tag の parentCategoryId から自動導出する。
 */
export function assertNoCategoryEdgeDirectMutation(kind: LabelKind): void {
  if (kind === "CATEGORY") {
    throw new DomainError(
      DomainErrorCode.BOOKMARK_CATEGORY_DIRECT_UPDATE_REJECTED,
      "CATEGORY BookmarkLabel edge must be derived from TAG parent, not created/modified directly",
    )
  }
}

// ---------------------------------------------------------------------------
// 重複チェック
// ---------------------------------------------------------------------------

/**
 * 同じ (bookmarkId, labelId) のペアが既存 edge と競合しないかを確認する。
 */
export function assertNoBookmarkLabelDuplicate(
  bookmarkId: Id,
  labelId: Id,
  existingEdges: readonly Pick<BookmarkLabelRecord, "bookmarkId" | "labelId">[],
): void {
  const conflict = existingEdges.some(
    (e) => e.bookmarkId === bookmarkId && e.labelId === labelId,
  )
  if (conflict) {
    throw new DomainError(
      DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
      `BookmarkLabel edge (${bookmarkId}, ${labelId}) already exists`,
    )
  }
}
