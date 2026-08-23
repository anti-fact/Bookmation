import { describe, expect, it, vi } from "vitest"

import { createChromeGeneralSettingsPort } from "./chrome-general-settings-port"

function createChromeApi() {
  return {
    runtime: {
      sendMessage: vi.fn(),
      lastError: undefined
    }
  }
}

describe("createChromeGeneralSettingsPort", () => {
  it("reads the general settings snapshot from the background", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: true,
      requestId: "read-1",
      data: {
        contextMenuBookmarkEnabled: true,
        frequentVisitReminderEnabled: false,
        frequentVisitWindow: null,
        frequentVisitDayThreshold: null,
      },
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "read-1")

    await expect(port.getSnapshot()).resolves.toEqual({
      contextMenuBookmarkEnabled: true,
      frequentVisitReminderEnabled: false,
      frequentVisitWindow: null,
      frequentVisitDayThreshold: null,
    })
    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith({
      action: "get-general-settings-snapshot",
      payload: {},
      requestId: "read-1",
      schemaVersion: 1,
      source: "dashboard"
    })
  })

  it("writes context menu bookmark enabled through the background", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: true,
      requestId: "write-1",
      data: {
        contextMenuBookmarkEnabled: false,
        frequentVisitReminderEnabled: false,
        frequentVisitWindow: null,
        frequentVisitDayThreshold: null,
      },
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "write-1")

    await expect(port.setContextMenuBookmarkEnabled(false)).resolves.toEqual({
      contextMenuBookmarkEnabled: false,
      frequentVisitReminderEnabled: false,
      frequentVisitWindow: null,
      frequentVisitDayThreshold: null,
    })
    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith({
      action: "set-context-menu-bookmark-enabled",
      payload: { enabled: false },
      requestId: "write-1",
      schemaVersion: 1,
      source: "dashboard"
    })
  })

  it("maps INTERNAL_ERROR to a user-facing save failure message", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: false,
      requestId: "write-2",
      error: { code: "INTERNAL_ERROR" }
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "write-2")

    await expect(port.setContextMenuBookmarkEnabled(true)).rejects.toThrow(
      "設定の保存に失敗しました。もう一度お試しください。"
    )
  })
})
