import { describe, expect, it, vi } from "vitest"

import { EXTENSION_COMMANDS } from "~/extension/commands"

import { createChromePopupPort, type PopupChromeApi } from "./chrome-popup-port"

function createChromeApi(): PopupChromeApi {
  const sessionValues = new Map<string, unknown>()
  const sessionListeners: Array<
    (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
  > = []

  return {
    commands: {
      getAll: vi.fn().mockResolvedValue([])
    },
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      sendMessage: vi.fn()
    },
    storage: {
      session: {
        get: vi.fn(async (key: string) => {
          const value = sessionValues.get(key)
          return value === undefined ? {} : { [key]: value }
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            sessionValues.set(key, value)
            const changes = {
              [key]: { newValue: value },
            }
            for (const listener of sessionListeners) {
              listener(changes, "session")
            }
          }
        }),
        remove: vi.fn(async (key: string) => {
          sessionValues.delete(key)
        }),
        onChanged: {
          addListener: vi.fn((listener) => {
            sessionListeners.push(listener)
          }),
          removeListener: vi.fn((listener) => {
            const index = sessionListeners.indexOf(listener)
            if (index >= 0) {
              sessionListeners.splice(index, 1)
            }
          }),
        },
      },
    },
    tabs: {
      create: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined)
    },
    windows: {
      update: vi.fn().mockResolvedValue(undefined)
    }
  } as unknown as PopupChromeApi
}

describe("createChromePopupPort", () => {
  it("returns only the two allowlisted shortcuts and preserves unassigned state", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.commands.getAll).mockResolvedValue([
      { name: EXTENSION_COMMANDS.SAVE_CURRENT_PAGE, shortcut: "Ctrl+Shift+S" },
      { name: EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME, shortcut: "" },
      { name: "unknown-command", shortcut: "Alt+U" }
    ])

    const port = createChromePopupPort(chromeApi)

    await expect(port.getShortcuts()).resolves.toEqual({
      [EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME]: null,
      [EXTENSION_COMMANDS.SAVE_CURRENT_PAGE]: "Ctrl+Shift+S"
    })
  })

  it("sends the typed popup request and decodes saved and duplicate results", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.tabs.query).mockImplementation(async () => [
      {
        url: "https://example.com/page",
        title: "Example",
        favIconUrl: "https://example.com/favicon.ico"
      }
    ])
    vi.mocked(chromeApi.runtime.sendMessage)
      .mockResolvedValueOnce({
        data: { duplicate: false },
        ok: true,
        requestId: "popup-save:request-1"
      })
      .mockResolvedValueOnce({
        data: { status: "duplicate" },
        ok: true,
        requestId: "popup-save:request-1"
      })
    const port = createChromePopupPort(chromeApi, () => "request-1")

    await expect(port.saveCurrentPage()).resolves.toEqual({ status: "saved" })
    expect(chromeApi.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
      action: "save-current-tab",
      payload: {
        rawUrl: "https://example.com/page",
        title: "Example",
        faviconUrl: "https://example.com/favicon.ico"
      },
      requestId: "popup-save:request-1",
      schemaVersion: 1,
      source: "popup"
    })
    await expect(port.saveCurrentPage()).resolves.toEqual({
      status: "duplicate"
    })
  })

  it("rejects unavailable and malformed Service Worker responses", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage)
      .mockResolvedValueOnce({
        error: { code: "ACTION_NOT_AVAILABLE" },
        ok: false,
        requestId: "popup-save:request-2"
      })
      .mockResolvedValueOnce({
        data: {},
        ok: true,
        requestId: "popup-save:request-2"
      })
    const port = createChromePopupPort(chromeApi, () => "request-2")

    await expect(port.saveCurrentPage()).rejects.toMatchObject({
      code: "ACTION_NOT_AVAILABLE"
    })
    await expect(port.saveCurrentPage()).rejects.toMatchObject({
      code: "INVALID_RESPONSE"
    })
  })

  it("reads and clears pending save feedback from session storage", async () => {
    const chromeApi = createChromeApi()
    const port = createChromePopupPort(chromeApi)

    await chromeApi.storage.session.set({
      "bookmation.popup-save-feedback-v1": {
        status: "saved",
        recordedAt: Date.now(),
      },
    })

    await expect(port.getPendingSaveFeedback()).resolves.toBe("saved")
    await port.clearSaveFeedback()
    await expect(port.getPendingSaveFeedback()).resolves.toBeNull()
  })

  it("opens the dashboard home and Chrome shortcut settings in tabs", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.tabs.query).mockImplementation(async () => [])
    const port = createChromePopupPort(chromeApi)

    await port.openHome()
    await port.openShortcutSettings()

    expect(chromeApi.tabs.create).toHaveBeenNthCalledWith(1, {
      url: "chrome-extension://test/tabs/index.html#/home"
    })
    expect(chromeApi.tabs.create).toHaveBeenNthCalledWith(2, {
      url: "chrome://extensions/shortcuts"
    })
  })
})
