import { describe, expect, it } from "vitest"

import { ChromeCategoryTemplateReceiptStore } from "./chrome-category-template-receipts"

describe("ChromeCategoryTemplateReceiptStore", () => {
  it("persists a receipt independently from the catalog", async () => {
    const values: Record<string, unknown> = {}
    const storage = {
      get: async (key: string) => ({ [key]: values[key] }),
      set: async (next: Record<string, unknown>) => {
        Object.assign(values, next)
      },
    }
    const store = new ChromeCategoryTemplateReceiptStore(storage)
    const receipt = { requestId: "apply-1", requestFingerprint: "[]", results: [] }

    await store.put(receipt)
    await expect(store.get("apply-1")).resolves.toEqual(receipt)
  })
})
