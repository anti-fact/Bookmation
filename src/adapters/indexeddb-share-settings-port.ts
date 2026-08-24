import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import type {
  PersistedActiveBookmarkRecord,
  PersistedLabelRecord
} from "~/adapters/indexeddb/persisted-types"
import { STORES } from "~/adapters/indexeddb/stores"
import type {
  ShareSelectionItem,
  ShareSettingsPort,
  ShareSettingsSnapshot
} from "~/ui/features/settings/share-settings-port"

type IndexedDbShareSettingsPortOptions = {
  openDataLayer?: () => Promise<LocalDataLayer>
}

function isActiveBookmark(
  value: unknown
): value is PersistedActiveBookmarkRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<PersistedActiveBookmarkRecord>
  return record.archiveState === "ACTIVE" && record.deletedAt === null
}

function labelOrder(left: PersistedLabelRecord, right: PersistedLabelRecord) {
  if (left.kind !== right.kind) return left.kind === "CATEGORY" ? -1 : 1
  if (left.sortOrder !== right.sortOrder)
    return left.sortOrder - right.sortOrder
  return (
    left.name.localeCompare(right.name, "ja") || left.id.localeCompare(right.id)
  )
}

function bookmarkOrder(
  left: PersistedActiveBookmarkRecord,
  right: PersistedActiveBookmarkRecord
) {
  return right.savedAt - left.savedAt || right.id.localeCompare(left.id)
}

function bookmarkDescription(bookmark: PersistedActiveBookmarkRecord): string {
  if (bookmark.siteName?.trim()) return bookmark.siteName
  try {
    return new URL(bookmark.normalizedUrl).hostname
  } catch {
    return bookmark.normalizedUrl
  }
}

async function loadSelectionItems(
  layer: LocalDataLayer
): Promise<ShareSelectionItem[]> {
  const [bookmarkRecords, labelRecords, edgeRecords] = await Promise.all([
    layer.rawDb.getAll(STORES.bookmarks),
    layer.rawDb.getAll(STORES.labels),
    layer.rawDb.getAll(STORES.bookmarkLabels)
  ])
  const bookmarks = bookmarkRecords.filter(isActiveBookmark).sort(bookmarkOrder)
  const activeBookmarkIds = new Set(bookmarks.map((bookmark) => bookmark.id))
  const bookmarkIdsByLabel = new Map<string, string[]>()

  for (const edge of edgeRecords) {
    if (edge.deletedAt !== null || !activeBookmarkIds.has(edge.bookmarkId)) {
      continue
    }
    const ids = bookmarkIdsByLabel.get(edge.labelId) ?? []
    if (!ids.includes(edge.bookmarkId)) ids.push(edge.bookmarkId)
    bookmarkIdsByLabel.set(edge.labelId, ids)
  }

  const labelItems = labelRecords
    .filter((label) => label.deletedAt === null)
    .sort(labelOrder)
    .flatMap((label): ShareSelectionItem[] => {
      const bookmarkIds = bookmarkIdsByLabel.get(label.id) ?? []
      return bookmarkIds.length
        ? [
            {
              bookmarkIds,
              id: label.id,
              kind: label.kind,
              label: label.name
            }
          ]
        : []
    })
  const bookmarkItems = bookmarks.map(
    (bookmark): ShareSelectionItem => ({
      bookmarkIds: [bookmark.id],
      description: bookmarkDescription(bookmark),
      id: bookmark.id,
      kind: "BOOKMARK",
      label: bookmark.title
    })
  )

  return [...labelItems, ...bookmarkItems]
}

function unavailable(): never {
  throw new Error("この共有操作は現在利用できません。")
}

export function createIndexedDbShareSettingsPort(
  options: IndexedDbShareSettingsPortOptions = {}
): ShareSettingsPort {
  const openDataLayer = options.openDataLayer ?? (() => LocalDataLayer.open())
  let layerPromise: Promise<LocalDataLayer> | null = null
  const getLayer = () => {
    layerPromise ??= openDataLayer()
    return layerPromise
  }
  const load = async (): Promise<ShareSettingsSnapshot> => ({
    drive: null,
    items: await loadSelectionItems(await getLayer())
  })

  return {
    load,
    async connectDrive() {
      return unavailable()
    },
    async exportBookmarks() {
      return unavailable()
    },
    async openQrReader() {
      return unavailable()
    }
  }
}
