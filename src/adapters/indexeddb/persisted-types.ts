/**
 * IndexedDB 永続レコード型 (DB-SCHEMA.md 正本)
 * Domain 型との差分は Adapter 内 mapper で吸収する。
 */
import type {
  Id,
  EpochMs,
  EntityOrigin,
  LabelKind,
  ClassificationState,
  ClassificationPolicySnapshot,
} from "~/domain"

export type BookmarkClassificationState =
  | "UNCLASSIFIED"
  | "PENDING"
  | "CLASSIFIED"
  | "NEEDS_REVIEW"
  | "FAILED"

export type BookmarkSource =
  | "CURRENT_TAB"
  | "MANUAL_URL"
  | "VISIT_REMINDER"
  | "CONTEXT_PAGE"
  | "CONTEXT_LINK"
  | "CHROME_IMPORT"
  | "QR_IMPORT"

export interface PersistedActiveBookmarkRecord {
  schemaVersion: number
  id: Id
  archiveState: "ACTIVE"
  rawUrl: string
  normalizedUrl: string
  urlHash: string
  urlNormalizationVersion: number
  title: string
  siteName: string | null
  faviconUrl: string | null
  faviconBlobId: Id | null
  thumbnailBlobId: Id | null
  classificationState: BookmarkClassificationState
  source: BookmarkSource
  savedAt: EpochMs
  updatedAt: EpochMs
  lastVisitedAt: EpochMs | null
  revision: number
  deletedAt: EpochMs | null
}

export interface PersistedArchivedBookmarkRecord {
  id: Id
  archiveState: "ARCHIVED"
  metadata: { schemaVersion: number }
  payload: {
    title: string
    url: string
    categories: Array<{ categoryId: Id; name: string }>
    tags: Array<{ tagId: Id; name: string; parentCategoryId: Id }>
  }
}

export type PersistedBookmarkRecord =
  | PersistedActiveBookmarkRecord
  | PersistedArchivedBookmarkRecord

export interface PersistedLabelRecord {
  schemaVersion: number
  id: Id
  name: string
  normalizedName: string
  nameNormalizationVersion: 1
  categoryUniqueName?: string
  tagUniqueName?: string
  kind: LabelKind
  parentCategoryId: Id | null
  origin: EntityOrigin
  creationRequestId: string
  sortOrder: number
  createdAt: EpochMs
  updatedAt: EpochMs
  revision: number
  deletedAt: EpochMs | null
  cascadeDeleteRequestId: Id | null
}

export interface PersistedBookmarkLabelRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  labelId: Id
  assignedBy: EntityOrigin
  confidence: number | null
  classificationJobId: Id | null
  createdAt: EpochMs
  updatedAt: EpochMs
  revision: number
  deletedAt: EpochMs | null
}

export type ClassificationJobReason =
  | "INITIAL_SAVE"
  | "USER_RECLASSIFY"
  | "CATEGORY_CASCADE_DELETE"

export interface PersistedClassificationJobRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  requestId: Id
  reason: ClassificationJobReason
  triggerOperationId: Id | null
  state: ClassificationState
  inputFingerprint: string
  bookmarkRevision: number
  settingsVersion: number
  policy: ClassificationPolicySnapshot
  maxCandidateCategories: number
  maxAssignedTags: number
  provider: "CHROME_PROMPT"
  providerModel: string | null
  executionContext: "TOP_LEVEL_EXTENSION_DOCUMENT" | null
  executorInstanceId: string | null
  leaseExpiresAt: EpochMs | null
  attempt: number
  errorCode: string | null
  startedAt: EpochMs | null
  finishedAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
}

export interface PersistedBookmarkRevisionRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  bookmarkRevision: number
  reason:
    | "USER_EDIT"
    | "AI_CLASSIFICATION"
    | "LABEL_MERGE"
    | "TAG_PARENT_CHANGE"
    | "TAG_DELETE"
    | "CATEGORY_CASCADE_DELETE"
    | "ARCHIVE"
  before: {
    categoryIds: Id[]
    tagIds: Id[]
    archiveState: "ACTIVE" | "ARCHIVED"
  }
  after: {
    categoryIds: Id[]
    tagIds: Id[]
    archiveState: "ACTIVE" | "ARCHIVED"
  }
  actor: "USER" | "AI" | "SYSTEM"
  createdAt: EpochMs
  updatedAt: EpochMs
}

export interface PersistedSearchDocumentRecord {
  schemaVersion: number
  id: string
  entityType: "LABEL" | "BOOKMARK"
  entityId: Id
  sourceRevision: number
  searchSchemaVersion: number
  normalizedText: string
  searchKeys: string[]
  builtAt: EpochMs
  createdAt: EpochMs
  updatedAt: EpochMs
}

export interface UpdateTagResult {
  tagId: Id
  resultTagRevision: number
  affectedBookmarkCount: number
}

export interface PersistedTagMutationReceiptRecord {
  schemaVersion: number
  id: `tag-update:${string}`
  tagId: Id
  requestFingerprint: string
  result: UpdateTagResult
  createdAt: EpochMs
  updatedAt: EpochMs
}

export type MigrationState = "IDLE" | "RUNNING" | "FAILED"

export interface PersistedSchemaMetaRecord {
  key: "database"
  schemaVersion: number
  normalizationVersion: number
  unicodeVersion: "15.1.0"
  unicodeDataAssetSha256: string
  searchSchemaVersion: number
  migrationState: MigrationState
  migrationId: string | null
  migrationCursor: {
    store: string
    lastKey: string | number | Array<string | number> | null
  } | null
  updatedAt: EpochMs
}

export interface BookmarkCursor {
  savedAt: EpochMs
  id: Id
}

export interface CategoryEditDetail {
  category: Pick<PersistedLabelRecord, "id" | "name" | "revision">
  activeTags: Array<Pick<PersistedLabelRecord, "id" | "name" | "revision">>
  activeTagCount: number
  referencedActiveBookmarkCount: number
  impactFingerprint: string
}

export interface DeleteCategoryCascadeCommand {
  categoryId: Id
  expectedCategoryRevision: number
  expectedImpactFingerprint: string
  requestId: `category-delete:${string}`
  warningAcknowledged: true
}

export interface DeleteCategoryCascadeResult {
  alreadyCompleted: boolean
  affectedBookmarkCount: number
  jobsCreated: number
}
