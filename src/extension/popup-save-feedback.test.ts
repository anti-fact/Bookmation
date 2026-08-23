import { describe, expect, it } from "vitest"

import {
  clearPopupSaveFeedback,
  POPUP_SAVE_FEEDBACK_STORAGE_KEY,
  readPopupSaveFeedback,
  recordPopupSaveFeedback,
  type PopupSaveFeedbackStorage,
} from "./popup-save-feedback"

function createMemoryStorage(): PopupSaveFeedbackStorage {
  const values = new Map<string, unknown>()
  return {
    async get(key: string | null) {
      if (key === null) {
        return {}
      }
      const value = values.get(key)
      return value === undefined ? {} : { [key]: value }
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) {
        values.set(key, value)
      }
    },
    async remove(key: string) {
      values.delete(key)
    },
  }
}

describe("popup-save-feedback", () => {
  it("records and reads saved status", async () => {
    const storage = createMemoryStorage()
    await recordPopupSaveFeedback(storage, "saved")
    expect(await readPopupSaveFeedback(storage)).toBe("saved")
  })

  it("records and reads duplicate status", async () => {
    const storage = createMemoryStorage()
    await recordPopupSaveFeedback(storage, "duplicate")
    expect(await readPopupSaveFeedback(storage)).toBe("duplicate")
  })

  it("clears stored feedback", async () => {
    const storage = createMemoryStorage()
    await recordPopupSaveFeedback(storage, "saved")
    await clearPopupSaveFeedback(storage)
    expect(await readPopupSaveFeedback(storage)).toBeNull()
    const cleared = await storage.get(POPUP_SAVE_FEEDBACK_STORAGE_KEY)
    expect(cleared).toEqual({})
  })
})
