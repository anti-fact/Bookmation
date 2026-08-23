import type { LocalSettings } from "~/domain/local-settings"

export interface LocalSettingsStore {
  get(): Promise<LocalSettings>
  set(settings: LocalSettings): Promise<void>
}
