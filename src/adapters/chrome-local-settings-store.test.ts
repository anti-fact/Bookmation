import { describe, expect, it } from "vitest"

import { DEFAULT_LOCAL_SETTINGS, migrateLocalSettings } from "~/domain/local-settings"
import {
  ChromeLocalSettingsStore,
  LOCAL_SETTINGS_STORAGE_KEY,
} from "~/adapters/chrome-local-settings-store"

describe("ChromeLocalSettingsStore", () => {
  it("persists migrated defaults when storage is empty", async () => {
    const storage = createMemoryStorage()
    const store = new ChromeLocalSettingsStore(storage)

    const settings = await store.get()

    expect(settings).toMatchObject({
      ...DEFAULT_LOCAL_SETTINGS,
      contextMenuBookmarkEnabled: true,
    })
    expect(storage.data[LOCAL_SETTINGS_STORAGE_KEY]).toMatchObject({
      contextMenuBookmarkEnabled: true,
    })
  })

  it("migrates missing contextMenuBookmarkEnabled to true", async () => {
    const storage = createMemoryStorage({
      [LOCAL_SETTINGS_STORAGE_KEY]: { schemaVersion: 1 },
    })
    const store = new ChromeLocalSettingsStore(storage)

    expect((await store.get()).contextMenuBookmarkEnabled).toBe(true)
  })

  it("shrinks corrupted contextMenuBookmarkEnabled to false", async () => {
    const storage = createMemoryStorage({
      [LOCAL_SETTINGS_STORAGE_KEY]: { contextMenuBookmarkEnabled: "yes" },
    })
    const store = new ChromeLocalSettingsStore(storage)

    expect((await store.get()).contextMenuBookmarkEnabled).toBe(false)
  })

  it("writes updated settings", async () => {
    const storage = createMemoryStorage()
    const store = new ChromeLocalSettingsStore(storage)
    const initial = await store.get()

    await store.set({ ...initial, contextMenuBookmarkEnabled: false })

    expect((await store.get()).contextMenuBookmarkEnabled).toBe(false)
    expect(migrateLocalSettings(storage.data[LOCAL_SETTINGS_STORAGE_KEY]).contextMenuBookmarkEnabled).toBe(
      false,
    )
  })
})

function createMemoryStorage(initial: Record<string, unknown> = {}): {
  data: Record<string, unknown>
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
} {
  const data = { ...initial }
  return {
    data,
    async get(key: string) {
      return key in data ? { [key]: data[key] } : {}
    },
    async set(items: Record<string, unknown>) {
      Object.assign(data, items)
    },
  }
}
