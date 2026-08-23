import type { ReminderPermissionsPort } from "~/ports/visit-reminder-port"

type ChromePermissionsApi = Readonly<{
  contains(details: chrome.permissions.Permissions): Promise<boolean>
  request(details: chrome.permissions.Permissions): Promise<boolean>
}>

const REMINDER_PERMISSIONS: chrome.permissions.Permissions = {
  permissions: ["history"],
}

export function createChromeReminderPermissionsPort(
  permissions: ChromePermissionsApi,
): ReminderPermissionsPort {
  return {
    async hasReminderPermissions() {
      return permissions.contains(REMINDER_PERMISSIONS)
    },

    async requestReminderPermissions() {
      const alreadyGranted = await permissions.contains(REMINDER_PERMISSIONS)
      if (alreadyGranted) {
        return true
      }
      return permissions.request(REMINDER_PERMISSIONS)
    },
  }
}
