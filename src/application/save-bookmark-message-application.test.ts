import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createSaveBookmarkMessageApplication,
  resetSaveBookmarkDataLayerCache,
} from "~/application/save-bookmark-message-application"
import { EXTENSION_MESSAGE_SCHEMA_VERSION } from "~/extension/messages"

describe("createSaveBookmarkMessageApplication", () => {
  beforeEach(async () => {
    await resetSaveBookmarkDataLayerCache()
    vi.stubGlobal("chrome", {
      action: {
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
        setBadgeText: vi.fn().mockResolvedValue(undefined),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([]),
      },
    })
  })

  afterEach(async () => {
    await resetSaveBookmarkDataLayerCache()
    indexedDB.deleteDatabase("bookmation")
    vi.unstubAllGlobals()
  })

  it("saves a bookmark from popup tab snapshot", async () => {
    const app = createSaveBookmarkMessageApplication({
      action: chrome.action,
      tabs: chrome.tabs,
    })

    const response = await app.handle({
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      action: "save-current-tab",
      source: "popup",
      requestId: "popup-save:test-1",
      payload: {
        rawUrl: "https://example.com/article",
        title: "Example Article",
      },
    })

    expect(response.ok).toBe(true)
    if (response.ok) {
      expect(response.data).toMatchObject({
        status: "saved",
        title: "Example Article",
      })
    }
    expect(chrome.tabs.query).not.toHaveBeenCalled()
  })

  it("lists recent bookmarks after dashboard save", async () => {
    const app = createSaveBookmarkMessageApplication({
      action: chrome.action,
      tabs: chrome.tabs,
    })

    const saveResponse = await app.handle({
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      action: "save-bookmark-by-url",
      source: "dashboard",
      requestId: "dashboard-save:test-1",
      payload: {
        url: "https://example.com/list-test",
        title: "List Test",
      },
    })
    expect(saveResponse.ok).toBe(true)

    const listResponse = await app.handle({
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      action: "list-bookmarks",
      source: "dashboard",
      requestId: "dashboard-list:test-1",
      payload: { limit: 5 },
    })

    expect(listResponse.ok).toBe(true)
    if (listResponse.ok) {
      const data = listResponse.data as { items: Array<{ title: string }> }
      expect(data.items.some((item) => item.title === "List Test")).toBe(true)
    }
  })
})
