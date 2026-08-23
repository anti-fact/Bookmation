import { describe, expect, it, vi } from "vitest"

import { DEFAULT_LOCAL_SETTINGS } from "~/domain/local-settings"

import {
  ReminderSettingsApplicationError,
  updateReminderSettings,
} from "./update-reminder-settings"

describe("updateReminderSettings", () => {
  it("clears day threshold when visit window changes", async () => {
    const settingsStore = {
      get: vi.fn().mockResolvedValue({
        ...DEFAULT_LOCAL_SETTINGS,
        frequentVisitWindow: "LAST_7_DAYS",
        frequentVisitDayThreshold: 3,
      }),
      set: vi.fn().mockResolvedValue(undefined),
    }
    const permissions = {
      hasReminderPermissions: vi.fn(),
      requestReminderPermissions: vi.fn(),
    }

    const result = await updateReminderSettings(settingsStore, permissions, {
      frequentVisitWindow: "LAST_30_DAYS",
    })

    expect(result.frequentVisitWindow).toBe("LAST_30_DAYS")
    expect(result.frequentVisitDayThreshold).toBeNull()
  })

  it("requests permissions when enabling reminder", async () => {
    const settingsStore = {
      get: vi.fn().mockResolvedValue(DEFAULT_LOCAL_SETTINGS),
      set: vi.fn().mockResolvedValue(undefined),
    }
    const permissions = {
      hasReminderPermissions: vi.fn(),
      requestReminderPermissions: vi.fn().mockResolvedValue(true),
    }

    const result = await updateReminderSettings(settingsStore, permissions, {
      frequentVisitReminderEnabled: true,
    })

    expect(permissions.requestReminderPermissions).toHaveBeenCalledOnce()
    expect(result.frequentVisitReminderEnabled).toBe(true)
  })

  it("rejects enable when permissions are denied", async () => {
    const settingsStore = {
      get: vi.fn().mockResolvedValue(DEFAULT_LOCAL_SETTINGS),
      set: vi.fn(),
    }
    const permissions = {
      hasReminderPermissions: vi.fn(),
      requestReminderPermissions: vi.fn().mockResolvedValue(false),
    }

    await expect(
      updateReminderSettings(settingsStore, permissions, {
        frequentVisitReminderEnabled: true,
      }),
    ).rejects.toBeInstanceOf(ReminderSettingsApplicationError)
    expect(settingsStore.set).not.toHaveBeenCalled()
  })
})
