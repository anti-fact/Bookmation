import type {
  BookmarkCursor,
  DeleteCategoryCascadeCommand,
  PersistedActiveBookmarkRecord,
  PersistedClassificationJobRecord,
  PersistedLabelRecord,
  UpdateTagResult,
} from "~/adapters/indexeddb/persisted-types"
import type { UpdateTagCommand } from "~/domain"

export interface SaveBookmarkWithJobInput {
  id: string
  rawUrl: string
  title: string
  siteName?: string | null
  creationRequestId: string
  jobId: string
}

export interface SaveBookmarkWithJobResult {
  bookmark: PersistedActiveBookmarkRecord
  job: PersistedClassificationJobRecord
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

export interface ListRecentBookmarksResult {
  items: PersistedActiveBookmarkRecord[]
  nextCursor: BookmarkCursor | null
}

export interface DeleteCategoryCascadeResult {
  alreadyCompleted: boolean
  affectedBookmarkCount: number
  jobsCreated: number
}

/** ローカル永続化 Port (TASK-003) */
export interface LocalDataLayerPort {
  close(): Promise<void>
  saveBookmarkWithJob(input: SaveBookmarkWithJobInput): Promise<SaveBookmarkWithJobResult>
  getBookmark(id: string): Promise<PersistedActiveBookmarkRecord | undefined>
  createCategory(input: CreateCategoryInput): Promise<PersistedLabelRecord>
  createTag(input: CreateTagInput): Promise<PersistedLabelRecord>
  assignTagEdge(input: AssignTagEdgeInput): Promise<unknown>
  updateTag(command: UpdateTagCommand): Promise<UpdateTagResult>
  deleteCategoryCascade(command: DeleteCategoryCascadeCommand): Promise<DeleteCategoryCascadeResult>
  listRecentBookmarks(cursor: BookmarkCursor | null, limit?: number): Promise<ListRecentBookmarksResult>
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
