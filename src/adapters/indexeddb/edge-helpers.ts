import type { IDBPTransaction } from "idb"

import type { Id, EpochMs, EntityOrigin } from "~/domain"
import { DomainError, DomainErrorCode, nextRevision } from "~/domain"

import type { BookmationDbSchema } from "./open-database"
import { STORES, type StoreName } from "./stores"
import type {
  PersistedActiveBookmarkRecord,
  PersistedBookmarkLabelRecord,
  PersistedLabelRecord,
} from "./persisted-types"
import { assertPersistableDocument, stripUndefinedFields } from "./document-validation"

type LabelTx = IDBPTransaction<
  BookmationDbSchema,
  Array<"labels" | "bookmarkLabels" | "bookmarks">,
  "readonly" | "readwrite"
>

type ReadWriteTx = IDBPTransaction<BookmationDbSchema, StoreName[], "readwrite">

export function isActiveBookmark(
  record: PersistedActiveBookmarkRecord | { archiveState: string; deletedAt?: EpochMs | null },
): record is PersistedActiveBookmarkRecord {
  return (
    record.archiveState === "ACTIVE" &&
    ("deletedAt" in record ? record.deletedAt === null : true)
  )
}

export async function getLabelOrThrow(
  tx: LabelTx | ReadWriteTx,
  labelId: Id,
): Promise<PersistedLabelRecord> {
  const label = await (tx as LabelTx).objectStore(STORES.labels).get(labelId)
  if (!label) {
    throw new DomainError(DomainErrorCode.TAG_PARENT_CATEGORY_RECORD_MISSING, labelId)
  }
  return label
}

export async function getActiveBookmarkOrThrow(
  tx: ReadWriteTx,
  bookmarkId: Id,
): Promise<PersistedActiveBookmarkRecord> {
  const bookmark = await tx.objectStore(STORES.bookmarks).get(bookmarkId)
  if (!bookmark || bookmark.archiveState !== "ACTIVE" || bookmark.deletedAt !== null) {
    throw new DomainError(DomainErrorCode.INVALID_ID, `Active bookmark not found: ${bookmarkId}`)
  }
  return bookmark
}

export async function getEdgeByPair(
  tx: ReadWriteTx,
  bookmarkId: Id,
  labelId: Id,
): Promise<PersistedBookmarkLabelRecord | undefined> {
  const index = tx.objectStore(STORES.bookmarkLabels).index("byBookmarkAndLabel")
  return index.get([bookmarkId, labelId])
}

export async function listEdgesForBookmark(
  tx: ReadWriteTx,
  bookmarkId: Id,
): Promise<PersistedBookmarkLabelRecord[]> {
  const index = tx.objectStore(STORES.bookmarkLabels).index("byBookmark")
  return index.getAll(bookmarkId)
}

export async function listActiveTagEdgesForBookmark(
  tx: ReadWriteTx,
  bookmarkId: Id,
): Promise<PersistedBookmarkLabelRecord[]> {
  const edges = await listEdgesForBookmark(tx, bookmarkId)
  const result: PersistedBookmarkLabelRecord[] = []
  for (const edge of edges) {
    if (edge.deletedAt !== null) continue
    const label = await getLabelOrThrow(tx, edge.labelId)
    if (label.kind === "TAG" && label.deletedAt === null) {
      result.push(edge)
    }
  }
  return result
}

export async function listActiveCategoryAndTagIds(
  tx: ReadWriteTx,
  bookmarkId: Id,
): Promise<{ categoryIds: Id[]; tagIds: Id[] }> {
  const edges = await listEdgesForBookmark(tx, bookmarkId)
  const categoryIds: Id[] = []
  const tagIds: Id[] = []
  for (const edge of edges) {
    if (edge.deletedAt !== null) continue
    const label = await getLabelOrThrow(tx, edge.labelId)
    if (label.deletedAt !== null) continue
    if (label.kind === "CATEGORY") categoryIds.push(label.id)
    if (label.kind === "TAG") tagIds.push(label.id)
  }
  categoryIds.sort()
  tagIds.sort()
  return { categoryIds, tagIds }
}

