import { migrateLocalSettings, type LocalSettings } from "~/domain/local-settings"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"

export const LOCAL_SETTINGS_STORAGE_KEY = "bookmation.local-settings-v1"

type StorageLocal = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export class ChromeLocalSettingsStore implements LocalSettingsStore {
  constructor(private readonly storage: StorageLocal = chrome.storage.local) {}

  async get(): Promise<LocalSettings> {
    const result = await this.storage.get(LOCAL_SETTINGS_STORAGE_KEY)
    const raw = result[LOCAL_SETTINGS_STORAGE_KEY]
    const settings = migrateLocalSettings(raw)
    if (raw === undefined) {
      await this.storage.set({ [LOCAL_SETTINGS_STORAGE_KEY]: settings })
    }
    return settings
  }

  async set(settings: LocalSettings): Promise<void> {
    await this.storage.set({ [LOCAL_SETTINGS_STORAGE_KEY]: settings })
  }
}
