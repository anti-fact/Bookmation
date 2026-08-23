import type {
  BookmarkCursor,
  DeleteCategoryCascadeCommand,
  PersistedActiveBookmarkRecord,
  PersistedClassificationJobRecord,
  PersistedLabelRecord,
  UpdateTagResult,
} from "~/adapters/indexeddb/persisted-types"
import type {
  ApplyClassificationResultShellInput,
  ApplyClassificationResultShellResult,
  ClaimClassificationJobInput,
  ClaimClassificationJobResult,
} from "~/adapters/indexeddb/classification-job-ops"
import type { UpdateTagCommand } from "~/domain"

export interface SaveBookmarkWithJobInput {
  id: string
  rawUrl: string
  title: string
  siteName?: string | null
  faviconUrl?: string | null
  faviconBlobId?: string | null
  thumbnailBlobId?: string | null
  tagIds?: readonly string[]
  source?: PersistedActiveBookmarkRecord["source"]
  creationRequestId: string
  jobId: string
}

export interface SaveBookmarkWithJobResult {
  bookmark: PersistedActiveBookmarkRecord
  job: PersistedClassificationJobRecord | null
  duplicate: boolean
}

export interface CreateCategoryInput {
  id: string
  name: string
  creationRequestId: string
}

export interface CreateTagInput {
  id: string
  name: string
  parentCategoryId: string
  expectedParentRevision: number
  creationRequestId: string
}

export interface AssignTagEdgeInput {
  bookmarkId: string
  tagId: string
  expectedBookmarkRevision: number
}
export interface UpdateBookmarkInput { bookmarkId: string; expectedRevision: number; title: string; rawUrl: string; tagIds: readonly string[] }

export interface ListRecentBookmarksResult {
  items: PersistedActiveBookmarkRecord[]
  nextCursor: BookmarkCursor | null
}
export interface SearchAllByKeywordResult { labels: PersistedLabelRecord[]; bookmarks: PersistedActiveBookmarkRecord[] }
export interface SuggestAllByKeywordCandidate {
  entityType: "LABEL" | "BOOKMARK"
  entityId: string
  entityRevision: number
  labelKind: "CATEGORY" | "TAG" | null
  parentCategoryId: string | null
  displayText: string
  matchedFields: string[]
}
export interface LabelCandidate { id: string; name: string; kind: "CATEGORY" | "TAG"; parentCategoryId: string | null; parentCategoryName: string | null; revision: number; origin: string; usageCount: number }

export interface DeleteCategoryCascadeResult {
  alreadyCompleted: boolean
  affectedBookmarkCount: number
  jobsCreated: number
}
/** ローカル永続化 Port (TASK-003) */
export interface LocalDataLayerPort {
  close(): Promise<void>
  saveBookmarkWithJob(input: SaveBookmarkWithJobInput): Promise<SaveBookmarkWithJobResult>
  claimClassificationJob(input: Omit<ClaimClassificationJobInput, "now"> & { now?: number }): Promise<ClaimClassificationJobResult | null>
  recoverStaleClassificationJobs(now?: number): Promise<number>
  retryClassificationJob(jobId: string, now?: number): Promise<PersistedClassificationJobRecord>
  cancelClassificationJob(jobId: string, now?: number): Promise<PersistedClassificationJobRecord>
  applyClassificationResultShell(input: Omit<ApplyClassificationResultShellInput, "now"> & { now?: number }): Promise<ApplyClassificationResultShellResult>
  findActiveBookmarkByUrlHash(
    normalizedUrl: string,
    urlHash: string,
  ): Promise<PersistedActiveBookmarkRecord | undefined>
  updateBookmarkMetadata(input: {
    bookmarkId: string
    expectedRevision: number
    title?: string
    faviconUrl?: string | null
    faviconBlobId?: string | null
    thumbnailBlobId?: string | null
  }): Promise<PersistedActiveBookmarkRecord>
  putBlobRecord(input: {
    id: string
    kind: "THUMBNAIL" | "FAVICON"
    mimeType: string
    byteLength: number
    width: number | null
    height: number | null
    data: Blob
    contentHash: string
  }): Promise<void>
  getBlobRecord(id: string): Promise<
    | {
        id: string
        kind: "THUMBNAIL" | "FAVICON"
        mimeType: string
        data: Blob
      }
    | undefined
  >
  getBookmark(id: string): Promise<PersistedActiveBookmarkRecord | undefined>
  findActiveBookmarkByNormalizedUrl(normalizedUrl: string): Promise<PersistedActiveBookmarkRecord | undefined>
  createCategory(input: CreateCategoryInput): Promise<PersistedLabelRecord>
  createTag(input: CreateTagInput): Promise<PersistedLabelRecord>
  assignTagEdge(input: AssignTagEdgeInput): Promise<unknown>
  updateBookmark(input: UpdateBookmarkInput): Promise<PersistedActiveBookmarkRecord>
  updateTag(command: UpdateTagCommand): Promise<UpdateTagResult>
  deleteCategoryCascade(command: DeleteCategoryCascadeCommand): Promise<DeleteCategoryCascadeResult>
  listRecentBookmarks(cursor: BookmarkCursor | null, limit?: number): Promise<ListRecentBookmarksResult>
  listBookmarksByLabel(labelId: string, cursor: BookmarkCursor | null, limit?: number): Promise<ListRecentBookmarksResult & { totalCount: number }>
  listLabelCandidates(keyword: string, kind?: "CATEGORY" | "TAG", limit?: number): Promise<LabelCandidate[]>
  searchAllByKeyword(keyword: string, limit?: number): Promise<SearchAllByKeywordResult>
  suggestAllByKeyword(keyword: string, limit?: number): Promise<SuggestAllByKeywordCandidate[]>
  softDeleteBookmark(bookmarkId: string, expectedRevision: number): Promise<void>
  softDeleteTag(tagId: string, expectedRevision: number): Promise<void>
  getCategoryEditDetail(categoryId: string): Promise<{
    impactFingerprint: string
    referencedActiveBookmarkCount: number
  }>
  physicalGcLabel(labelId: string): Promise<void>
  recoverMigrationFromFailed(): Promise<void>
  getSchemaMeta(): Promise<{ migrationState: string }>
}

export type { UpdateTagResult, DeleteCategoryCascadeCommand }
