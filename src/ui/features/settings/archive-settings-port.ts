export type ArchivedBookmarkItem = Readonly<{
  id: string
  title: string
  url: string
  categories: readonly string[]
  tags: readonly string[]
}>

export type ArchiveHistoryIssue = Readonly<{
  id: string
  title: string
  url: string
  code: "ARCHIVE_HISTORY_NOT_FOUND"
}>

export type ArchiveRestoreFailure = Readonly<{
  id: string
  reason: string
}>

export type ArchiveSettingsSnapshot = Readonly<{
  archived: readonly ArchivedBookmarkItem[]
  historyIssues: readonly ArchiveHistoryIssue[]
}>

export type ArchiveRestoreResult = Readonly<{
  snapshot: ArchiveSettingsSnapshot
  restoredIds: readonly string[]
  failures: readonly ArchiveRestoreFailure[]
}>

export interface ArchiveSettingsPort {
  load(): Promise<ArchiveSettingsSnapshot>
  restore(ids: readonly string[]): Promise<ArchiveRestoreResult>
}

const EMPTY_ARCHIVE_SNAPSHOT: ArchiveSettingsSnapshot = {
  archived: [],
  historyIssues: []
}

export const emptyArchiveSettingsPort: ArchiveSettingsPort = {
  async load() {
    return EMPTY_ARCHIVE_SNAPSHOT
  },
  async restore() {
    return { failures: [], restoredIds: [], snapshot: EMPTY_ARCHIVE_SNAPSHOT }
  }
}
