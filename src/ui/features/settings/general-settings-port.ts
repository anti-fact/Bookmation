import type { FrequentVisitWindow } from "~/domain"

export type AiGranularity = 0 | 1 | 2 | 3 | 4

export type GeneralSettingsSnapshot = Readonly<{
  frequentVisitReminderEnabled: boolean
  frequentVisitWindow: FrequentVisitWindow | null
  frequentVisitDayThreshold: number | null
  autoArchiveEnabled: boolean
  archiveAfterDays: number
  contextMenuBookmarkEnabled: boolean
  aiGranularity: AiGranularity
}>

export type GeneralSettingsUpdate = Partial<
  Pick<
    GeneralSettingsSnapshot,
    | "frequentVisitWindow"
    | "frequentVisitDayThreshold"
    | "archiveAfterDays"
    | "aiGranularity"
  >
>

export type ReminderSettingsPatch = Readonly<{
  frequentVisitReminderEnabled?: boolean
  frequentVisitWindow?: FrequentVisitWindow | null
  frequentVisitDayThreshold?: number | null
}>

export interface GeneralSettingsPort {
  getSnapshot(): Promise<GeneralSettingsSnapshot>
  updateSettings(
    update: GeneralSettingsUpdate
  ): Promise<GeneralSettingsSnapshot>
  setFrequentVisitReminderEnabled(
    enabled: boolean
  ): Promise<GeneralSettingsSnapshot>
  setAutoArchiveEnabled(enabled: boolean): Promise<GeneralSettingsSnapshot>
  setContextMenuBookmarkEnabled(
    enabled: boolean
  ): Promise<GeneralSettingsSnapshot>
  updateReminderSettings(
    patch: ReminderSettingsPatch
  ): Promise<GeneralSettingsSnapshot>
  subscribePermissionChanges(
    listener: (snapshot: GeneralSettingsSnapshot) => void
  ): () => void
}

export const DEFAULT_GENERAL_SETTINGS_SNAPSHOT: GeneralSettingsSnapshot = {
  aiGranularity: 2,
  archiveAfterDays: 30,
  autoArchiveEnabled: false,
  contextMenuBookmarkEnabled: true,
  frequentVisitDayThreshold: null,
  frequentVisitReminderEnabled: false,
  frequentVisitWindow: null
}

export const emptyGeneralSettingsPort: GeneralSettingsPort = {
  async getSnapshot() {
    return DEFAULT_GENERAL_SETTINGS_SNAPSHOT
  },
  async updateSettings(update) {
    return { ...DEFAULT_GENERAL_SETTINGS_SNAPSHOT, ...update }
  },
  async setFrequentVisitReminderEnabled(enabled) {
    return {
      ...DEFAULT_GENERAL_SETTINGS_SNAPSHOT,
      frequentVisitReminderEnabled: enabled
    }
  },
  async setAutoArchiveEnabled(enabled) {
    return { ...DEFAULT_GENERAL_SETTINGS_SNAPSHOT, autoArchiveEnabled: enabled }
  },
  async setContextMenuBookmarkEnabled(enabled) {
    return {
      ...DEFAULT_GENERAL_SETTINGS_SNAPSHOT,
      contextMenuBookmarkEnabled: enabled
    }
  },
  async updateReminderSettings(patch) {
    return { ...DEFAULT_GENERAL_SETTINGS_SNAPSHOT, ...patch }
  },
  subscribePermissionChanges() {
    return () => undefined
  }
}
