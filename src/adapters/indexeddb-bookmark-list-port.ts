import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import type {
  PersistedActiveBookmarkRecord,
  PersistedLabelRecord
} from "~/adapters/indexeddb/persisted-types"
import { STORES } from "~/adapters/indexeddb/stores"
import type {
  BookmarkListCursor,
  BookmarkListItem,
  BookmarkListPort,
  BookmarkViewMode,
  LoadBookmarkPageInput
} from "~/ui/features/bookmarks/bookmark-list-port"

const VIEW_MODE_STORAGE_KEY = "bookmarkListViewMode"
const DEFAULT_PAGE_SIZE = 18
const MAX_PAGE_SIZE = 50

type BookmarkListStorage = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

type IndexedDbBookmarkListPortOptions = {
  openDataLayer?: () => Promise<LocalDataLayer>
  storage: BookmarkListStorage
}

function isViewMode(value: unknown): value is BookmarkViewMode {
  return value === "GRID" || value === "LIST"
}

function sortRecent(
  left: PersistedActiveBookmarkRecord,
  right: PersistedActiveBookmarkRecord
): number {
  if (right.savedAt !== left.savedAt) {
    return right.savedAt - left.savedAt
  }
  return right.id.localeCompare(left.id)
}

function pageAfterCursor(
  records: PersistedActiveBookmarkRecord[],
  cursor: BookmarkListCursor | null,
  limit: number
): {
  items: PersistedActiveBookmarkRecord[]
  nextCursor: BookmarkListCursor | null
} {
  const sorted = [...records].sort(sortRecent)
  let startIndex = 0

  if (cursor) {
    startIndex = sorted.findIndex(
      (bookmark) =>
        bookmark.savedAt < cursor.savedAt ||
        (bookmark.savedAt === cursor.savedAt && bookmark.id < cursor.id)
    )
    if (startIndex === -1) {
      startIndex = sorted.length
    }
  }

  const items = sorted.slice(startIndex, startIndex + limit)
  const last = items.at(-1)
  const nextCursor =
    items.length === limit && last
      ? { id: last.id, savedAt: last.savedAt }
      : null

  return { items, nextCursor }
}

async function activeBookmarks(
  layer: LocalDataLayer
): Promise<PersistedActiveBookmarkRecord[]> {
  const records = await layer.rawDb.getAllFromIndex(
    STORES.bookmarks,
    "byArchiveState",
    "ACTIVE"
  )

  return records.filter(
    (record): record is PersistedActiveBookmarkRecord =>
      record.archiveState === "ACTIVE" && record.deletedAt === null
  )
}

async function bookmarksForLabel(
  layer: LocalDataLayer,
  input: LoadBookmarkPageInput,
  limit: number
): Promise<{
  items: PersistedActiveBookmarkRecord[]
  nextCursor: BookmarkListCursor | null
  totalCount: number
}> {
  if (input.filter.kind === "recent") {
    const [page, allActive] = await Promise.all([
      layer.listRecentBookmarks(input.cursor, limit),
      activeBookmarks(layer)
    ])
    return { ...page, totalCount: allActive.length }
  }

  const requestedLabels: Array<{
    expectedKind: PersistedLabelRecord["kind"]
    id: string
  }> =
    input.filter.kind === "category-tag"
      ? [
          { expectedKind: "CATEGORY", id: input.filter.categoryId },
          { expectedKind: "TAG", id: input.filter.tagId }
        ]
      : [
          {
            expectedKind:
              input.filter.kind === "category" ? "CATEGORY" : "TAG",
            id: input.filter.id
          }
        ]
  const filterLabels = await Promise.all(
    requestedLabels.map(({ id }) => layer.rawDb.get(STORES.labels, id))
  )
  if (
    filterLabels.some((label, index) => {
      const requestedLabel = requestedLabels[index]
      return (
        !label ||
        label.deletedAt !== null ||
        label.kind !== requestedLabel?.expectedKind
      )
    })
  ) {
    return { items: [], nextCursor: null, totalCount: 0 }
  }

  const edgeGroups = await Promise.all(
    requestedLabels.map(({ id }) =>
      layer.rawDb.getAllFromIndex(STORES.bookmarkLabels, "byLabel", id)
    )
  )
  const activeIdGroups = edgeGroups.map(
    (edges) =>
      new Set(
        edges
          .filter((edge) => edge.deletedAt === null)
          .map((edge) => edge.bookmarkId)
      )
  )
  const filtered = (await activeBookmarks(layer)).filter((bookmark) =>
    activeIdGroups.every((activeIds) => activeIds.has(bookmark.id))
  )
  const page = pageAfterCursor(filtered, input.cursor, limit)

  return { ...page, totalCount: filtered.length }
}

