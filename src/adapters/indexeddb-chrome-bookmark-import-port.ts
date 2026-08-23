import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import {
  commitChromeBookmarkImport,
  previewChromeBookmarkImport,
} from "~/application/chrome-bookmark-import"
import type { ChromeBookmarkImportPort } from "~/ui/features/settings/chrome-bookmark-import-port"

type IndexedDbChromeBookmarkImportPortOptions = {
  openDataLayer?: () => Promise<LocalDataLayer>
}

export function createIndexedDbChromeBookmarkImportPort(
  options: IndexedDbChromeBookmarkImportPortOptions = {},
): ChromeBookmarkImportPort {
  const openDataLayer = options.openDataLayer ?? (() => LocalDataLayer.open())

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
        return await commitChromeBookmarkImport(layer, input)
      } finally {
        await layer.close()
      }
    },
  }
}
