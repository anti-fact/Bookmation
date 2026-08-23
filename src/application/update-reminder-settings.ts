import {
  assertLocalSettingsValid,
  type LocalSettings,
} from "~/domain/local-settings"
import type { FrequentVisitWindow } from "~/domain/types"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"
import type { ReminderPermissionsPort } from "~/ports/visit-reminder-port"

export type ReminderSettingsPatch = Readonly<{
  frequentVisitReminderEnabled?: boolean
  frequentVisitWindow?: FrequentVisitWindow | null
  frequentVisitDayThreshold?: number | null
}>

export class ReminderSettingsApplicationError extends Error {
  constructor(
    readonly code: "REMINDER_PERMISSION_DENIED",
    message: string,
  ) {
    super(message)
    this.name = "ReminderSettingsApplicationError"
  }
}

export async function updateReminderSettings(
  settingsStore: LocalSettingsStore,
  permissions: ReminderPermissionsPort,
  patch: ReminderSettingsPatch,
): Promise<LocalSettings> {
  const current = await settingsStore.get()
  let frequentVisitDayThreshold =
    patch.frequentVisitDayThreshold ?? current.frequentVisitDayThreshold
  const frequentVisitWindow =
    patch.frequentVisitWindow !== undefined
      ? patch.frequentVisitWindow
      : current.frequentVisitWindow

  if (
    patch.frequentVisitWindow !== undefined &&
    patch.frequentVisitWindow !== current.frequentVisitWindow
  ) {
    frequentVisitDayThreshold = null
  }

  const frequentVisitReminderEnabled =
    patch.frequentVisitReminderEnabled ?? current.frequentVisitReminderEnabled

  if (patch.frequentVisitReminderEnabled === true && !current.frequentVisitReminderEnabled) {
    const granted = await permissions.requestReminderPermissions()
    if (!granted) {
      throw new ReminderSettingsApplicationError(
        "REMINDER_PERMISSION_DENIED",
        "履歴の権限が許可されていないため、リマインダーを有効にできません。",
      )
    }
  }

  const next: LocalSettings = {
    ...current,
    frequentVisitReminderEnabled,
    frequentVisitWindow,
    frequentVisitDayThreshold,
  }

  assertLocalSettingsValid(next)
  await settingsStore.set(next)
  return next
}
