import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { scheduleChromeImportMetadataFetch } from "~/adapters/chrome-bookmark-import-metadata"
import {
  commitChromeBookmarkImport,
  previewChromeBookmarkImport,
} from "~/application/chrome-bookmark-import"
import type { ChromeBookmarkImportPort } from "~/ui/features/settings/chrome-bookmark-import-port"

type IndexedDbChromeBookmarkImportPortOptions = {
  openDataLayer?: () => Promise<LocalDataLayer>
  onMetadataComplete?: () => void
}

export function createIndexedDbChromeBookmarkImportPort(
  options: IndexedDbChromeBookmarkImportPortOptions = {},
): ChromeBookmarkImportPort {
  const openDataLayer = options.openDataLayer ?? (() => LocalDataLayer.open())
  const onMetadataComplete = options.onMetadataComplete

  return {
    async preview(entries) {
      const layer = await openDataLayer()
      try {
        return await previewChromeBookmarkImport(layer, { entries })
      } finally {
        await layer.close()
      }
    },
    async commit(input) {
      const layer = await openDataLayer()
      try {
        const result = await commitChromeBookmarkImport(layer, input)
        scheduleChromeImportMetadataFetch(result.importedBookmarks, onMetadataComplete)
        return result
      } finally {
        await layer.close()
      }
    },
  }
}
