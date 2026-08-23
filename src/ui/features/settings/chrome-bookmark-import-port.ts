import type {
  ChromeImportEntryPreview,
  ChromeImportFolderPreview,
  ParsedChromeBookmarkEntry,
} from "~/domain"

export type ChromeImportPreview = Readonly<{
  selectionFingerprint: string
  folders: ChromeImportFolderPreview[]
  entries: ChromeImportEntryPreview[]
}>

export type ChromeImportFolderResolution =
  | Readonly<{
      mode: "REUSE"
      sourceFolderKey: string
      tagId: string
      expectedTagRevision: number
    }>
  | Readonly<{
      mode: "UNCLASSIFIED"
      sourceFolderKey: string
    }>
  | Readonly<{
      mode: "SKIP"
      sourceFolderKey: string
    }>

export type ChromeImportCommitResult = Readonly<{
  imported: number
  skippedDuplicate: number
  skippedOther: number
  failed: number
  importedBookmarks: ReadonlyArray<{
    bookmarkId: string
    revision: number
    rawUrl: string
    title: string
    faviconUrl: string | null
  }>
}>

export type ChromeImportErrorCode =
  | "INVALID_RESPONSE"
  | "INTERNAL_ERROR"
  | "INVALID_MESSAGE"
  | "ACTION_NOT_AVAILABLE"

export class ChromeBookmarkImportPortError extends Error {
  constructor(readonly code: ChromeImportErrorCode) {
    super(code)
    this.name = "ChromeBookmarkImportPortError"
  }
}

export interface ChromeBookmarkImportPort {
  preview(entries: readonly ParsedChromeBookmarkEntry[]): Promise<ChromeImportPreview>
  commit(input: {
    commitRequestId: string
    selectionFingerprint: string
    entries: readonly ParsedChromeBookmarkEntry[]
    folderResolutions: readonly ChromeImportFolderResolution[]
  }): Promise<ChromeImportCommitResult>
}

export const emptyChromeBookmarkImportPort: ChromeBookmarkImportPort = {
  async preview() {
    return { selectionFingerprint: "", folders: [], entries: [] }
  },
  async commit() {
    return { imported: 0, skippedDuplicate: 0, skippedOther: 0, failed: 0, importedBookmarks: [] }
  },
}
