import type { FrequentVisitWindow } from "~/domain/types"

export type GeneralSettingsSnapshot = Readonly<{
  contextMenuBookmarkEnabled: boolean
  frequentVisitReminderEnabled: boolean
  frequentVisitWindow: FrequentVisitWindow | null
  frequentVisitDayThreshold: number | null
}>

export type ReminderSettingsPatch = Readonly<{
  frequentVisitReminderEnabled?: boolean
  frequentVisitWindow?: FrequentVisitWindow | null
  frequentVisitDayThreshold?: number | null
}>

export interface GeneralSettingsPort {
  getSnapshot(): Promise<GeneralSettingsSnapshot>
  setContextMenuBookmarkEnabled(enabled: boolean): Promise<GeneralSettingsSnapshot>
  updateReminderSettings(patch: ReminderSettingsPatch): Promise<GeneralSettingsSnapshot>
}

export const emptyGeneralSettingsPort: GeneralSettingsPort = {
  async getSnapshot() {
    return {
      contextMenuBookmarkEnabled: true,
      frequentVisitReminderEnabled: false,
      frequentVisitWindow: null,
      frequentVisitDayThreshold: null,
    }
  },
  async setContextMenuBookmarkEnabled(enabled) {
    return {
      contextMenuBookmarkEnabled: enabled,
      frequentVisitReminderEnabled: false,
      frequentVisitWindow: null,
      frequentVisitDayThreshold: null,
    }
  },
  async updateReminderSettings(patch) {
    return {
      contextMenuBookmarkEnabled: true,
      frequentVisitReminderEnabled: patch.frequentVisitReminderEnabled ?? false,
      frequentVisitWindow: patch.frequentVisitWindow ?? null,
      frequentVisitDayThreshold: patch.frequentVisitDayThreshold ?? null,
    }
  },
}
