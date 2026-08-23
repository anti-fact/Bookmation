import type { LocalSettings } from "~/domain/local-settings"

export type GeneralSettingsSnapshotData = Readonly<{
  contextMenuBookmarkEnabled: boolean
  frequentVisitReminderEnabled: boolean
  frequentVisitWindow: LocalSettings["frequentVisitWindow"]
  frequentVisitDayThreshold: LocalSettings["frequentVisitDayThreshold"]
}>

export function toGeneralSettingsSnapshotData(
  settings: LocalSettings,
): GeneralSettingsSnapshotData {
  return {
    contextMenuBookmarkEnabled: settings.contextMenuBookmarkEnabled,
    frequentVisitReminderEnabled: settings.frequentVisitReminderEnabled,
    frequentVisitWindow: settings.frequentVisitWindow,
    frequentVisitDayThreshold: settings.frequentVisitDayThreshold,
  }
}
