/**
 * TASK-003 / BE-02: IndexedDB Repository 実装
 */
import type { IDBPTransaction } from "idb"

import type {
  ClassificationPolicySnapshot,
  EpochMs,
  Id,
  UpdateTagCommand,
} from "~/domain"
import {
  DomainError,
  DomainErrorCode,
  assertLabelInvariants,
  assertNoCategoryNameConflict,
  assertNoTagNameConflict,
  assertTagParentChangeIsUserCommand,
  normalizeLabelName,
  nextRevision,
  policyFromGranularity,
  validateAndNormalizeUrl,
} from "~/domain"

import { computeUrlHash, fingerprintFromObject, syncInputFingerprint } from "./crypto-utils"
import { stripUndefinedFields } from "./document-validation"
import {
  assertRequestIdNamespace,
  assertRevisionMatch,
  getActiveBookmarkOrThrow,
  getEdgeByPair,
  getLabelOrThrow,
  isActiveBookmark,
  listActiveCategoryAndTagIds,
  listEdgesForBookmark,
  putBookmark,
  putEdge,
  putLabel,
  syncCategoryEdgesFromTags,
} from "./edge-helpers"
import type { BookmationDatabase } from "./open-database"
import { openBookmationDatabase } from "./open-database"
import type {
  BookmarkCursor,
  CategoryEditDetail,
  DeleteCategoryCascadeCommand,
  DeleteCategoryCascadeResult,
  PersistedActiveBookmarkRecord,
  PersistedBookmarkLabelRecord,
  PersistedBookmarkRevisionRecord,
  PersistedClassificationJobRecord,
  PersistedLabelRecord,
  PersistedSchemaMetaRecord,
  PersistedSearchDocumentRecord,
  PersistedTagMutationReceiptRecord,
  UpdateTagResult,
} from "./persisted-types"
import {
  buildBookmarkSearchDocument,
  buildCategoryImpactFingerprint,
  buildLabelSearchDocument,
  buildUpdateTagRequestFingerprint,
  searchDocumentId,
} from "./search-document-builder"
import { INTERNAL_PAGE_SIZE, STORES } from "./stores"

const SAVE_TX_STORES = [
  STORES.bookmarks,
  STORES.classificationJobs,
  STORES.bookmarkRevisions,
  STORES.searchDocuments,
] as const

const TAG_EDGE_TX_STORES = [
  STORES.bookmarkLabels,
  STORES.bookmarks,
  STORES.searchDocuments,
  STORES.labels,
] as const

const UPDATE_TAG_TX_STORES = [
  STORES.labels,
  STORES.bookmarkLabels,
  STORES.bookmarks,
  STORES.bookmarkRevisions,
  STORES.searchDocuments,
  STORES.tagMutationReceipts,
] as const

const CASCADE_TX_STORES = [
  STORES.labels,
  STORES.bookmarkLabels,
  STORES.bookmarks,
  STORES.classificationJobs,
  STORES.bookmarkRevisions,
  STORES.searchDocuments,
] as const

export interface SaveBookmarkWithJobInput {
  id: Id
  rawUrl: string
  title: string
  siteName?: string | null
  faviconUrl?: string | null
  source?: PersistedActiveBookmarkRecord["source"]
  policy?: ClassificationPolicySnapshot
  creationRequestId: Id
  jobId: Id
  now?: EpochMs
}

export interface SaveBookmarkWithJobResult {
  bookmark: PersistedActiveBookmarkRecord
  job: PersistedClassificationJobRecord
}

export interface CreateCategoryInput {
  id: Id
  name: string
  creationRequestId: string
  sortOrder?: number
  now?: EpochMs
}

export interface CreateTagInput {
  id: Id
  name: string
  parentCategoryId: Id
  expectedParentRevision: number
  creationRequestId: string
  sortOrder?: number
  now?: EpochMs
}

export interface AssignTagEdgeInput {
  bookmarkId: Id
  tagId: Id
  expectedBookmarkRevision: number
  assignedBy?: PersistedBookmarkLabelRecord["assignedBy"]
  now?: EpochMs
}

export interface UpdateBookmarkInput {
  bookmarkId: Id
  expectedRevision: number
  title: string
  rawUrl: string
  tagIds: readonly Id[]
  now?: EpochMs
}

export interface ListRecentBookmarksResult {
  items: PersistedActiveBookmarkRecord[]
  nextCursor: BookmarkCursor | null
}
export interface LabelCandidate { id: Id; name: string; kind: "CATEGORY" | "TAG"; parentCategoryId: Id | null; revision: number; origin: PersistedLabelRecord["origin"]; usageCount: number }

export class LocalDataLayer {
  private constructor(private readonly db: BookmationDatabase) {}

  static async open(dbName?: string): Promise<LocalDataLayer> {
    const db = await openBookmationDatabase(dbName ? { dbName } : {})
    return new LocalDataLayer(db)
  }

  async close(): Promise<void> {
    this.db.close()
  }

  get rawDb(): BookmationDatabase {
    return this.db
  }

  async getBookmark(id: Id): Promise<PersistedActiveBookmarkRecord | undefined> {
    const record = await this.db.get(STORES.bookmarks, id)
    if (!record || record.archiveState !== "ACTIVE" || record.deletedAt !== null) return undefined
    return record
  }

