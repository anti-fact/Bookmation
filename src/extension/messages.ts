import type { JsonValue } from "~/domain"

/** Service Worker と拡張ページ間で交換する protocol version。 */
export const EXTENSION_MESSAGE_SCHEMA_VERSION = 1 as const
export const MAX_EXTENSION_MESSAGE_BYTES = 64 * 1024

export const EXTENSION_MESSAGE_ACTIONS = {
  SAVE_CURRENT_TAB: "save-current-tab",
  SAVE_BOOKMARK_BY_URL: "save-bookmark-by-url",
  UPDATE_BOOKMARK: "update-bookmark",
  DELETE_BOOKMARK: "delete-bookmark",
  LIST_BOOKMARKS: "list-bookmarks",
  CREATE_CATEGORY: "create-category",
  CREATE_TAG: "create-tag",
  UPDATE_TAG: "update-tag",
  DELETE_TAG: "delete-tag",
  CLAIM_CLASSIFICATION_JOB: "claim-classification-job",
  APPLY_CLASSIFICATION_RESULT: "apply-classification-result",
  SEARCH_LIBRARY: "search-library",
} as const

export type ExtensionMessageAction =
  (typeof EXTENSION_MESSAGE_ACTIONS)[keyof typeof EXTENSION_MESSAGE_ACTIONS]

export const EXTENSION_MESSAGE_ACTION_ALLOWLIST: readonly ExtensionMessageAction[] =
  Object.values(EXTENSION_MESSAGE_ACTIONS)

export type ExtensionMessageSource = "popup" | "dashboard" | "ai-host"

export type SaveCurrentTabPayload = Readonly<{
  rawUrl?: string
  title?: string
  faviconUrl?: string | null
}>

export type SaveBookmarkByUrlPayload = Readonly<{
  url: string
  title?: string
}>

export type ListBookmarksPayload = Readonly<{
  limit?: number
}>

type MessageRequest<
  Action extends ExtensionMessageAction,
  Source extends ExtensionMessageSource,
  Payload extends JsonValue,
> = Readonly<{
  schemaVersion: typeof EXTENSION_MESSAGE_SCHEMA_VERSION
  requestId: string
  source: Source
  action: Action
  payload: Payload
}>

/**
 * action を判別子にした拡張ページ protocol。
 * 各 payload の業務的な検証は Application / Domain で行う。ここでは
 * Chrome boundary の版、送信元、JSON性、サイズだけを検証する。
 */
export type ExtensionMessageRequest =
  | MessageRequest<"save-current-tab", "popup", SaveCurrentTabPayload>
  | MessageRequest<
      "save-bookmark-by-url",
      "popup" | "dashboard",
      SaveBookmarkByUrlPayload
    >
  | MessageRequest<"update-bookmark", "dashboard", JsonValue>
  | MessageRequest<"delete-bookmark", "dashboard", JsonValue>
  | MessageRequest<"list-bookmarks", "dashboard", ListBookmarksPayload>
  | MessageRequest<"create-category", "dashboard", JsonValue>
  | MessageRequest<"create-tag", "dashboard", JsonValue>
  | MessageRequest<"update-tag", "dashboard", JsonValue>
  | MessageRequest<"delete-tag", "dashboard", JsonValue>
  | MessageRequest<"claim-classification-job", "ai-host", JsonValue>
  | MessageRequest<"apply-classification-result", "ai-host", JsonValue>
  | MessageRequest<"search-library", "dashboard" | "ai-host", JsonValue>

export type ExtensionMessageErrorCode =
  | "INVALID_MESSAGE"
  | "UNAUTHORIZED_SENDER"
  | "ACTION_NOT_AVAILABLE"
  | "INTERNAL_ERROR"

export type ExtensionMessageResponse =
  | Readonly<{ requestId: string | null; ok: true; data: JsonValue }>
  | Readonly<{
      requestId: string | null
      ok: false
      error: { code: ExtensionMessageErrorCode }
    }>

export function isExtensionMessageAction(value: unknown): value is ExtensionMessageAction {
  return (
    typeof value === "string" &&
    (EXTENSION_MESSAGE_ACTION_ALLOWLIST as readonly string[]).includes(value)
  )
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue)
  }
  if (typeof value !== "object") {
    return false
  }

  return Object.values(value as Record<string, unknown>).every(isJsonValue)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasAllowedSource(
  action: ExtensionMessageAction,
  source: ExtensionMessageSource,
): boolean {
  switch (action) {
    case "save-current-tab":
      return source === "popup"
    case "save-bookmark-by-url":
      return source === "popup" || source === "dashboard"
    case "claim-classification-job":
    case "apply-classification-result":
      return source === "ai-host"
    case "search-library":
      return source === "dashboard" || source === "ai-host"
    default:
      return source === "dashboard"
  }
}

function getRequestId(value: unknown): string | null {
  if (!isPlainRecord(value) || typeof value.requestId !== "string") {
    return null
  }
  return value.requestId.length <= 128 ? value.requestId : null
}

export function parseExtensionMessage(value: unknown): ExtensionMessageRequest | null {
  if (!isPlainRecord(value) || !isJsonValue(value)) {
    return null
  }
  if (value.schemaVersion !== EXTENSION_MESSAGE_SCHEMA_VERSION) {
    return null
  }
  if (
    typeof value.requestId !== "string" ||
    value.requestId.length === 0 ||
    value.requestId.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(value.requestId)
  ) {
    return null
  }
  if (!isExtensionMessageAction(value.action)) {
    return null
  }
  if (
    (value.source !== "popup" && value.source !== "dashboard" && value.source !== "ai-host") ||
    !hasAllowedSource(value.action, value.source)
  ) {
    return null
  }
  if (!isJsonValue(value.payload)) {
    return null
  }

  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_EXTENSION_MESSAGE_BYTES) {
      return null
    }
  } catch {
    return null
  }

  return value as ExtensionMessageRequest
}

export function getMessageRequestId(value: unknown): string | null {
  return getRequestId(value)
}
