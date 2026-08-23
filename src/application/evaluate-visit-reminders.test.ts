import { describe, expect, it, vi } from "vitest"

import { DEFAULT_LOCAL_SETTINGS } from "~/domain/local-settings"

import { evaluateVisitReminders } from "./evaluate-visit-reminders"

describe("evaluateVisitReminders", () => {
  it("does not evaluate when reminder settings are incomplete", async () => {
    const settingsStore = {
      get: vi.fn().mockResolvedValue(DEFAULT_LOCAL_SETTINGS),
    }

    const result = await evaluateVisitReminders({
      settingsStore,
      history: {
        searchCandidatesSince: vi.fn(),
        getVisitTimes: vi.fn(),
      },
    })

    expect(result.evaluated).toBe(false)
    expect(result.pendingReminderId).toBeNull()
  })
})