  async findActiveBookmarkByNormalizedUrl(normalizedUrl: string): Promise<PersistedActiveBookmarkRecord | undefined> {
    const urlHash = await computeUrlHash(normalizedUrl)
    const candidates = await this.db.getAllFromIndex(STORES.bookmarks, "byUrlHash", urlHash)
    return candidates.find((record): record is PersistedActiveBookmarkRecord =>
      record.archiveState === "ACTIVE" && record.deletedAt === null && record.normalizedUrl === normalizedUrl,
    )
  }

  async getLabel(id: Id): Promise<PersistedLabelRecord | undefined> {
    return this.db.get(STORES.labels, id)
  }

  async saveBookmarkWithJob(
    input: SaveBookmarkWithJobInput,
  ): Promise<SaveBookmarkWithJobResult> {
    const now = input.now ?? Date.now()
    const url = validateAndNormalizeUrl(input.rawUrl)
    const urlHash = await computeUrlHash(url.normalized)
    const policy = input.policy ?? policyFromGranularity(2)
    const inputFingerprint = await fingerprintFromObject({
      bookmarkId: input.id,
      normalizedUrl: url.normalized,
      policy,
    })

    const tx = this.db.transaction([...SAVE_TX_STORES], "readwrite")
    const jobsStore = tx.objectStore(STORES.classificationJobs)

    const existingJob = await jobsStore.index("byRequestId").get(input.creationRequestId)
    if (existingJob) {
      const bookmark = await getActiveBookmarkOrThrow(tx, existingJob.bookmarkId)
      await tx.done
      return { bookmark, job: existingJob }
    }

    const bookmark: PersistedActiveBookmarkRecord = {
      schemaVersion: 1,
      id: input.id,
      archiveState: "ACTIVE",
      rawUrl: url.raw,
      normalizedUrl: url.normalized,
      urlHash,
      urlNormalizationVersion: 1,
      title: input.title,
      siteName: input.siteName ?? null,
      faviconUrl: input.faviconUrl ?? null,
      faviconBlobId: null,
      thumbnailBlobId: null,
      classificationState: "PENDING",
      source: input.source ?? "MANUAL_URL",
      savedAt: now,
      updatedAt: now,
      lastVisitedAt: null,
      revision: 1,
      deletedAt: null,
    }

    const job: PersistedClassificationJobRecord = {
      schemaVersion: 1,
      id: input.jobId,
      bookmarkId: input.id,
      requestId: input.creationRequestId,
      reason: "INITIAL_SAVE",
      triggerOperationId: null,
      state: "PENDING",
      inputFingerprint,
      bookmarkRevision: bookmark.revision,
      settingsVersion: 1,
      policy,
      maxCandidateCategories: 8,
      maxAssignedTags: 8,
      provider: "CHROME_PROMPT",
      providerModel: null,
      executionContext: null,
      executorInstanceId: null,
      leaseExpiresAt: null,
      attempt: 0,
      errorCode: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const revision: PersistedBookmarkRevisionRecord = {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      bookmarkId: bookmark.id,
      bookmarkRevision: bookmark.revision,
      reason: "USER_EDIT",
      before: { categoryIds: [], tagIds: [], archiveState: "ACTIVE" },
      after: { categoryIds: [], tagIds: [], archiveState: "ACTIVE" },
      actor: "USER",
      createdAt: now,
      updatedAt: now,
    }

    const searchDoc = buildBookmarkSearchDocument(bookmark, now)

    await putBookmark(tx, bookmark)
    await jobsStore.put(stripUndefinedFields(job as unknown as Record<string, unknown>) as unknown as PersistedClassificationJobRecord)
    await tx
      .objectStore(STORES.bookmarkRevisions)
      .put(stripUndefinedFields(revision as unknown as Record<string, unknown>) as unknown as PersistedBookmarkRevisionRecord)
    await tx
      .objectStore(STORES.searchDocuments)
      .put(stripUndefinedFields(searchDoc as unknown as Record<string, unknown>) as unknown as PersistedSearchDocumentRecord)
    await tx.done

    return { bookmark, job }
  }

  async createCategory(input: CreateCategoryInput): Promise<PersistedLabelRecord> {
    const now = input.now ?? Date.now()
    const normalized = normalizeLabelName(input.name)

    const tx = this.db.transaction([STORES.labels, STORES.searchDocuments], "readwrite")
    const labelsStore = tx.objectStore(STORES.labels)

    const byRequest = await labelsStore.index("byCreationRequestId").get(input.creationRequestId)
    if (byRequest) {
      await tx.done
      return byRequest
    }

    const existingByName = await labelsStore.index("byCategoryUniqueName").get(normalized.normalized)
    if (existingByName) {
      throw new DomainError(
        DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
        `Category name reserved: ${normalized.normalized}`,
      )
    }

    const allCategories = await labelsStore.index("byKindAndName").getAll(["CATEGORY", normalized.normalized])
    assertNoCategoryNameConflict(normalized.normalized, allCategories)

    const record: PersistedLabelRecord = {
      schemaVersion: 1,
      id: input.id,
      name: normalized.normalized,
      normalizedName: normalized.normalized,
      nameNormalizationVersion: 1,
      categoryUniqueName: normalized.normalized,
      kind: "CATEGORY",
      parentCategoryId: null,
      origin: "USER",
      creationRequestId: input.creationRequestId,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      deletedAt: null,
      cascadeDeleteRequestId: null,
    }
    assertLabelInvariants(record, null)
    await putLabel(tx, record)

    const searchDoc = buildLabelSearchDocument(record, null, now)
    await tx
      .objectStore(STORES.searchDocuments)
      .put(stripUndefinedFields(searchDoc as unknown as Record<string, unknown>) as unknown as PersistedSearchDocumentRecord)
    await tx.done
    return record
  }

  async createTag(input: CreateTagInput): Promise<PersistedLabelRecord> {
    const now = input.now ?? Date.now()
    const normalized = normalizeLabelName(input.name)

    const tx = this.db.transaction([STORES.labels, STORES.searchDocuments], "readwrite")
    const labelsStore = tx.objectStore(STORES.labels)

    const byRequest = await labelsStore.index("byCreationRequestId").get(input.creationRequestId)
    if (byRequest) {
      await tx.done
      return byRequest
    }

    const parent = await getLabelOrThrow(tx, input.parentCategoryId)
    assertRevisionMatch(parent.revision, input.expectedParentRevision, "Parent category")
    if (parent.deletedAt !== null) {
      throw new DomainError(DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT)
    }

    const existingByName = await labelsStore.index("byTagUniqueName").get(normalized.normalized)
    if (existingByName) {
      throw new DomainError(
        DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
        `Tag name reserved: ${normalized.normalized}`,
      )
    }

    const allTags = await labelsStore.index("byKindAndName").getAll(["TAG", normalized.normalized])
    assertNoTagNameConflict(normalized.normalized, allTags)

    const record: PersistedLabelRecord = {
      schemaVersion: 1,
      id: input.id,
      name: normalized.normalized,
      normalizedName: normalized.normalized,
      nameNormalizationVersion: 1,
      tagUniqueName: normalized.normalized,
      kind: "TAG",
      parentCategoryId: input.parentCategoryId,
      origin: "USER",
      creationRequestId: input.creationRequestId,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      deletedAt: null,
      cascadeDeleteRequestId: null,
    }
    assertLabelInvariants(record, parent)
    await putLabel(tx, record)

    const searchDoc = buildLabelSearchDocument(record, parent, now)
    await tx
      .objectStore(STORES.searchDocuments)
      .put(stripUndefinedFields(searchDoc as unknown as Record<string, unknown>) as unknown as PersistedSearchDocumentRecord)
    await tx.done
    return record
  }

  async assignTagEdge(input: AssignTagEdgeInput): Promise<PersistedBookmarkLabelRecord> {
    const now = input.now ?? Date.now()
    const tx = this.db.transaction([...TAG_EDGE_TX_STORES], "readwrite")

    let bookmark = await getActiveBookmarkOrThrow(tx, input.bookmarkId)
    assertRevisionMatch(bookmark.revision, input.expectedBookmarkRevision, "Bookmark")

    const tag = await getLabelOrThrow(tx, input.tagId)
    if (tag.kind !== "TAG" || tag.deletedAt !== null) {
      throw new DomainError(DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT)
    }

    const existing = await getEdgeByPair(tx, input.bookmarkId, input.tagId)
    if (existing) {
      if (existing.deletedAt === null) {
        await tx.done
        return existing
      }
      const restored: PersistedBookmarkLabelRecord = {
        ...existing,
        deletedAt: null,
        updatedAt: now,
        revision: nextRevision(existing.revision),
        assignedBy: input.assignedBy ?? existing.assignedBy,
      }
      await putEdge(tx, restored)
      bookmark = await syncCategoryEdgesFromTags(tx, bookmark, now, input.assignedBy ?? "USER")
      bookmark = {
        ...bookmark,
        updatedAt: now,
        revision: nextRevision(bookmark.revision),
      }
      await putBookmark(tx, bookmark)
      const searchDoc = buildBookmarkSearchDocument(bookmark, now)
      await tx.objectStore(STORES.searchDocuments).put(searchDoc)
      await tx.done
      return restored
    }

    const edge: PersistedBookmarkLabelRecord = {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      bookmarkId: input.bookmarkId,
      labelId: input.tagId,
      assignedBy: input.assignedBy ?? "USER",
      confidence: null,
      classificationJobId: null,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      deletedAt: null,
    }
    await putEdge(tx, edge)
    bookmark = await syncCategoryEdgesFromTags(tx, bookmark, now, input.assignedBy ?? "USER")
    bookmark = {
      ...bookmark,
      updatedAt: now,
      revision: nextRevision(bookmark.revision),
    }
    await putBookmark(tx, bookmark)
    await tx.objectStore(STORES.searchDocuments).put(buildBookmarkSearchDocument(bookmark, now))
    await tx.done
    return edge
  }

  async updateBookmark(input: UpdateBookmarkInput): Promise<PersistedActiveBookmarkRecord> {
    const now = input.now ?? Date.now()
    const normalized = validateAndNormalizeUrl(input.rawUrl)
    const urlHash = await computeUrlHash(normalized.normalized)
    if (new Set(input.tagIds).size !== input.tagIds.length) {
      throw new DomainError(DomainErrorCode.INVALID_ID, "Duplicate tag IDs")
    }
    const tx = this.db.transaction([...TAG_EDGE_TX_STORES], "readwrite")
    let bookmark = await getActiveBookmarkOrThrow(tx, input.bookmarkId)
    assertRevisionMatch(bookmark.revision, input.expectedRevision, "Bookmark")
    for (const tagId of input.tagIds) {
      const tag = await getLabelOrThrow(tx, tagId)
      if (tag.kind !== "TAG" || tag.deletedAt !== null) throw new DomainError(DomainErrorCode.INVALID_ID)
    }
    const wanted = new Set(input.tagIds)
    const edges = await listEdgesForBookmark(tx, bookmark.id)
    for (const edge of edges) {
      const label = await getLabelOrThrow(tx, edge.labelId)
      if (label.kind !== "TAG") continue
      if (wanted.has(edge.labelId)) {
        if (edge.deletedAt !== null) await putEdge(tx, { ...edge, deletedAt: null, updatedAt: now, revision: nextRevision(edge.revision), assignedBy: "USER" })
      } else if (edge.deletedAt === null) {
        await putEdge(tx, { ...edge, deletedAt: now, updatedAt: now, revision: nextRevision(edge.revision) })
      }
    }
    for (const tagId of input.tagIds) {
      if (!edges.some((edge) => edge.labelId === tagId)) {
        await putEdge(tx, { schemaVersion: 1, id: crypto.randomUUID(), bookmarkId: bookmark.id, labelId: tagId, classificationJobId: null, assignedBy: "USER", confidence: null, createdAt: now, updatedAt: now, revision: 1, deletedAt: null })
      }
    }
    bookmark = await syncCategoryEdgesFromTags(tx, bookmark, now)
    const updated: PersistedActiveBookmarkRecord = { ...bookmark, rawUrl: normalized.raw, normalizedUrl: normalized.normalized, urlHash, urlNormalizationVersion: normalized.normalizationVersion, title: input.title.trim(), updatedAt: now, revision: nextRevision(bookmark.revision) }
    await putBookmark(tx, updated)
    await tx.objectStore(STORES.searchDocuments).put(buildBookmarkSearchDocument(updated, now))
    await tx.done
    return updated
  }

  async updateTag(command: UpdateTagCommand): Promise<UpdateTagResult> {
    assertTagParentChangeIsUserCommand(command.requestId)
    assertRequestIdNamespace(command.requestId, "tag-update:")
    const now = Date.now()
    const fingerprint = await buildUpdateTagRequestFingerprint(command)

    const tx = this.db.transaction([...UPDATE_TAG_TX_STORES], "readwrite")
    const receiptsStore = tx.objectStore(STORES.tagMutationReceipts)

    const existingReceipt = await receiptsStore.get(command.requestId)
    if (existingReceipt) {
      if (existingReceipt.tagId !== command.tagId || existingReceipt.requestFingerprint !== fingerprint) {
        throw new DomainError(DomainErrorCode.REQUEST_ID_REUSED)
      }
      await tx.done
      return existingReceipt.result
    }

    const tag = await getLabelOrThrow(tx, command.tagId)
    if (tag.kind !== "TAG" || tag.deletedAt !== null) {
      throw new DomainError(DomainErrorCode.TAG_UPDATE_CONFLICT)
    }
    assertRevisionMatch(tag.revision, command.expectedTagRevision, "Tag")

    const newParent = await getLabelOrThrow(tx, command.parentCategoryId)
    if (newParent.kind !== "CATEGORY" || newParent.deletedAt !== null) {
      throw new DomainError(DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT)
    }
    assertRevisionMatch(newParent.revision, command.expectedParentRevision, "Parent category")

    const normalized = normalizeLabelName(command.name)
    const labelsStore = tx.objectStore(STORES.labels)
    const nameConflict = await labelsStore.index("byTagUniqueName").get(normalized.normalized)
    if (nameConflict && nameConflict.id !== tag.id) {
      throw new DomainError(DomainErrorCode.DUPLICATE_NORMALIZED_NAME)
    }

    const parentChanged = tag.parentCategoryId !== command.parentCategoryId
    const nameChanged = tag.normalizedName !== normalized.normalized
    if (!parentChanged && !nameChanged) {
      const result: UpdateTagResult = {
        tagId: tag.id,
        resultTagRevision: tag.revision,
        affectedBookmarkCount: 0,
      }
      const receipt: PersistedTagMutationReceiptRecord = {
        schemaVersion: 1,
        id: command.requestId,
        tagId: tag.id,
        requestFingerprint: fingerprint,
        result,
        createdAt: now,
        updatedAt: now,
      }
      await receiptsStore.put(receipt)
      await tx.done
      return result
    }

    const updatedTag: PersistedLabelRecord = {
      ...tag,
      name: normalized.normalized,
      normalizedName: normalized.normalized,
      tagUniqueName: normalized.normalized,
      parentCategoryId: command.parentCategoryId,
      updatedAt: now,
      revision: nextRevision(tag.revision),
    }
    assertLabelInvariants(updatedTag, newParent)
    await putLabel(tx, updatedTag)

    const tagSearch = buildLabelSearchDocument(updatedTag, newParent, now)
    await tx.objectStore(STORES.searchDocuments).put(tagSearch)

    let affectedCount = 0
    const tagEdges = await tx.objectStore(STORES.bookmarkLabels).index("byLabel").getAll(tag.id)

    for (const edge of tagEdges) {
      if (edge.deletedAt !== null) continue
      let bookmark = await getActiveBookmarkOrThrow(tx, edge.bookmarkId)
      bookmark = await syncCategoryEdgesFromTags(tx, bookmark, now)
      if (parentChanged) {
        bookmark = {
          ...bookmark,
          updatedAt: now,
          revision: nextRevision(bookmark.revision),
        }
        await putBookmark(tx, bookmark)

        const before = await listActiveCategoryAndTagIds(tx, bookmark.id)
        const revisionRecord: PersistedBookmarkRevisionRecord = {
          schemaVersion: 1,
          id: crypto.randomUUID(),
          bookmarkId: bookmark.id,
          bookmarkRevision: bookmark.revision,
          reason: "TAG_PARENT_CHANGE",
          before: { ...before, archiveState: "ACTIVE" },
          after: { ...before, archiveState: "ACTIVE" },
          actor: "USER",
          createdAt: now,
          updatedAt: now,
        }
        await tx.objectStore(STORES.bookmarkRevisions).put(revisionRecord)
        await tx
        .objectStore(STORES.searchDocuments)
        .put(stripUndefinedFields(buildBookmarkSearchDocument(bookmark, now) as unknown as Record<string, unknown>) as unknown as PersistedSearchDocumentRecord)
        affectedCount++
      }
    }

    const result: UpdateTagResult = {
      tagId: updatedTag.id,
      resultTagRevision: updatedTag.revision,
      affectedBookmarkCount: affectedCount,
    }
    const receipt: PersistedTagMutationReceiptRecord = {
      schemaVersion: 1,
      id: command.requestId,
      tagId: updatedTag.id,
      requestFingerprint: fingerprint,
      result,
      createdAt: now,
      updatedAt: now,
    }
    await receiptsStore.put(receipt)
    await tx.done
    return result
  }

  async getCategoryEditDetail(categoryId: Id): Promise<CategoryEditDetail> {
    const category = await this.getLabel(categoryId)
    if (!category || category.kind !== "CATEGORY") {
      throw new DomainError(DomainErrorCode.INVALID_ID)
    }

    const childTags = await this.db
      .getAllFromIndex(STORES.labels, "byParentCategory", categoryId)
    const activeTags = childTags.filter((t) => t.deletedAt === null)

    const bookmarkIds = new Set<Id>()
    for (const tag of activeTags) {
      const edges = await this.db.getAllFromIndex(STORES.bookmarkLabels, "byLabel", tag.id)
      for (const edge of edges) {
        if (edge.deletedAt !== null) continue
        const bookmark = await this.db.get(STORES.bookmarks, edge.bookmarkId)
        if (bookmark && isActiveBookmark(bookmark)) {
          bookmarkIds.add(bookmark.id)
        }
      }
    }

    const allChildTags = childTags
    const allEdges: Array<{
      id: Id
      bookmarkId: Id
      labelId: Id
      revision: number
      deletedAt: EpochMs | null
    }> = []
    const targetLabelIds = new Set([categoryId, ...allChildTags.map((t) => t.id)])
    for (const labelId of targetLabelIds) {
      const edges = await this.db.getAllFromIndex(STORES.bookmarkLabels, "byLabel", labelId)
      for (const edge of edges) {
        allEdges.push({
          id: edge.id,
          bookmarkId: edge.bookmarkId,
          labelId: edge.labelId,
          revision: edge.revision,
          deletedAt: edge.deletedAt,
        })
      }
    }

    const bookmarks: PersistedActiveBookmarkRecord[] = []
    for (const id of bookmarkIds) {
      const b = await this.db.get(STORES.bookmarks, id)
      if (b && isActiveBookmark(b)) bookmarks.push(b)
    }

    const impactFingerprint = await buildCategoryImpactFingerprint({
      category,
      childTags: allChildTags,
      edges: allEdges,
      bookmarks,
    })

    return {
      category: { id: category.id, name: category.name, revision: category.revision },
      activeTags: activeTags.map((t) => ({ id: t.id, name: t.name, revision: t.revision })),
      activeTagCount: activeTags.length,
      referencedActiveBookmarkCount: bookmarkIds.size,
      impactFingerprint,
    }
  }

  async deleteCategoryCascade(
    command: DeleteCategoryCascadeCommand,
  ): Promise<DeleteCategoryCascadeResult> {
    assertRequestIdNamespace(command.requestId, "category-delete:")
    if (!command.warningAcknowledged) {
      throw new DomainError(DomainErrorCode.CATEGORY_DELETE_PREVIEW_STALE)
    }

    const now = Date.now()
    const readStores = [
      STORES.labels,
      STORES.bookmarkLabels,
      STORES.bookmarks,
      STORES.classificationJobs,
    ] as const
    const readTx = this.db.transaction([...readStores], "readonly")
    const labelsStore = readTx.objectStore(STORES.labels)

    const cascadeIndex = labelsStore.index("byCascadeDeleteRequestId")
    const prior = await cascadeIndex.getAll(command.requestId)
    const completedCategory = prior.find(
      (l) => l.id === command.categoryId && l.kind === "CATEGORY" && l.deletedAt !== null,
    )
    if (completedCategory) {
      await readTx.done
      return { alreadyCompleted: true, affectedBookmarkCount: 0, jobsCreated: 0 }
    }

    for (const label of prior) {
      if (label.id !== command.categoryId) {
        throw new DomainError(DomainErrorCode.REQUEST_ID_REUSED)
      }
    }

    const category = await labelsStore.get(command.categoryId)
    if (!category) {
      throw new DomainError(DomainErrorCode.INVALID_ID)
    }
    if (category.kind !== "CATEGORY") {
      throw new DomainError(DomainErrorCode.INVALID_ID)
    }
    if (category.deletedAt !== null) {
      await readTx.done
      return { alreadyCompleted: true, affectedBookmarkCount: 0, jobsCreated: 0 }
    }
    assertRevisionMatch(category.revision, command.expectedCategoryRevision, "Category")

    const childTags = await labelsStore.index("byParentCategory").getAll(command.categoryId)
    const snapshot = await this.collectCascadeSnapshot(readTx, category, childTags)
    await readTx.done

    const impactFingerprint = await buildCategoryImpactFingerprint({
      category: snapshot.category,
      childTags: snapshot.childTags,
      edges: snapshot.edges,
      bookmarks: snapshot.bookmarks,
    })
    if (impactFingerprint !== command.expectedImpactFingerprint) {
      throw new DomainError(DomainErrorCode.CATEGORY_DELETE_PREVIEW_STALE)
    }

    const affectedBookmarkIds = new Set<Id>(snapshot.bookmarkIds)
    const tx = this.db.transaction([...CASCADE_TX_STORES], "readwrite")

    const tombstoneCategory: PersistedLabelRecord = {
      ...category,
      deletedAt: now,
      updatedAt: now,
      revision: nextRevision(category.revision),
      cascadeDeleteRequestId: command.requestId,
    }
    await putLabel(tx, tombstoneCategory)

    for (const tag of childTags) {
      if (tag.deletedAt !== null) continue
      const tombstoneTag: PersistedLabelRecord = {
        ...tag,
        deletedAt: now,
        updatedAt: now,
        revision: nextRevision(tag.revision),
        cascadeDeleteRequestId: command.requestId,
      }
      await putLabel(tx, tombstoneTag)
      await tx.objectStore(STORES.searchDocuments).delete(searchDocumentId("LABEL", tag.id))
    }
    await tx.objectStore(STORES.searchDocuments).delete(searchDocumentId("LABEL", category.id))

    const targetLabelIds = new Set([category.id, ...childTags.map((t) => t.id)])
    for (const labelId of targetLabelIds) {
      const edges = await tx.objectStore(STORES.bookmarkLabels).index("byLabel").getAll(labelId)
      for (const edge of edges) {
        if (edge.deletedAt !== null) continue
        const tombstoneEdge: PersistedBookmarkLabelRecord = {
          ...edge,
          deletedAt: now,
          updatedAt: now,
          revision: nextRevision(edge.revision),
        }
        await putEdge(tx, tombstoneEdge)
      }
    }

    let jobsCreated = 0
    const jobsStore = tx.objectStore(STORES.classificationJobs)
    for (const bookmarkId of affectedBookmarkIds) {
      let bookmark = await getActiveBookmarkOrThrow(tx, bookmarkId)
      bookmark = await syncCategoryEdgesFromTags(tx, bookmark, now)
      bookmark = {
        ...bookmark,
        classificationState: "PENDING",
        updatedAt: now,
        revision: nextRevision(bookmark.revision),
      }
      await putBookmark(tx, bookmark)

      const before = await listActiveCategoryAndTagIds(tx, bookmark.id)
      const revisionRecord: PersistedBookmarkRevisionRecord = {
        schemaVersion: 1,
        id: crypto.randomUUID(),
        bookmarkId: bookmark.id,
        bookmarkRevision: bookmark.revision,
        reason: "CATEGORY_CASCADE_DELETE",
        before: { ...before, archiveState: "ACTIVE" },
        after: { ...before, archiveState: "ACTIVE" },
        actor: "SYSTEM",
        createdAt: now,
        updatedAt: now,
      }
      await tx.objectStore(STORES.bookmarkRevisions).put(revisionRecord)
      await tx
        .objectStore(STORES.searchDocuments)
        .put(stripUndefinedFields(buildBookmarkSearchDocument(bookmark, now) as unknown as Record<string, unknown>) as unknown as PersistedSearchDocumentRecord)

      const jobRequestId = `${command.requestId}:${bookmarkId}`
      const existingJob = await jobsStore.index("byRequestId").get(jobRequestId)
      if (!existingJob) {
        const job: PersistedClassificationJobRecord = {
          schemaVersion: 1,
          id: crypto.randomUUID(),
          bookmarkId,
          requestId: jobRequestId,
          reason: "CATEGORY_CASCADE_DELETE",
          triggerOperationId: command.requestId,
          state: "PENDING",
          inputFingerprint: syncInputFingerprint(bookmarkId, category.id),
          bookmarkRevision: bookmark.revision,
          settingsVersion: 1,
          policy: policyFromGranularity(2),
          maxCandidateCategories: 8,
          maxAssignedTags: 8,
          provider: "CHROME_PROMPT",
          providerModel: null,
          executionContext: null,
          executorInstanceId: null,
          leaseExpiresAt: null,
          attempt: 0,
          errorCode: null,
          startedAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        }
        await jobsStore.put(job)
        jobsCreated++
      }

      const pendingJobs = await jobsStore.index("byBookmarkCreatedAt").getAll(
        IDBKeyRange.bound([bookmarkId, 0], [bookmarkId, Number.MAX_SAFE_INTEGER]),
      )
      for (const job of pendingJobs) {
        if (job.state === "RUNNING" || job.state === "PENDING") {
          if (job.reason !== "CATEGORY_CASCADE_DELETE") {
            await jobsStore.put({
              ...job,
              state: "CANCELED",
              updatedAt: now,
              finishedAt: now,
            })
          }
        }
      }
    }

    await tx.done
    return {
      alreadyCompleted: false,
      affectedBookmarkCount: affectedBookmarkIds.size,
      jobsCreated,
    }
  }

  async softDeleteBookmark(bookmarkId: Id, expectedRevision: number): Promise<void> {
    const now = Date.now()
    const tx = this.db.transaction(
      [STORES.bookmarks, STORES.bookmarkLabels, STORES.searchDocuments],
      "readwrite",
    )
    const existing = await tx.objectStore(STORES.bookmarks).get(bookmarkId)
    if (!existing) {
      throw new DomainError(DomainErrorCode.INVALID_ID)
    }
    if (existing.archiveState !== "ACTIVE") {
      throw new DomainError(DomainErrorCode.INVALID_ID)
    }
    // The retry carries the revision from immediately before deletion.  Do not
    // create a second tombstone or advance its revision in that case.
    if (existing.deletedAt !== null) {
      if (existing.revision === expectedRevision + 1) {
        await tx.done
        return
      }
      assertRevisionMatch(existing.revision, expectedRevision, "Bookmark")
    }
    const bookmark = await getActiveBookmarkOrThrow(tx, bookmarkId)
    assertRevisionMatch(bookmark.revision, expectedRevision, "Bookmark")

    const tombstone: PersistedActiveBookmarkRecord = {
      ...bookmark,
      deletedAt: now,
      updatedAt: now,
      revision: nextRevision(bookmark.revision),
    }
    await putBookmark(tx, tombstone)
    await tx.objectStore(STORES.searchDocuments).delete(searchDocumentId("BOOKMARK", bookmarkId))

    const edges = await listEdgesForBookmark(tx, bookmarkId)
    for (const edge of edges) {
      if (edge.deletedAt !== null) continue
      await putEdge(tx, {
        ...edge,
        deletedAt: now,
        updatedAt: now,
        revision: nextRevision(edge.revision),
      })
    }
    await tx.done
  }

  async softDeleteTag(tagId: Id, expectedRevision: number): Promise<void> {
    const now = Date.now()
    const tx = this.db.transaction(
      [STORES.labels, STORES.bookmarkLabels, STORES.bookmarks, STORES.searchDocuments],
      "readwrite",
    )
    const tag = await getLabelOrThrow(tx, tagId)
    if (tag.kind !== "TAG") {
      throw new DomainError(DomainErrorCode.INVALID_ID)
    }
    if (tag.deletedAt !== null) {
      if (tag.revision === expectedRevision + 1) {
        await tx.done
        return
      }
      assertRevisionMatch(tag.revision, expectedRevision, "Tag")
    }
    assertRevisionMatch(tag.revision, expectedRevision, "Tag")

    await putLabel(tx, {
      ...tag,
      deletedAt: now,
      updatedAt: now,
      revision: nextRevision(tag.revision),
    })
    await tx.objectStore(STORES.searchDocuments).delete(searchDocumentId("LABEL", tagId))

    const edges = await tx.objectStore(STORES.bookmarkLabels).index("byLabel").getAll(tagId)
    for (const edge of edges) {
      if (edge.deletedAt !== null) continue
      await putEdge(tx, {
        ...edge,
        deletedAt: now,
        updatedAt: now,
        revision: nextRevision(edge.revision),
      })
      const bookmark = await getActiveBookmarkOrThrow(tx, edge.bookmarkId)
      const synced = await syncCategoryEdgesFromTags(tx, bookmark, now)
      const updatedBookmark: PersistedActiveBookmarkRecord = {
        ...synced,
        updatedAt: now,
        revision: nextRevision(synced.revision),
      }
      await putBookmark(tx, updatedBookmark)
      await tx
        .objectStore(STORES.searchDocuments)
        .put(buildBookmarkSearchDocument(updatedBookmark, now))
    }
    await tx.done
  }

  async listRecentBookmarks(
    cursor: BookmarkCursor | null,
    limit = INTERNAL_PAGE_SIZE,
  ): Promise<ListRecentBookmarksResult> {
    const tx = this.db.transaction(STORES.bookmarks, "readonly")
    const index = tx.store.index("bySavedAt")
    const all = await index.getAll()
    await tx.done

    const active = all.filter(
      (b): b is PersistedActiveBookmarkRecord =>
        b.archiveState === "ACTIVE" && b.deletedAt === null,
    )

    active.sort((a, b) => {
      if (b.savedAt !== a.savedAt) return b.savedAt - a.savedAt
      return b.id.localeCompare(a.id)
    })

    let startIdx = 0
    if (cursor) {
      startIdx = active.findIndex(
        (b) =>
          b.savedAt < cursor.savedAt ||
          (b.savedAt === cursor.savedAt && b.id < cursor.id),
      )
      if (startIdx === -1) startIdx = active.length
    }

    const slice = active.slice(startIdx, startIdx + limit)
    const last = slice[slice.length - 1]
    const nextCursor =
      slice.length === limit && last ? { savedAt: last.savedAt, id: last.id } : null

    return { items: slice, nextCursor }
  }

  async listBookmarksByLabel(labelId: Id, cursor: BookmarkCursor | null, limit = INTERNAL_PAGE_SIZE): Promise<ListRecentBookmarksResult & { totalCount: number }> {
    const edges = await this.db.getAllFromIndex(STORES.bookmarkLabels, "byLabel", labelId)
    const records = await Promise.all(edges.filter((edge) => edge.deletedAt === null).map((edge) => this.db.get(STORES.bookmarks, edge.bookmarkId)))
    const active = records.filter((record): record is PersistedActiveBookmarkRecord => !!record && isActiveBookmark(record))
    active.sort((a, b) => b.savedAt - a.savedAt || b.id.localeCompare(a.id))
    const start = cursor ? active.findIndex((b) => b.savedAt < cursor.savedAt || (b.savedAt === cursor.savedAt && b.id < cursor.id)) : 0
    const items = active.slice(start < 0 ? active.length : start, (start < 0 ? active.length : start) + limit)
    const last = items.at(-1)
    return { items, totalCount: active.length, nextCursor: items.length === limit && last ? { savedAt: last.savedAt, id: last.id } : null }
  }

  async listLabelCandidates(keyword: string, kind?: "CATEGORY" | "TAG", limit = 8): Promise<LabelCandidate[]> {
    const needle = keyword.trim().toLowerCase()
    if (!needle) return []
    const labels = await this.db.getAll(STORES.labels)
    const matches = labels.filter((label) => label.deletedAt === null && (!kind || label.kind === kind) && label.normalizedName.includes(needle))
    const candidates = await Promise.all(matches.map(async (label) => ({ id: label.id, name: label.name, kind: label.kind, parentCategoryId: label.parentCategoryId, revision: label.revision, origin: label.origin, usageCount: (await this.db.getAllFromIndex(STORES.bookmarkLabels, "byLabel", label.id)).filter((edge) => edge.deletedAt === null).length })))
    return candidates.sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name)).slice(0, limit)
  }

  /** tombstone Label を物理削除（テスト・GC 用） */
  async physicalGcLabel(labelId: Id): Promise<void> {
    const tx = this.db.transaction([STORES.labels, STORES.searchDocuments], "readwrite")
    const label = await getLabelOrThrow(tx, labelId)
    if (label.deletedAt === null) {
      throw new DomainError(DomainErrorCode.INVALID_ID, "Label is not tombstoned")
    }
    if (label.kind === "CATEGORY") {
      const children = await tx.objectStore(STORES.labels).index("byParentCategory").getAll(labelId)
      if (children.length > 0) {
        throw new DomainError(DomainErrorCode.TAG_PARENT_CATEGORY_RECORD_MISSING)
      }
    }
    await tx.objectStore(STORES.labels).delete(labelId)
    await tx.objectStore(STORES.searchDocuments).delete(searchDocumentId("LABEL", labelId))
    await tx.done
  }

  async getSchemaMeta(): Promise<PersistedSchemaMetaRecord> {
    const meta = await this.db.get(STORES.schemaMeta, "database")
    if (!meta) throw new Error("schemaMeta missing")
    return meta
  }

  async setMigrationFailed(): Promise<void> {
    const tx = this.db.transaction(STORES.schemaMeta, "readwrite")
    const meta = await tx.store.get("database")
    if (!meta) throw new Error("schemaMeta missing")
    await tx.store.put({ ...meta, migrationState: "FAILED", updatedAt: Date.now() })
    await tx.done
  }

  async recoverMigrationFromFailed(): Promise<void> {
    const tx = this.db.transaction(STORES.schemaMeta, "readwrite")
    const meta = await tx.store.get("database")
    if (!meta) throw new Error("schemaMeta missing")
    if (meta.migrationState !== "FAILED") return
    await tx.store.put({ ...meta, migrationState: "IDLE", updatedAt: Date.now() })
    await tx.done
  }

  private async collectCascadeSnapshot(
    tx: IDBPTransaction<
      import("./open-database").BookmationDbSchema,
      Array<"labels" | "bookmarkLabels" | "bookmarks" | "classificationJobs">,
      "readonly"
    >,
    category: PersistedLabelRecord,
    childTags: PersistedLabelRecord[],
  ): Promise<{
    category: PersistedLabelRecord
    childTags: PersistedLabelRecord[]
    edges: Array<{
      id: Id
      bookmarkId: Id
      labelId: Id
      revision: number
      deletedAt: EpochMs | null
    }>
    bookmarks: PersistedActiveBookmarkRecord[]
    bookmarkIds: Id[]
  }> {
    const bookmarkIds = new Set<Id>()
    const activeTags = childTags.filter((t) => t.deletedAt === null)
    for (const tag of activeTags) {
      const edges = await tx.objectStore(STORES.bookmarkLabels).index("byLabel").getAll(tag.id)
      for (const edge of edges) {
        if (edge.deletedAt !== null) continue
        const bookmark = await tx.objectStore(STORES.bookmarks).get(edge.bookmarkId)
        if (bookmark && isActiveBookmark(bookmark)) {
          bookmarkIds.add(bookmark.id)
        }
      }
    }

    const allEdges: Array<{
      id: Id
      bookmarkId: Id
      labelId: Id
      revision: number
      deletedAt: EpochMs | null
    }> = []
    const targetLabelIds = new Set([category.id, ...childTags.map((t) => t.id)])
    for (const labelId of targetLabelIds) {
      const edges = await tx.objectStore(STORES.bookmarkLabels).index("byLabel").getAll(labelId)
      for (const edge of edges) {
        allEdges.push({
          id: edge.id,
          bookmarkId: edge.bookmarkId,
          labelId: edge.labelId,
          revision: edge.revision,
          deletedAt: edge.deletedAt,
        })
      }
    }

    const bookmarks: PersistedActiveBookmarkRecord[] = []
    for (const id of bookmarkIds) {
      const b = await tx.objectStore(STORES.bookmarks).get(id)
      if (b && isActiveBookmark(b)) bookmarks.push(b)
    }

    return {
      category,
      childTags,
      edges: allEdges,
      bookmarks,
      bookmarkIds: [...bookmarkIds],
    }
  }
}

export { openBookmationDatabase }
