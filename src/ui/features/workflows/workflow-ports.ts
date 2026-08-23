export type VisitReminderCandidate = Readonly<{
  id: string
  title: string
  url: string
  visitedDayCount: number
  windowLabel: string
}>

export interface VisitReminderPort {
  loadCandidate(): Promise<VisitReminderCandidate | null>
  save(candidateId: string): Promise<void>
  dismiss(candidateId: string, suppress: boolean): Promise<void>
}

export type ImportCategory = Readonly<{
  id: string
  name: string
  revision: number
}>

export type BookmarkImportGroup = Readonly<{
  id: string
  folderName: string
  sourcePath: string
  bookmarks: readonly Readonly<{ id: string; title: string; url: string }>[]
  resolution:
    | Readonly<{ kind: "REUSE"; tagName: string; categoryName: string }>
    | Readonly<{
        kind: "NEW"
        tagName: string
        parentCategoryId: string | null
      }>
    | Readonly<{ kind: "INVALID"; reason: string }>
}>

export type BookmarkImportPreview = Readonly<{
  categories: readonly ImportCategory[]
  groups: readonly BookmarkImportGroup[]
}>

export type BookmarkImportResult = Readonly<{
  importedCount: number
  skippedCount: number
  failed: readonly Readonly<{ title: string; reason: string }>[]
}>

export interface BookmarkImportPort {
  prepare(): Promise<BookmarkImportPreview>
  createCategory(name: string): Promise<ImportCategory>
  confirm(input: {
    groups: readonly Readonly<{
      groupId: string
      parentCategoryId: string | null
      skip: boolean
    }>[]
  }): Promise<BookmarkImportResult>
}

export type ShareSelectionItem = Readonly<{
  id: string
  kind: "CATEGORY" | "TAG" | "BOOKMARK"
  label: string
  bookmarkIds: readonly string[]
}>

export type DriveWorkflowState = Readonly<{
  accountEmail: string | null
  mode: "APP_DATA" | "SHARED_FILE" | null
  fileName: string | null
  status:
    | "DISCONNECTED"
    | "CONNECTED"
    | "SYNCING"
    | "CONFLICT"
    | "PERMISSION_REQUIRED"
  conflictSummary: string | null
}>

export type ShareExportResult =
  | Readonly<{ status: "READY"; message: string; qrDataUrl?: string }>
  | Readonly<{ status: "QR_CAPACITY_EXCEEDED" }>

export type QrReadResult =
  | Readonly<{ status: "CAMERA_DENIED" }>
  | Readonly<{ status: "INVALID"; message: string }>
  | Readonly<{
      status: "PREVIEW"
      previewId: string
      bookmarkCount: number
      duplicateCount: number
      categoryCount: number
      tagCount: number
    }>

export type QrImportResult = Readonly<{
  importedCount: number
  skippedCount: number
  failedCount: number
}>

export interface ShareWorkflowPort {
  loadSelection(): Promise<readonly ShareSelectionItem[]>
  exportBookmarks(
    ids: readonly string[],
    format: "QR" | "CSV"
  ): Promise<ShareExportResult>
  readQr(source: "CAMERA" | "FILE", file?: File): Promise<QrReadResult>
  confirmQrImport(previewId: string): Promise<QrImportResult>
  loadDriveState(): Promise<DriveWorkflowState>
  connectDrive(mode: "APP_DATA" | "SHARED_FILE"): Promise<DriveWorkflowState>
  resolveDriveConflict(choice: "LOCAL" | "REMOTE"): Promise<DriveWorkflowState>
}

function unavailable(): never {
  throw new Error("この機能は現在利用できません。")
}

export const emptyVisitReminderPort: VisitReminderPort = {
  loadCandidate: async () => null,
  save: async () => unavailable(),
  dismiss: async () => unavailable()
}

export const emptyBookmarkImportPort: BookmarkImportPort = {
  prepare: async () => unavailable(),
  createCategory: async () => unavailable(),
  confirm: async () => unavailable()
}

export const emptyShareWorkflowPort: ShareWorkflowPort = {
  loadSelection: async () => [],
  exportBookmarks: async () => unavailable(),
  readQr: async () => unavailable(),
  confirmQrImport: async () => unavailable(),
  loadDriveState: async () => ({
    accountEmail: null,
    conflictSummary: null,
    fileName: null,
    mode: null,
    status: "DISCONNECTED"
  }),
  connectDrive: async () => unavailable(),
  resolveDriveConflict: async () => unavailable()
}
