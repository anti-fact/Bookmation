import type { LocalSettings } from "~/domain/local-settings"

export type GeneralSettingsSnapshotData = Readonly<{
  aiGranularity: LocalSettings["aiGranularity"]
  archiveAfterDays: LocalSettings["archiveAfterDays"]
  autoArchiveEnabled: LocalSettings["autoArchiveEnabled"]
  contextMenuBookmarkEnabled: boolean
  frequentVisitReminderEnabled: boolean
  frequentVisitWindow: LocalSettings["frequentVisitWindow"]
  frequentVisitDayThreshold: LocalSettings["frequentVisitDayThreshold"]
}>

export function toGeneralSettingsSnapshotData(
  settings: LocalSettings,
): GeneralSettingsSnapshotData {
  return {
    aiGranularity: settings.aiGranularity,
    archiveAfterDays: settings.archiveAfterDays,
    autoArchiveEnabled: settings.autoArchiveEnabled,
    contextMenuBookmarkEnabled: settings.contextMenuBookmarkEnabled,
    frequentVisitReminderEnabled: settings.frequentVisitReminderEnabled,
    frequentVisitWindow: settings.frequentVisitWindow,
    frequentVisitDayThreshold: settings.frequentVisitDayThreshold,
  }
}
