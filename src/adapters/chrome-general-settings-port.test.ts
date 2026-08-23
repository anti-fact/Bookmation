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

  it("updates reminder settings through the background with a full snapshot", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: true,
      requestId: "reminder-1",
      data: {
        contextMenuBookmarkEnabled: true,
        frequentVisitReminderEnabled: true,
        frequentVisitWindow: "LAST_7_DAYS",
        frequentVisitDayThreshold: 3,
      },
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "reminder-1")

    await expect(
      port.updateReminderSettings({ frequentVisitReminderEnabled: true }),
    ).resolves.toEqual({
      contextMenuBookmarkEnabled: true,
      frequentVisitReminderEnabled: true,
      frequentVisitWindow: "LAST_7_DAYS",
      frequentVisitDayThreshold: 3,
    })
  })

  it("accepts partial reminder snapshots from older background handlers", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: true,
      requestId: "reminder-partial",
      data: {
        frequentVisitReminderEnabled: true,
        frequentVisitWindow: "LAST_365_DAYS",
        frequentVisitDayThreshold: 40,
      },
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "reminder-partial")

    await expect(
      port.updateReminderSettings({ frequentVisitDayThreshold: 40 }),
    ).resolves.toEqual({
      contextMenuBookmarkEnabled: true,
      frequentVisitReminderEnabled: true,
      frequentVisitWindow: "LAST_365_DAYS",
      frequentVisitDayThreshold: 40,
    })
  })

  it("maps REMINDER_PERMISSION_DENIED to a user-facing permission message", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: false,
      requestId: "reminder-2",
      error: { code: "REMINDER_PERMISSION_DENIED" },
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "reminder-2")

    await expect(
      port.updateReminderSettings({ frequentVisitReminderEnabled: true }),
    ).rejects.toThrow("Bookmation の履歴権限を許可してください")
  })

  it("maps REMINDER_CONFIG_INVALID to a user-facing validation message", async () => {
    const chromeApi = createChromeApi()
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: false,
      requestId: "reminder-3",
      error: { code: "REMINDER_CONFIG_INVALID" },
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "reminder-3")

    await expect(
      port.updateReminderSettings({ frequentVisitDayThreshold: 40 }),
    ).rejects.toThrow("選択した期間に合う訪問日数を入力してください。")
  })
})