/** active Tag edge の親 Category ID 集合へ Category edge を同期 */
export async function syncCategoryEdgesFromTags(
  tx: ReadWriteTx,
  bookmark: PersistedActiveBookmarkRecord,
  now: EpochMs,
  assignedBy: EntityOrigin = "USER",
): Promise<PersistedActiveBookmarkRecord> {
  const tagEdges = await listActiveTagEdgesForBookmark(tx, bookmark.id)
  const requiredCategoryIds = new Set<Id>()
  for (const edge of tagEdges) {
    const tag = await getLabelOrThrow(tx, edge.labelId)
    if (tag.parentCategoryId) {
      requiredCategoryIds.add(tag.parentCategoryId)
    }
  }

  const allEdges = await listEdgesForBookmark(tx, bookmark.id)
  for (const edge of allEdges) {
    if (edge.deletedAt !== null) continue
    const label = await getLabelOrThrow(tx, edge.labelId)
    if (label.kind !== "CATEGORY") continue
    if (!requiredCategoryIds.has(label.id)) {
      const updated: PersistedBookmarkLabelRecord = {
        ...edge,
        deletedAt: now,
        updatedAt: now,
        revision: nextRevision(edge.revision),
      }
      assertPersistableDocument(STORES.bookmarkLabels, updated)
      await tx.objectStore(STORES.bookmarkLabels).put(updated)
    }
  }

  for (const categoryId of requiredCategoryIds) {
    const existing = await getEdgeByPair(tx, bookmark.id, categoryId)
    if (existing) {
      if (existing.deletedAt !== null) {
        const restored: PersistedBookmarkLabelRecord = {
          ...existing,
          deletedAt: null,
          updatedAt: now,
          revision: nextRevision(existing.revision),
        }
        assertPersistableDocument(STORES.bookmarkLabels, restored)
        await tx.objectStore(STORES.bookmarkLabels).put(restored)
      }
      continue
    }
    const edge: PersistedBookmarkLabelRecord = {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      bookmarkId: bookmark.id,
      labelId: categoryId,
      assignedBy,
      confidence: null,
      classificationJobId: null,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      deletedAt: null,
    }
    assertPersistableDocument(STORES.bookmarkLabels, edge)
    await tx.objectStore(STORES.bookmarkLabels).put(edge)
  }

  return bookmark
}

export async function putBookmark(
  tx: ReadWriteTx,
  bookmark: PersistedActiveBookmarkRecord,
): Promise<void> {
  const doc = stripUndefinedFields(bookmark as unknown as Record<string, unknown>)
  assertPersistableDocument(STORES.bookmarks, doc)
  await tx.objectStore(STORES.bookmarks).put(doc as unknown as PersistedActiveBookmarkRecord)
}

export async function putLabel(tx: ReadWriteTx, label: PersistedLabelRecord): Promise<void> {
  const doc = stripUndefinedFields(label as unknown as Record<string, unknown>)
  assertPersistableDocument(STORES.labels, doc)
  await tx.objectStore(STORES.labels).put(doc as unknown as PersistedLabelRecord)
}

export async function putEdge(
  tx: ReadWriteTx,
  edge: PersistedBookmarkLabelRecord,
): Promise<void> {
  const doc = stripUndefinedFields(edge as unknown as Record<string, unknown>)
  assertPersistableDocument(STORES.bookmarkLabels, doc)
  await tx.objectStore(STORES.bookmarkLabels).put(doc as unknown as PersistedBookmarkLabelRecord)
}

export function assertRevisionMatch(actual: number, expected: number, entity: string): void {
  if (actual !== expected) {
    throw new DomainError(
      DomainErrorCode.REVISION_CONFLICT,
      `${entity} revision mismatch: expected ${expected}, got ${actual}`,
    )
  }
}

export function assertRequestIdNamespace(
  requestId: string,
  prefix: "tag-update:" | "category-delete:",
): void {
  if (!requestId.startsWith(prefix)) {
    throw new DomainError(
      DomainErrorCode.REQUEST_ID_NAMESPACE_INVALID,
      `requestId must start with ${prefix}`,
    )
  }
}
