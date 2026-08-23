import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CONTEXT_MENU_BOOKMARK_LINK_ID, CONTEXT_MENU_BOOKMARK_PAGE_ID } from "~/domain/context-menu"
import { DEFAULT_LOCAL_SETTINGS } from "~/domain/local-settings"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"
import { POPUP_SAVE_FEEDBACK_STORAGE_KEY } from "~/extension/popup-save-feedback"
import {
  resetSaveContextMenuDataLayerCache,
  saveFromContextMenuClick,
} from "./save-context-menu-bookmark"

function contextMenuClick(
  partial: Partial<chrome.contextMenus.OnClickData> & {
    menuItemId: string | number
  },
): chrome.contextMenus.OnClickData {
  return {
    editable: false,
    ...partial,
  }
}

describe("saveFromContextMenuClick", () => {
  let layer: Awaited<ReturnType<typeof import("~/adapters/indexeddb/local-data-layer").LocalDataLayer.open>>
  let settingsStore: LocalSettingsStore
  let sessionStorage: {
    get: ReturnType<typeof vi.fn>
    set: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    const { LocalDataLayer } = await import("~/adapters/indexeddb/local-data-layer")
    await resetSaveContextMenuDataLayerCache()
    layer = await LocalDataLayer.open()
    settingsStore = createSettingsStore(true)
    sessionStorage = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    const { DB_NAME } = await import("~/adapters/indexeddb/stores")
    await layer.close()
    await resetSaveContextMenuDataLayerCache()
    indexedDB.deleteDatabase(DB_NAME)
  })

  it("saves page context bookmark when enabled", async () => {
    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/page",
      }),
      { settingsStore, sessionStorage },
    )

    const bookmarks = await layer.listRecentBookmarks(null, 10)
    expect(bookmarks.items).toHaveLength(1)
    expect(bookmarks.items[0]?.source).toBe("CONTEXT_PAGE")
    expect(bookmarks.items[0]?.normalizedUrl).toBe("https://example.com/page")
    expect(sessionStorage.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [POPUP_SAVE_FEEDBACK_STORAGE_KEY]: expect.objectContaining({ status: "saved" }),
      }),
    )
  })

  it("saves link context bookmark with link text title", async () => {
    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_LINK_ID,
        linkUrl: "https://example.com/target",
        selectionText: "Target Page",
      }),
      { settingsStore, sessionStorage },
    )

    const bookmarks = await layer.listRecentBookmarks(null, 10)
    expect(bookmarks.items).toHaveLength(1)
    expect(bookmarks.items[0]?.source).toBe("CONTEXT_LINK")
    expect(bookmarks.items[0]?.title).toBe("Target Page")
  })

  it("does not save when setting is OFF", async () => {
    settingsStore = createSettingsStore(false)

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/page",
      }),
      { settingsStore, sessionStorage },
    )

    expect((await layer.listRecentBookmarks(null, 10)).items).toHaveLength(0)
    expect(sessionStorage.set).not.toHaveBeenCalled()
  })

  it("rejects dangerous URLs", async () => {
    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "javascript:alert(1)",
      }),
      { settingsStore, sessionStorage },
    )

    expect((await layer.listRecentBookmarks(null, 10)).items).toHaveLength(0)
    expect(sessionStorage.set).not.toHaveBeenCalled()
  })

  it("ignores unknown menu IDs", async () => {
    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: "other-menu",
        pageUrl: "https://example.com/page",
      }),
      { settingsStore, sessionStorage },
    )

    expect((await layer.listRecentBookmarks(null, 10)).items).toHaveLength(0)
    expect(sessionStorage.set).not.toHaveBeenCalled()
  })

  it("records duplicate feedback for repeated URL", async () => {
    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/dup",
      }),
      { settingsStore, sessionStorage },
    )

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/dup",
      }),
      { settingsStore, sessionStorage },
    )

    expect(sessionStorage.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        [POPUP_SAVE_FEEDBACK_STORAGE_KEY]: expect.objectContaining({ status: "duplicate" }),
      }),
    )
  })
})

function createSettingsStore(enabled: boolean): LocalSettingsStore {
  let current = { ...DEFAULT_LOCAL_SETTINGS, contextMenuBookmarkEnabled: enabled }
  return {
    async get() {
      return { ...current }
    },
    async set(settings) {
      current = { ...settings }
    },
  }
}
