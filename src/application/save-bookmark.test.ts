import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"

import { SaveBookmarkUseCase } from "./save-bookmark"

function uuid(): string {
  return crypto.randomUUID()
}

describe("SaveBookmarkUseCase", () => {
  let dbName: string
  let layer: LocalDataLayer
  let useCase: SaveBookmarkUseCase

  beforeEach(async () => {
    dbName = `bookmation-app-test-${uuid()}`
    layer = await LocalDataLayer.open(dbName)
    useCase = new SaveBookmarkUseCase(layer)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  it("saves current tab bookmark with PENDING job", async () => {
    const result = await useCase.saveCurrentTab({
      rawUrl: "https://example.com/page",
      title: "Example Page",
      creationRequestId: uuid(),
    })

    expect(result.duplicate).toBe(false)
    expect(result.title).toBe("Example Page")

    const loaded = await layer.getBookmark(result.bookmarkId)
    expect(loaded?.source).toBe("CURRENT_TAB")
    expect(loaded?.classificationState).toBe("PENDING")
  })

  it("returns duplicate when the same URL is saved again", async () => {
    const requestA = uuid()
    const first = await useCase.saveByUrl({
      rawUrl: "https://example.com/dup",
      creationRequestId: requestA,
    })

    const second = await useCase.saveByUrl({
      rawUrl: "https://example.com/dup",
      creationRequestId: uuid(),
    })

    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(second.bookmarkId).toBe(first.bookmarkId)
  })

  it("uses hostname when title is empty for URL save", async () => {
    const result = await useCase.saveByUrl({
      rawUrl: "https://docs.example.com/guide",
      title: "",
      creationRequestId: uuid(),
    })

    expect(result.title).toBe("docs.example.com")
  })

  it("saves context page bookmark with CONTEXT_PAGE source", async () => {
    const result = await useCase.saveFromContextPage({
      rawUrl: "https://example.com/context-page",
      creationRequestId: uuid(),
    })

    const loaded = await layer.getBookmark(result.bookmarkId)
    expect(loaded?.source).toBe("CONTEXT_PAGE")
  })

  it("saves context link bookmark with CONTEXT_LINK source", async () => {
    const result = await useCase.saveFromContextLink({
      rawUrl: "https://example.com/context-link",
      title: "Link title",
      creationRequestId: uuid(),
    })

    const loaded = await layer.getBookmark(result.bookmarkId)
    expect(loaded?.source).toBe("CONTEXT_LINK")
    expect(result.title).toBe("Link title")
  })
})
