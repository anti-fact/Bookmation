import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"

import { createIndexedDbShareSettingsPort } from "./indexeddb-share-settings-port"

function uuid(): string {
  return crypto.randomUUID()
}

describe("createIndexedDbShareSettingsPort", () => {
  let dbName: string
  let layer: LocalDataLayer

  beforeEach(async () => {
    dbName = `share-settings-port-${uuid()}`
    layer = await LocalDataLayer.open(dbName)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  it("loads active individual bookmarks and only labels that can select them", async () => {
    const category = await layer.createCategory({
      creationRequestId: uuid(),
      id: uuid(),
      name: "開発"
    })
    await layer.createCategory({
      creationRequestId: uuid(),
      id: uuid(),
      name: "未使用"
    })
    const tag = await layer.createTag({
      creationRequestId: uuid(),
      expectedParentRevision: category.revision,
      id: uuid(),
      name: "TypeScript",
      parentCategoryId: category.id
    })
    const saved = await layer.saveBookmarkWithJob({
      creationRequestId: uuid(),
      id: uuid(),
      jobId: uuid(),
      now: 1_000,
      rawUrl: "https://www.typescriptlang.org/docs/handbook/",
      siteName: "typescriptlang.org",
      title: "TypeScript Handbook"
    })
    await layer.assignTagEdge({
      bookmarkId: saved.bookmark.id,
      expectedBookmarkRevision: saved.bookmark.revision,
      tagId: tag.id
    })

    const port = createIndexedDbShareSettingsPort({
      openDataLayer: async () => layer
    })
    const snapshot = await port.load()

    expect(snapshot.drive).toBeNull()
    expect(snapshot.items).toEqual([
      {
        bookmarkIds: [saved.bookmark.id],
        id: category.id,
        kind: "CATEGORY",
        label: "開発"
      },
      {
        bookmarkIds: [saved.bookmark.id],
        id: tag.id,
        kind: "TAG",
        label: "typescript"
      },
      {
        bookmarkIds: [saved.bookmark.id],
        description: "typescriptlang.org",
        id: saved.bookmark.id,
        kind: "BOOKMARK",
        label: "TypeScript Handbook"
      }
    ])
  })
})
