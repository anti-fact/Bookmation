import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import { getVendoredAssetSha256 } from "~/domain"

import {
  BOOKMARK_INDEXES,
  BOOKMARK_LABEL_INDEXES,
  CLASSIFICATION_JOB_INDEXES,
  DB_NAME,
  DB_VERSION,
  LABEL_INDEXES,
  SEARCH_DOCUMENT_INDEXES,
  SEARCH_SCHEMA_VERSION,
  STORES,
  TAG_MUTATION_RECEIPT_INDEXES,
} from "./stores"
import type {
  PersistedActiveBookmarkRecord,
  PersistedArchivedBookmarkRecord,
  PersistedBookmarkLabelRecord,
  PersistedBookmarkRevisionRecord,
  PersistedClassificationJobRecord,
  PersistedLabelRecord,
  PersistedSchemaMetaRecord,
  PersistedSearchDocumentRecord,
  PersistedTagMutationReceiptRecord,
} from "./persisted-types"

export interface BookmationDbSchema extends DBSchema {
  bookmarks: {
    key: string
    value: PersistedActiveBookmarkRecord | PersistedArchivedBookmarkRecord
    indexes: {
      [BOOKMARK_INDEXES.byUrlHash]: string
      [BOOKMARK_INDEXES.byArchiveState]: string
      [BOOKMARK_INDEXES.byClassificationState]: string
      [BOOKMARK_INDEXES.bySavedAt]: number
      [BOOKMARK_INDEXES.byUpdatedAt]: number
    }
  }
  labels: {
    key: string
    value: PersistedLabelRecord
    indexes: {
      [LABEL_INDEXES.byNormalizedName]: string
      [LABEL_INDEXES.byKindAndName]: [string, string]
      [LABEL_INDEXES.byParentCategory]: string
      [LABEL_INDEXES.byParentCategoryAndName]: [string, string]
      [LABEL_INDEXES.byCategoryUniqueName]: string
      [LABEL_INDEXES.byTagUniqueName]: string
      [LABEL_INDEXES.byKindAndSortOrder]: [string, number]
      [LABEL_INDEXES.byOrigin]: string
      [LABEL_INDEXES.byCreationRequestId]: string
      [LABEL_INDEXES.byCascadeDeleteRequestId]: string
      [LABEL_INDEXES.byUpdatedAt]: number
    }
  }
  bookmarkLabels: {
    key: string
    value: PersistedBookmarkLabelRecord
    indexes: {
      [BOOKMARK_LABEL_INDEXES.byBookmarkAndLabel]: [string, string]
      [BOOKMARK_LABEL_INDEXES.byBookmark]: string
      [BOOKMARK_LABEL_INDEXES.byLabel]: string
      [BOOKMARK_LABEL_INDEXES.byClassificationJob]: string
    }
  }
  classificationJobs: {
    key: string
    value: PersistedClassificationJobRecord
    indexes: {
      [CLASSIFICATION_JOB_INDEXES.byStateUpdatedAt]: [string, number]
      [CLASSIFICATION_JOB_INDEXES.byBookmarkCreatedAt]: [string, number]
      [CLASSIFICATION_JOB_INDEXES.byFingerprint]: string
      [CLASSIFICATION_JOB_INDEXES.byRequestId]: string
    }
  }
  bookmarkRevisions: {
    key: string
    value: PersistedBookmarkRevisionRecord
  }
  searchDocuments: {
    key: string
    value: PersistedSearchDocumentRecord
    indexes: {
      [SEARCH_DOCUMENT_INDEXES.byEntity]: [string, string]
      [SEARCH_DOCUMENT_INDEXES.byEntityType]: string
      [SEARCH_DOCUMENT_INDEXES.bySearchKey]: string
    }
  }
  tagMutationReceipts: {
    key: string
    value: PersistedTagMutationReceiptRecord
    indexes: {
      [TAG_MUTATION_RECEIPT_INDEXES.byTagCreatedAt]: [string, number]
    }
  }
  blobs: {
    key: string
    value: Record<string, unknown>
  }
  schemaMeta: {
    key: string
    value: PersistedSchemaMetaRecord
  }
}

export type BookmationDatabase = IDBPDatabase<BookmationDbSchema>

