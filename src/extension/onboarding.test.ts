import { describe, expect, it, vi } from "vitest"

import {
  getOnboardingState,
  initializeOnboardingIfMissing,
  ONBOARDING_STATE_KEY
} from "./onboarding"

describe("onboarding state", () => {
  it("creates the welcome step once and reuses it on resume", async () => {
    const values: Record<string, unknown> = {}
    const storage = {
      get: vi.fn(async (key: string) => ({ [key]: values[key] })),
      set: vi.fn(async (next: Record<string, unknown>) => {
        Object.assign(values, next)
      })
    }

    const first = await initializeOnboardingIfMissing(storage, 100)
    const resumed = await initializeOnboardingIfMissing(storage, 200)

    expect(first).toEqual({
      currentStepId: "welcome",
      initializedBy: "INSTALL",
      schemaVersion: 1,
      status: "NOT_STARTED",
      updatedAt: 100
    })
    expect(resumed).toEqual(first)
    expect(storage.set).toHaveBeenCalledTimes(1)
  })

  it("rejects malformed stored state instead of routing from it", async () => {
    const storage = {
      get: vi.fn(async () => ({
        [ONBOARDING_STATE_KEY]: {
          currentStepId: "welcome",
          initializedBy: "INSTALL",
          schemaVersion: 99,
          status: "NOT_STARTED",
          updatedAt: 1
        }
      })),
      set: vi.fn()
    }

    await expect(getOnboardingState(storage)).resolves.toBeNull()
  })
})
