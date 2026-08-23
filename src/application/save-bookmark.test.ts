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

  it("applies explicit dashboard tags before returning the saved revision", async () => {
    const category = await layer.createCategory({
      creationRequestId: uuid(),
      id: uuid(),
      name: "資料"
    })
    const tag = await layer.createTag({
      creationRequestId: uuid(),
      expectedParentRevision: category.revision,
      id: uuid(),
      name: "読む",
      parentCategoryId: category.id
    })

    const result = await useCase.saveByUrl({
      creationRequestId: uuid(),
      rawUrl: "https://docs.example.com/tagged",
      tagIds: [tag.id],
      title: "タグ付き"
    })

    expect(result.revision).toBe(1)
    expect(
      (await layer.listBookmarksByLabel(tag.id, null)).items.map(
        (bookmark) => bookmark.id
      )
    ).toEqual([result.bookmarkId])
    expect(
      (await layer.listBookmarksByLabel(category.id, null)).items.map(
        (bookmark) => bookmark.id
      )
    ).toEqual([result.bookmarkId])
  })

  it("rolls back a new bookmark when an explicit tag is invalid", async () => {
    await expect(
      useCase.saveByUrl({
        creationRequestId: uuid(),
        rawUrl: "https://docs.example.com/invalid-tag",
        tagIds: [uuid()],
        title: "保存しない"
      })
    ).rejects.toMatchObject({ code: "TAG_PARENT_CATEGORY_RECORD_MISSING" })

    expect(
      await layer.findActiveBookmarkByNormalizedUrl(
        "https://docs.example.com/invalid-tag"
      )
    ).toBeUndefined()
  })
})
