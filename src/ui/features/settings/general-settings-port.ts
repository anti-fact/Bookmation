export type GeneralSettingsSnapshot = Readonly<{
  contextMenuBookmarkEnabled: boolean
}>

export interface GeneralSettingsPort {
  getSnapshot(): Promise<GeneralSettingsSnapshot>
  setContextMenuBookmarkEnabled(
    enabled: boolean
  ): Promise<GeneralSettingsSnapshot>
}

export const emptyGeneralSettingsPort: GeneralSettingsPort = {
  async getSnapshot() {
    return { contextMenuBookmarkEnabled: true }
  },
  async setContextMenuBookmarkEnabled(enabled) {
    return { contextMenuBookmarkEnabled: enabled }
  }
}
