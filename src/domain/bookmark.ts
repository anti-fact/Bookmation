/**
 * Bookmark Domain エンティティ
 *
 * DB-SCHEMA.md §bookmarks の型定義と不変条件バリデーター。
 * ActiveBookmarkRecord と ArchivedBookmarkRecord の 2 形式を持つ。
 */
import type { Id, EpochMs, ArchiveState, ClassificationState } from "./types"
import { DomainError, DomainErrorCode } from "./errors"

// ---------------------------------------------------------------------------
// Bookmark レコード型定義
// ---------------------------------------------------------------------------

export type BookmarkSource =
  | "CURRENT_TAB"
  | "MANUAL_URL"
  | "VISIT_REMINDER"
  | "CONTEXT_PAGE"
  | "CONTEXT_LINK"
  | "CHROME_IMPORT"
  | "QR_IMPORT"

export type BookmarkClassificationState =
  | "UNCLASSIFIED"
  | "PENDING"
  | "CLASSIFIED"
  | "NEEDS_REVIEW"
  | "FAILED"

export interface ActiveBookmarkRecord {
  readonly schemaVersion: number
  readonly id: Id
  readonly archiveState: "ACTIVE"
  readonly rawUrl: string
  readonly normalizedUrl: string
  readonly urlHash: string
  readonly urlNormalizationVersion: number
  readonly title: string
  readonly siteName: string | null
  readonly faviconUrl: string | null
  readonly faviconBlobId: Id | null
  readonly thumbnailBlobId: Id | null
  readonly classificationState: BookmarkClassificationState
  readonly source: BookmarkSource
  readonly savedAt: EpochMs
  readonly updatedAt: EpochMs
  readonly lastVisitedAt: EpochMs | null
  readonly revision: number
  readonly deletedAt: EpochMs | null
}

export interface ArchivedBookmarkPayload {
  readonly title: string
  readonly url: string
  readonly categories: ReadonlyArray<{
    readonly categoryId: Id
    readonly name: string
  }>
  readonly tags: ReadonlyArray<{
    readonly tagId: Id
    readonly name: string
    readonly parentCategoryId: Id
  }>
}

export interface ArchivedBookmarkRecord {
  readonly id: Id
  readonly archiveState: "ARCHIVED"
  readonly metadata: {
    readonly schemaVersion: number
  }
  readonly payload: ArchivedBookmarkPayload
}

export type BookmarkRecord = ActiveBookmarkRecord | ArchivedBookmarkRecord

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

/**
 * ActiveBookmarkRecord の基本不変条件を検証する。
 * - deletedAt: 論理削除時のみ有効
 * - classificationState: 有効な値
 * - source: 有効な値
 */
export function assertActiveBookmarkInvariants(record: ActiveBookmarkRecord): void {
  if (record.archiveState !== "ACTIVE") {
    throw new DomainError(
      DomainErrorCode.BOOKMARK_CLASSIFICATION_STATE_INVALID_TRANSITION,
      `Expected archiveState=ACTIVE, got: ${record.archiveState}`,
    )
  }
}

/**
 * Bookmark の Category edge 直接更新を拒否する。
 * Bookmark は Tag の parentCategoryId から Category を自動導出する設計のため、
 * Category edge を直接受け付けるコマンドは拒否しなければならない。
 */
export function assertNoCategoryDirectUpdate(input: Record<string, unknown>): void {
  if ("categoryIds" in input || "categories" in input) {
    throw new DomainError(
      DomainErrorCode.BOOKMARK_CATEGORY_DIRECT_UPDATE_REJECTED,
      "Bookmark update must not include direct categoryIds. Categories are derived from Tag parents.",
    )
  }
}

/**
 * ArchivedBookmarkRecord の payload が最小フィールドのみを持つことを確認する。
 * siteName / favicon / 訪問統計などは含まない。
 */
export function assertArchivedPayloadIsMinimal(
  record: ArchivedBookmarkRecord,
): void {
  // payload には title, url, categories, tags のみ
  const allowedKeys = new Set(["title", "url", "categories", "tags"])
  for (const key of Object.keys(record.payload)) {
    if (!allowedKeys.has(key)) {
      throw new DomainError(
        DomainErrorCode.INVALID_JSON_VALUE,
        `ArchivedBookmarkRecord.payload must only contain: title, url, categories, tags. Found: ${key}`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 型ガード
// ---------------------------------------------------------------------------

export function isActiveBookmark(r: BookmarkRecord): r is ActiveBookmarkRecord {
  return r.archiveState === "ACTIVE"
}

export function isArchivedBookmark(r: BookmarkRecord): r is ArchivedBookmarkRecord {
  return r.archiveState === "ARCHIVED"
}
