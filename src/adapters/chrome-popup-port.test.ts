import { describe, expect, it, vi } from "vitest"

import { EXTENSION_COMMANDS } from "~/extension/commands"

import { createChromePopupPort, type PopupChromeApi } from "./chrome-popup-port"

function createChromeApi(): PopupChromeApi {
  return {
    commands: {
      getAll: vi.fn().mockResolvedValue([])
    },
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      sendMessage: vi.fn()
    },
    tabs: {
      create: vi.fn().mockResolvedValue(undefined)
    }
  }
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
      payload: {},
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

  it("opens the dashboard home and Chrome shortcut settings in tabs", async () => {
    const chromeApi = createChromeApi()
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
