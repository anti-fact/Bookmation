import { describe, expect, it, vi } from "vitest"

import { createChromeGeneralSettingsPort } from "./chrome-general-settings-port"

const snapshot = {
  aiGranularity: 2,
  archiveAfterDays: 30,
  autoArchiveEnabled: false,
  contextMenuBookmarkEnabled: true,
  frequentVisitDayThreshold: null,
  frequentVisitReminderEnabled: false,
  frequentVisitWindow: null
} as const

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
      data: snapshot
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "read-1")

    await expect(port.getSnapshot()).resolves.toEqual({
      ...snapshot
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
      data: { ...snapshot, contextMenuBookmarkEnabled: false }
    })

    const port = createChromeGeneralSettingsPort(chromeApi, () => "write-1")

    await expect(port.setContextMenuBookmarkEnabled(false)).resolves.toEqual({
      ...snapshot,
      contextMenuBookmarkEnabled: false
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

  it("does not persist auto archive when history permission is denied", async () => {
    const chromeApi = {
      ...createChromeApi(),
      permissions: {
        contains: vi.fn().mockResolvedValue(false),
        request: vi.fn().mockResolvedValue(false)
      }
    }
    const port = createChromeGeneralSettingsPort(
      chromeApi,
      () => "permission-1"
    )

    await expect(port.setAutoArchiveEnabled(true)).rejects.toThrow(
      "自動アーカイブを有効にできません"
    )
    expect(chromeApi.permissions.request).toHaveBeenCalledWith({
      permissions: ["history"]
    })
    expect(chromeApi.runtime.sendMessage).not.toHaveBeenCalled()
  })

  it("persists auto archive only after history permission is granted", async () => {
    const chromeApi = {
      ...createChromeApi(),
      permissions: {
        contains: vi.fn().mockResolvedValue(false),
        request: vi.fn().mockResolvedValue(true)
      }
    }
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      data: { ...snapshot, autoArchiveEnabled: true },
      ok: true,
      requestId: "permission-2"
    })
    const port = createChromeGeneralSettingsPort(
      chromeApi,
      () => "permission-2"
    )

    await expect(port.setAutoArchiveEnabled(true)).resolves.toMatchObject({
      autoArchiveEnabled: true
    })
    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update-general-settings",
        payload: { autoArchiveEnabled: true }
      })
    )
  })
})
