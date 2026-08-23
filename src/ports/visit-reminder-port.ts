export interface ReminderPermissionsPort {
  hasReminderPermissions(): Promise<boolean>
  requestReminderPermissions(): Promise<boolean>
}