function createStores(db: IDBPDatabase<BookmationDbSchema>): void {
  if (!db.objectStoreNames.contains(STORES.bookmarks)) {
    const store = db.createObjectStore(STORES.bookmarks, { keyPath: "id" })
    store.createIndex(BOOKMARK_INDEXES.byUrlHash, "urlHash", { unique: false })
    store.createIndex(BOOKMARK_INDEXES.byArchiveState, "archiveState", { unique: false })
    store.createIndex(BOOKMARK_INDEXES.byClassificationState, "classificationState", {
      unique: false,
    })
    store.createIndex(BOOKMARK_INDEXES.bySavedAt, "savedAt", { unique: false })
    store.createIndex(BOOKMARK_INDEXES.byUpdatedAt, "updatedAt", { unique: false })
  }

  if (!db.objectStoreNames.contains(STORES.labels)) {
    const store = db.createObjectStore(STORES.labels, { keyPath: "id" })
    store.createIndex(LABEL_INDEXES.byNormalizedName, "normalizedName", { unique: false })
    store.createIndex(LABEL_INDEXES.byKindAndName, ["kind", "normalizedName"], { unique: false })
    store.createIndex(LABEL_INDEXES.byParentCategory, "parentCategoryId", { unique: false })
    store.createIndex(LABEL_INDEXES.byParentCategoryAndName, ["parentCategoryId", "normalizedName"], {
      unique: false,
    })
    store.createIndex(LABEL_INDEXES.byCategoryUniqueName, "categoryUniqueName", { unique: true })
    store.createIndex(LABEL_INDEXES.byTagUniqueName, "tagUniqueName", { unique: true })
    store.createIndex(LABEL_INDEXES.byKindAndSortOrder, ["kind", "sortOrder"], { unique: false })
    store.createIndex(LABEL_INDEXES.byOrigin, "origin", { unique: false })
    store.createIndex(LABEL_INDEXES.byCreationRequestId, "creationRequestId", { unique: true })
    store.createIndex(LABEL_INDEXES.byCascadeDeleteRequestId, "cascadeDeleteRequestId", {
      unique: false,
    })
    store.createIndex(LABEL_INDEXES.byUpdatedAt, "updatedAt", { unique: false })
  }

  if (!db.objectStoreNames.contains(STORES.bookmarkLabels)) {
    const store = db.createObjectStore(STORES.bookmarkLabels, { keyPath: "id" })
    store.createIndex(BOOKMARK_LABEL_INDEXES.byBookmarkAndLabel, ["bookmarkId", "labelId"], {
      unique: true,
    })
    store.createIndex(BOOKMARK_LABEL_INDEXES.byBookmark, "bookmarkId", { unique: false })
    store.createIndex(BOOKMARK_LABEL_INDEXES.byLabel, "labelId", { unique: false })
    store.createIndex(BOOKMARK_LABEL_INDEXES.byClassificationJob, "classificationJobId", {
      unique: false,
    })
  }

  if (!db.objectStoreNames.contains(STORES.classificationJobs)) {
    const store = db.createObjectStore(STORES.classificationJobs, { keyPath: "id" })
    store.createIndex(CLASSIFICATION_JOB_INDEXES.byStateUpdatedAt, ["state", "updatedAt"], {
      unique: false,
    })
    store.createIndex(CLASSIFICATION_JOB_INDEXES.byBookmarkCreatedAt, ["bookmarkId", "createdAt"], {
      unique: false,
    })
    store.createIndex(CLASSIFICATION_JOB_INDEXES.byFingerprint, "inputFingerprint", {
      unique: false,
    })
    store.createIndex(CLASSIFICATION_JOB_INDEXES.byRequestId, "requestId", { unique: true })
  }

  if (!db.objectStoreNames.contains(STORES.bookmarkRevisions)) {
    db.createObjectStore(STORES.bookmarkRevisions, { keyPath: "id" })
  }

  if (!db.objectStoreNames.contains(STORES.searchDocuments)) {
    const store = db.createObjectStore(STORES.searchDocuments, { keyPath: "id" })
    store.createIndex(SEARCH_DOCUMENT_INDEXES.byEntity, ["entityType", "entityId"], {
      unique: true,
    })
    store.createIndex(SEARCH_DOCUMENT_INDEXES.byEntityType, "entityType", { unique: false })
    store.createIndex(SEARCH_DOCUMENT_INDEXES.bySearchKey, "searchKeys", {
      unique: false,
      multiEntry: true,
    })
  }

  if (!db.objectStoreNames.contains(STORES.tagMutationReceipts)) {
    const store = db.createObjectStore(STORES.tagMutationReceipts, { keyPath: "id" })
    store.createIndex(TAG_MUTATION_RECEIPT_INDEXES.byTagCreatedAt, ["tagId", "createdAt"], {
      unique: false,
    })
  }

  if (!db.objectStoreNames.contains(STORES.blobs)) {
    db.createObjectStore(STORES.blobs, { keyPath: "id" })
  }

  if (!db.objectStoreNames.contains(STORES.schemaMeta)) {
    db.createObjectStore(STORES.schemaMeta, { keyPath: "key" })
  }
}

async function initSchemaMeta(
  db: IDBPDatabase<BookmationDbSchema>,
  now: number,
): Promise<void> {
  const tx = db.transaction(STORES.schemaMeta, "readwrite")
  const existing = await tx.store.get("database")
  if (existing) {
    await tx.done
    return
  }
  const meta: PersistedSchemaMetaRecord = {
    key: "database",
    schemaVersion: 1,
    normalizationVersion: 1,
    unicodeVersion: "15.1.0",
    unicodeDataAssetSha256: getVendoredAssetSha256(),
    searchSchemaVersion: SEARCH_SCHEMA_VERSION,
    migrationState: "IDLE",
    migrationId: null,
    migrationCursor: null,
    updatedAt: now,
  }
  await tx.store.put(meta)
  await tx.done
}

export interface OpenDatabaseOptions {
  dbName?: string
  version?: number
}

export async function openBookmationDatabase(
  options: OpenDatabaseOptions = {},
): Promise<BookmationDatabase> {
  const dbName = options.dbName ?? DB_NAME
  const version = options.version ?? DB_VERSION

  const db = await openDB<BookmationDbSchema>(dbName, version, {
    upgrade(upgradeDb) {
      createStores(upgradeDb)
    },
  })

  await initSchemaMeta(db, Date.now())
  return db
}

export async function deleteBookmationDatabase(dbName = DB_NAME): Promise<void> {
  await openDB(dbName).then((db) => db.close())
  indexedDB.deleteDatabase(dbName)
}