function sortLabels(
  left: PersistedLabelRecord,
  right: PersistedLabelRecord
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }
  const byName = left.name.localeCompare(right.name, "ja")
  return byName === 0 ? left.id.localeCompare(right.id) : byName
}

async function toListItems(
  layer: LocalDataLayer,
  records: PersistedActiveBookmarkRecord[]
): Promise<BookmarkListItem[]> {
  const tx = layer.rawDb.transaction(
    [STORES.bookmarkLabels, STORES.labels],
    "readonly"
  )
  const edgeIndex = tx.objectStore(STORES.bookmarkLabels).index("byBookmark")
  const labelStore = tx.objectStore(STORES.labels)
  const labelCache = new Map<string, PersistedLabelRecord | undefined>()

  const items = await Promise.all(
    records.map(async (bookmark) => {
      const edges = (await edgeIndex.getAll(bookmark.id)).filter(
        (edge) => edge.deletedAt === null
      )
      const labels = (
        await Promise.all(
          edges.map(async (edge) => {
            if (!labelCache.has(edge.labelId)) {
              labelCache.set(edge.labelId, await labelStore.get(edge.labelId))
            }
            return labelCache.get(edge.labelId)
          })
        )
      ).filter(
        (label): label is PersistedLabelRecord =>
          Boolean(label) && label?.deletedAt === null
      )
      const categories = labels
        .filter((label) => label.kind === "CATEGORY")
        .sort(sortLabels)
        .map(({ id, name }) => ({ id, name }))
      const tags = labels
        .filter((label) => label.kind === "TAG")
        .sort(sortLabels)
        .map(({ id, name }) => ({ id, name }))

      return {
        categories,
        faviconUrl: null,
        id: bookmark.id,
        savedAt: bookmark.savedAt,
        siteName: bookmark.siteName,
        tags,
        thumbnailUrl: null,
        title: bookmark.title,
        url: bookmark.normalizedUrl
      }
    })
  )

  await tx.done
  return items
}

export function createIndexedDbBookmarkListPort({
  openDataLayer = () => LocalDataLayer.open(),
  storage
}: IndexedDbBookmarkListPortOptions): BookmarkListPort {
  let layerPromise: Promise<LocalDataLayer> | null = null
  const getLayer = () => {
    layerPromise ??= openDataLayer()
    return layerPromise
  }

  return {
    async getViewMode() {
      const stored = await storage.get(VIEW_MODE_STORAGE_KEY)
      const value = stored[VIEW_MODE_STORAGE_KEY]
      return isViewMode(value) ? value : "GRID"
    },

    async loadPage(input) {
      const layer = await getLayer()
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE)
      )
      const page = await bookmarksForLabel(layer, input, limit)
      const items = await toListItems(layer, page.items)

      return {
        items,
        nextCursor: page.nextCursor,
        requestId: input.requestId,
        totalCount: page.totalCount
      }
    },

    async setViewMode(mode) {
      await storage.set({ [VIEW_MODE_STORAGE_KEY]: mode })
    }
  }
}
