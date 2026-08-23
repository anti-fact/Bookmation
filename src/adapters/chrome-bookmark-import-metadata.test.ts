import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "fake-indexeddb/auto"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { enrichImportedBookmarkMetadata } from "~/adapters/chrome-bookmark-import-metadata"
import * as pageMetadata from "~/adapters/metadata/page-metadata"

describe("enrichImportedBookmarkMetadata", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses favicon URL from Chrome export when available", async () => {
    const applyFavicon = vi.spyOn(pageMetadata, "applyFaviconUrlFetch").mockResolvedValue()
    const applyUrl = vi.spyOn(pageMetadata, "applyUrlMetadataFetch").mockResolvedValue()

    await enrichImportedBookmarkMetadata({
      bookmarkId: "bookmark-1",
      revision: 1,
      rawUrl: "https://example.com",
      title: "Example",
      faviconUrl: "data:image/png;base64,AA==",
    })

    expect(applyFavicon).toHaveBeenCalledWith(expect.any(LocalDataLayer), {
      bookmarkId: "bookmark-1",
      expectedRevision: 1,
      faviconUrl: "data:image/png;base64,AA==",
      fetchThumbnail: true,
      pageUrl: "https://example.com",
    })
    expect(applyUrl).not.toHaveBeenCalled()
  })

  it("falls back to page metadata fetch without favicon URL", async () => {
    const applyFavicon = vi.spyOn(pageMetadata, "applyFaviconUrlFetch").mockResolvedValue()
    const applyUrl = vi.spyOn(pageMetadata, "applyUrlMetadataFetch").mockResolvedValue()

    await enrichImportedBookmarkMetadata({
      bookmarkId: "bookmark-2",
      revision: 1,
      rawUrl: "https://example.com/page",
      title: "Example page",
      faviconUrl: null,
    })

    expect(applyUrl).toHaveBeenCalledWith(expect.any(LocalDataLayer), {
      bookmarkId: "bookmark-2",
      expectedRevision: 1,
      rawUrl: "https://example.com/page",
      fallbackTitle: "Example page",
      fetchThumbnail: true,
    })
    expect(applyFavicon).not.toHaveBeenCalled()
  })
})
