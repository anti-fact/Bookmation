/** IndexedDB store / index 名定数 (DB-SCHEMA.md P0) */

export const DB_NAME = "bookmation" as const
export const DB_VERSION = 2 as const

export const STORES = {
  bookmarks: "bookmarks",
  labels: "labels",
  bookmarkLabels: "bookmarkLabels",
  classificationJobs: "classificationJobs",
  bookmarkRevisions: "bookmarkRevisions",
  searchDocuments: "searchDocuments",
  tagMutationReceipts: "tagMutationReceipts",
  visitReminders: "visitReminders",
  blobs: "blobs",
  schemaMeta: "schemaMeta",
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

export const BOOKMARK_INDEXES = {
  byUrlHash: "byUrlHash",
  byArchiveState: "byArchiveState",
  byClassificationState: "byClassificationState",
  bySavedAt: "bySavedAt",
  byUpdatedAt: "byUpdatedAt",
} as const

export const LABEL_INDEXES = {
  byNormalizedName: "byNormalizedName",
  byKindAndName: "byKindAndName",
  byParentCategory: "byParentCategory",
  byParentCategoryAndName: "byParentCategoryAndName",
  byCategoryUniqueName: "byCategoryUniqueName",
  byTagUniqueName: "byTagUniqueName",
  byKindAndSortOrder: "byKindAndSortOrder",
  byOrigin: "byOrigin",
  byCreationRequestId: "byCreationRequestId",
  byCascadeDeleteRequestId: "byCascadeDeleteRequestId",
  byUpdatedAt: "byUpdatedAt",
} as const

export const BOOKMARK_LABEL_INDEXES = {
  byBookmarkAndLabel: "byBookmarkAndLabel",
  byBookmark: "byBookmark",
  byLabel: "byLabel",
  byClassificationJob: "byClassificationJob",
} as const

export const CLASSIFICATION_JOB_INDEXES = {
  byStateUpdatedAt: "byStateUpdatedAt",
  byBookmarkCreatedAt: "byBookmarkCreatedAt",
  byFingerprint: "byFingerprint",
  byRequestId: "byRequestId",
} as const

export const SEARCH_DOCUMENT_INDEXES = {
  byEntity: "byEntity",
  byEntityType: "byEntityType",
  bySearchKey: "bySearchKey",
} as const

export const TAG_MUTATION_RECEIPT_INDEXES = {
  byTagCreatedAt: "byTagCreatedAt",
} as const

export const VISIT_REMINDER_INDEXES = {
  byNormalizedUrlHash: "byNormalizedUrlHash",
  byState: "byState",
} as const

/** JSON document の size 上限 (bytes, UTF-8 近似) */
export const MAX_JSON_DOCUMENT_BYTES = 256 * 1024

/** 一覧取得の内部ページサイズ */
export const INTERNAL_PAGE_SIZE = 50

/** 派生 SearchDocument の schema version */
export const SEARCH_SCHEMA_VERSION = 1
