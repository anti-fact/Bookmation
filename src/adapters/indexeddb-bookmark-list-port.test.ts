import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import type { BookmarkViewMode } from "~/ui/features/bookmarks/bookmark-list-port"

import { createIndexedDbBookmarkListPort } from "./indexeddb-bookmark-list-port"

function uuid(): string {
  return crypto.randomUUID()
}

function createStorage(initial?: BookmarkViewMode) {
  const values: Record<string, unknown> = {}
  if (initial) values.bookmarkListViewMode = initial

  return {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items)
    })
  }
}

describe("IndexedDbBookmarkListPort", () => {
  let dbName: string
  let layer: LocalDataLayer

  beforeEach(async () => {
    dbName = `bookmark-list-port-${uuid()}`
    layer = await LocalDataLayer.open(dbName)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  it("loads cursor pages with active category and tag summaries", async () => {
    const category = await layer.createCategory({
      creationRequestId: uuid(),
      id: uuid(),
      name: "開発"
    })
    const tag = await layer.createTag({
      creationRequestId: uuid(),
      expectedParentRevision: category.revision,
      id: uuid(),
      name: "TypeScript",
      parentCategoryId: category.id
    })
    const older = await layer.saveBookmarkWithJob({
      creationRequestId: uuid(),
      id: uuid(),
      jobId: uuid(),
      now: 1_000,
      rawUrl: "https://older.example/article",
      title: "古い記事"
    })
    const newer = await layer.saveBookmarkWithJob({
      creationRequestId: uuid(),
      id: uuid(),
      jobId: uuid(),
      now: 2_000,
      rawUrl: "https://newer.example/article",
      siteName: "Newer",
      title: "新しい記事"
    })
    await layer.assignTagEdge({
      bookmarkId: newer.bookmark.id,
      expectedBookmarkRevision: newer.bookmark.revision,
      tagId: tag.id
    })

    const port = createIndexedDbBookmarkListPort({
      openDataLayer: async () => layer,
      storage: createStorage()
    })
    const first = await port.loadPage({
      cursor: null,
      filter: { kind: "recent" },
      limit: 1,
      requestId: "request:first"
    })

    expect(first.requestId).toBe("request:first")
    expect(first.totalCount).toBe(2)
    expect(first.items.map((item) => item.id)).toEqual([newer.bookmark.id])
    expect(first.items[0]?.categories).toEqual([
      { id: category.id, name: "開発" }
    ])
    expect(first.items[0]?.tags).toEqual([{ id: tag.id, name: "typescript" }])
    expect(first.nextCursor).not.toBeNull()

    const second = await port.loadPage({
      cursor: first.nextCursor,
      filter: { kind: "recent" },
      limit: 1,
      requestId: "request:second"
    })
    expect(second.items.map((item) => item.id)).toEqual([older.bookmark.id])
  })

  it("filters by the requested category or tag ID", async () => {
    const category = await layer.createCategory({
      creationRequestId: uuid(),
      id: uuid(),
      name: "資料"
    })
    const tag = await layer.createTag({
      creationRequestId: uuid(),
      expectedParentRevision: category.revision,
      id: uuid(),
      name: "仕様",
      parentCategoryId: category.id
    })
    const otherCategory = await layer.createCategory({
      creationRequestId: uuid(),
      id: uuid(),
      name: "別カテゴリ"
    })
    const saved = await layer.saveBookmarkWithJob({
      creationRequestId: uuid(),
      id: uuid(),
      jobId: uuid(),
      rawUrl: "https://docs.example/",
      title: "仕様書"
    })
    await layer.assignTagEdge({
      bookmarkId: saved.bookmark.id,
      expectedBookmarkRevision: saved.bookmark.revision,
      tagId: tag.id
    })
    const port = createIndexedDbBookmarkListPort({
      openDataLayer: async () => layer,
      storage: createStorage()
    })

    const byCategory = await port.loadPage({
      cursor: null,
      filter: { id: category.id, kind: "category" },
      requestId: "category-request"
    })
    const byTag = await port.loadPage({
      cursor: null,
      filter: { id: tag.id, kind: "tag" },
      requestId: "tag-request"
    })
    const byCategoryAndTag = await port.loadPage({
      cursor: null,
      filter: {
        categoryId: category.id,
        kind: "category-tag",
        tagId: tag.id
      },
      requestId: "category-tag-request"
    })
    const byMismatchedCategoryAndTag = await port.loadPage({
      cursor: null,
      filter: {
        categoryId: otherCategory.id,
        kind: "category-tag",
        tagId: tag.id
      },
      requestId: "mismatched-category-tag-request"
    })

    expect(byCategory.items.map((item) => item.id)).toEqual([saved.bookmark.id])
    expect(byTag.items.map((item) => item.id)).toEqual([saved.bookmark.id])
    expect(byCategoryAndTag.items.map((item) => item.id)).toEqual([
      saved.bookmark.id
    ])
    expect(byMismatchedCategoryAndTag.items).toEqual([])
  })

  it("defaults, validates, and persists the LIST or GRID setting", async () => {
    const storage = createStorage()
    const port = createIndexedDbBookmarkListPort({
      openDataLayer: async () => layer,
      storage
    })

    expect(await port.getViewMode()).toBe("GRID")
    await port.setViewMode("LIST")
    expect(await port.getViewMode()).toBe("LIST")
    expect(storage.set).toHaveBeenCalledWith({ bookmarkListViewMode: "LIST" })
  })

  it("resolves blob-backed image sources without exposing external URLs", async () => {
    const blobId = crypto.randomUUID()
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    const binary = atob(pngBase64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    await layer.putBlobRecord({
      id: blobId,
      kind: "THUMBNAIL",
      mimeType: "image/png",
      byteLength: bytes.byteLength,
      width: 1,
      height: 1,
      data: new Blob([bytes], { type: "image/png" }),
      contentHash: "test-hash",
    })

    const saved = await layer.saveBookmarkWithJob({
      creationRequestId: uuid(),
      id: uuid(),
      jobId: uuid(),
      rawUrl: "https://blob.example/article",
      thumbnailBlobId: blobId,
      title: "Blob 付き",
    })

    const port = createIndexedDbBookmarkListPort({
      openDataLayer: async () => layer,
      storage: createStorage(),
    })
    const page = await port.loadPage({
      cursor: null,
      filter: { kind: "recent" },
      requestId: "blob-request",
    })

    const item = page.items.find((entry) => entry.id === saved.bookmark.id)
    expect(item).toBeDefined()
    expect(
      item?.thumbnailSrc.startsWith("blob:") || item?.thumbnailSrc.startsWith("data:"),
    ).toBe(true)
    expect(item?.faviconSrc).toContain("icon.png")
    expect(item?.thumbnailSrc).not.toContain("blob.example")
    expect(item?.faviconSrc).not.toContain("blob.example")
  })
})
