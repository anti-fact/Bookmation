import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { DB_NAME } from "~/adapters/indexeddb/stores"
import { CONTEXT_MENU_BOOKMARK_LINK_ID, CONTEXT_MENU_BOOKMARK_PAGE_ID } from "~/domain/context-menu"
import { DEFAULT_LOCAL_SETTINGS } from "~/domain/local-settings"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"
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
  let layer: LocalDataLayer
  let settingsStore: LocalSettingsStore

  beforeEach(async () => {
    await resetSaveContextMenuDataLayerCache()
    layer = await LocalDataLayer.open()
    settingsStore = createSettingsStore(true)
  })

  afterEach(async () => {
    await layer.close()
    await resetSaveContextMenuDataLayerCache()
    indexedDB.deleteDatabase(DB_NAME)
  })

  it("saves page context bookmark when enabled", async () => {
    const action = createActionMock()

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/page",
      }),
      { settingsStore, action },
    )

    const bookmarks = await layer.listRecentBookmarks(null, 10)
    expect(bookmarks.items).toHaveLength(1)
    expect(bookmarks.items[0]?.source).toBe("CONTEXT_PAGE")
    expect(bookmarks.items[0]?.normalizedUrl).toBe("https://example.com/page")
  })

  it("saves link context bookmark with link text title", async () => {
    const action = createActionMock()

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_LINK_ID,
        linkUrl: "https://example.com/target",
        selectionText: "Target Page",
      }),
      { settingsStore, action },
    )

    const bookmarks = await layer.listRecentBookmarks(null, 10)
    expect(bookmarks.items).toHaveLength(1)
    expect(bookmarks.items[0]?.source).toBe("CONTEXT_LINK")
    expect(bookmarks.items[0]?.title).toBe("Target Page")
  })

  it("does not save when setting is OFF", async () => {
    settingsStore = createSettingsStore(false)
    const action = createActionMock()

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/page",
      }),
      { settingsStore, action },
    )

    expect((await layer.listRecentBookmarks(null, 10)).items).toHaveLength(0)
    expect(action.setBadgeText).not.toHaveBeenCalled()
  })

  it("rejects dangerous URLs", async () => {
    const action = createActionMock()

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "javascript:alert(1)",
      }),
      { settingsStore, action },
    )

    expect((await layer.listRecentBookmarks(null, 10)).items).toHaveLength(0)
  })

  it("ignores unknown menu IDs", async () => {
    const action = createActionMock()

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: "other-menu",
        pageUrl: "https://example.com/page",
      }),
      { settingsStore, action },
    )

    expect((await layer.listRecentBookmarks(null, 10)).items).toHaveLength(0)
  })

  it("shows duplicate badge for repeated URL", async () => {
    const action = createActionMock()

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/dup",
      }),
      { settingsStore, action },
    )

    await saveFromContextMenuClick(
      contextMenuClick({
        menuItemId: CONTEXT_MENU_BOOKMARK_PAGE_ID,
        pageUrl: "https://example.com/dup",
      }),
      { settingsStore, action },
    )

    expect(action.setBadgeText).toHaveBeenCalledWith({ text: "済" })
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

function createActionMock() {
  return {
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setBadgeText: vi.fn().mockResolvedValue(undefined),
  }
}
