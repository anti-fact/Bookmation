export type ShareSelectionItem = Readonly<{
  id: string
  kind: "CATEGORY" | "TAG" | "BOOKMARK"
  label: string
  description?: string
  bookmarkIds: readonly string[]
}>

export type DriveConnection = Readonly<{
  accountEmail: string
  fileName: string | null
  lastSyncedAt: string | null
  state: "CONNECTED" | "SYNCING" | "CONFLICT" | "PERMISSION_REQUIRED"
  unsyncedCount: number
}>

export type ShareSettingsSnapshot = Readonly<{
  drive: DriveConnection | null
  items: readonly ShareSelectionItem[]
}>

export type ShareExportResult =
  | Readonly<{ status: "READY"; message: string }>
  | Readonly<{ status: "QR_CAPACITY_EXCEEDED" }>

export interface ShareSettingsPort {
  load(): Promise<ShareSettingsSnapshot>
  connectDrive(): Promise<ShareSettingsSnapshot>
  exportBookmarks(
    bookmarkIds: readonly string[],
    format: "QR" | "CSV"
  ): Promise<ShareExportResult>
  openQrReader(): Promise<void>
}

const EMPTY_SHARE_SNAPSHOT: ShareSettingsSnapshot = { drive: null, items: [] }

export const emptyShareSettingsPort: ShareSettingsPort = {
  async load() {
    return EMPTY_SHARE_SNAPSHOT
  },
  async connectDrive() {
    return EMPTY_SHARE_SNAPSHOT
  },
  async exportBookmarks() {
    return { status: "READY", message: "共有するブックマークがありません。" }
  },
  async openQrReader() {
    return undefined
  }
}
