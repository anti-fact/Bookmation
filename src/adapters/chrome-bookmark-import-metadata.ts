import {
  applyFaviconUrlFetch,
  applyUrlMetadataFetch,
} from "~/adapters/metadata/page-metadata"
import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { safeLogWarning } from "~/adapters/security/log-redaction"
import type { ChromeImportCommitResult } from "~/application/chrome-bookmark-import"

export type ImportedBookmarkMetadataTarget =
  ChromeImportCommitResult["importedBookmarks"][number]

export async function enrichImportedBookmarkMetadata(
  bookmark: ImportedBookmarkMetadataTarget,
): Promise<void> {
  const layer = await LocalDataLayer.open()
  try {
    if (bookmark.faviconUrl) {
      await applyFaviconUrlFetch(layer, {
        bookmarkId: bookmark.bookmarkId,
        expectedRevision: bookmark.revision,
        faviconUrl: bookmark.faviconUrl,
        fetchThumbnail: true,
        pageUrl: bookmark.rawUrl,
      })
      return
    }

    await applyUrlMetadataFetch(layer, {
      bookmarkId: bookmark.bookmarkId,
      expectedRevision: bookmark.revision,
      rawUrl: bookmark.rawUrl,
      fallbackTitle: bookmark.title,
      fetchThumbnail: true,
    })
  } finally {
    await layer.close()
  }
}

export function scheduleChromeImportMetadataFetch(
  bookmarks: readonly ImportedBookmarkMetadataTarget[],
  onComplete?: () => void,
): void {
  if (bookmarks.length === 0) {
    onComplete?.()
    return
  }

  void (async () => {
    for (const bookmark of bookmarks) {
      try {
        await enrichImportedBookmarkMetadata(bookmark)
      } catch (error: unknown) {
        safeLogWarning(
          "Chrome import metadata fetch",
          error instanceof Error ? error.message : "failed",
        )
      }
    }
    onComplete?.()
  })()
}
