import { EXTENSION_COMMANDS } from "./commands"

export const MESSAGE_SCHEMA_VERSION = 1 as const

export type ExtensionMessage =
  | SaveCurrentTabMessage
  | SaveBookmarkByUrlMessage
  | GetCommandShortcutsMessage
  | ListRecentBookmarksMessage

export type SaveCurrentTabMessage = {
  schemaVersion: typeof MESSAGE_SCHEMA_VERSION
  action: "SAVE_CURRENT_TAB"
  requestId: string
}

export type SaveBookmarkByUrlMessage = {
  schemaVersion: typeof MESSAGE_SCHEMA_VERSION
  action: "SAVE_BOOKMARK_BY_URL"
  requestId: string
  rawUrl: string
  title?: string
}

export type GetCommandShortcutsMessage = {
  schemaVersion: typeof MESSAGE_SCHEMA_VERSION
  action: "GET_COMMAND_SHORTCUTS"
  requestId: string
}

export type ListRecentBookmarksMessage = {
  schemaVersion: typeof MESSAGE_SCHEMA_VERSION
  action: "LIST_RECENT_BOOKMARKS"
  requestId: string
  limit?: number
}

export type ExtensionResponse =
  | SaveBookmarkResponse
  | CommandShortcutsResponse
  | ListRecentBookmarksResponse
  | ExtensionErrorResponse

export type SaveBookmarkResponse = {
  ok: true
  requestId: string
  bookmarkId: string
  title: string
  duplicate: boolean
  savedAt: number
}

export type CommandShortcutEntry = {
  command: string
  shortcut: string
}

export type CommandShortcutsResponse = {
  ok: true
  requestId: string
  shortcuts: CommandShortcutEntry[]
}

export type RecentBookmarkSummary = {
  id: string
  title: string
  normalizedUrl: string
  savedAt: number
}

export type ListRecentBookmarksResponse = {
  ok: true
  requestId: string
  items: RecentBookmarkSummary[]
}

export type ExtensionErrorResponse = {
  ok: false
  requestId: string
  code: string
  message: string
}

const ALLOWED_ACTIONS = new Set<ExtensionMessage["action"]>([
  "SAVE_CURRENT_TAB",
  "SAVE_BOOKMARK_BY_URL",
  "GET_COMMAND_SHORTCUTS",
  "LIST_RECENT_BOOKMARKS",
])

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== MESSAGE_SCHEMA_VERSION) {
    return false
  }
  if (typeof record.action !== "string" || !ALLOWED_ACTIONS.has(record.action as ExtensionMessage["action"])) {
    return false
  }
  if (typeof record.requestId !== "string" || record.requestId.length === 0) {
    return false
  }
  return true
}

export const MANIFEST_COMMAND_NAMES = [
  EXTENSION_COMMANDS.SAVE_CURRENT_PAGE,
  EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME,
] as const
