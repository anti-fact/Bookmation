import type { DomainErrorCode, JsonValue } from "~/domain"
import { jsonValueWithinBounds, MAX_MESSAGE_JSON_DEPTH } from "~/domain/security"

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
  DELETE_CATEGORY_CASCADE: "delete-category-cascade",
  GET_CATEGORY_EDIT_DETAIL: "get-category-edit-detail",
  LIST_LABEL_CANDIDATES: "list-label-candidates",
  GET_CATEGORY_TEMPLATE_CATALOG: "get-category-template-catalog",
  APPLY_CATEGORY_TEMPLATES: "apply-category-templates",
  CLAIM_CLASSIFICATION_JOB: "claim-classification-job",
  APPLY_CLASSIFICATION_RESULT: "apply-classification-result",
  GET_CLASSIFICATION_JOB: "get-classification-job",
  RETRY_CLASSIFICATION_JOB: "retry-classification-job",
  CANCEL_CLASSIFICATION_JOB: "cancel-classification-job",
  SEARCH_LIBRARY: "search-library",
  GET_GENERAL_SETTINGS_SNAPSHOT: "get-general-settings-snapshot",
  UPDATE_GENERAL_SETTINGS: "update-general-settings",
  SET_CONTEXT_MENU_BOOKMARK_ENABLED: "set-context-menu-bookmark-enabled",
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
  tagIds?: string[]
}>

export type ClaimClassificationJobPayload = Readonly<{
  executorInstanceId: string
  jobId?: string
}>

export type ApplyClassificationResultPayload = Readonly<{
  jobId: string
  executorInstanceId: string
  bookmarkRevision: number
  outcome: "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW" | "CANCELED"
  errorCode?: string | null
  tagIds?: string[]
}>

export type GetClassificationJobPayload = Readonly<{
  jobId?: string
  bookmarkId?: string
}>

export type RetryClassificationJobPayload = Readonly<{
  jobId: string
}>

export type CancelClassificationJobPayload = Readonly<{
  jobId: string
}>

export type SearchLibraryPayload = Readonly<{
  keyword: string
  mode?: "SEARCH" | "SUGGEST"
}>

export type SetContextMenuBookmarkEnabledPayload = Readonly<{
  enabled: boolean
}>

export type UpdateGeneralSettingsPayload = Readonly<{
  frequentVisitReminderEnabled?: boolean
  frequentVisitWindow?: "LAST_7_DAYS" | "LAST_30_DAYS" | "LAST_365_DAYS" | null
  frequentVisitDayThreshold?: number | null
  autoArchiveEnabled?: boolean
  archiveAfterDays?: number
  aiGranularity?: 0 | 1 | 2 | 3 | 4
}>

export type ListBookmarksPayload = Readonly<{
  limit?: number
  labelId?: string
  cursor?: Readonly<{ savedAt: number; id: string }>
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
  | MessageRequest<"delete-category-cascade", "dashboard", JsonValue>
  | MessageRequest<"get-category-edit-detail", "dashboard", JsonValue>
  | MessageRequest<"list-label-candidates", "dashboard", JsonValue>
  | MessageRequest<"get-category-template-catalog", "dashboard", Record<never, never>>
  | MessageRequest<"apply-category-templates", "dashboard", JsonValue>
  | MessageRequest<"claim-classification-job", "ai-host", ClaimClassificationJobPayload>
  | MessageRequest<"apply-classification-result", "ai-host", ApplyClassificationResultPayload>
  | MessageRequest<"get-classification-job", "dashboard", GetClassificationJobPayload>
  | MessageRequest<"retry-classification-job", "dashboard", RetryClassificationJobPayload>
  | MessageRequest<"cancel-classification-job", "dashboard", CancelClassificationJobPayload>
  | MessageRequest<"search-library", "dashboard" | "ai-host", SearchLibraryPayload>
  | MessageRequest<"get-general-settings-snapshot", "dashboard", Record<never, never>>
  | MessageRequest<"update-general-settings", "dashboard", UpdateGeneralSettingsPayload>
  | MessageRequest<
      "set-context-menu-bookmark-enabled",
      "dashboard",
      SetContextMenuBookmarkEnabledPayload
    >

export type ExtensionMessageErrorCode =
  | "INVALID_MESSAGE"
  | "UNAUTHORIZED_SENDER"
  | "ACTION_NOT_AVAILABLE"
  | "INTERNAL_ERROR"
  | DomainErrorCode

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
  return jsonValueWithinBounds(value, MAX_MESSAGE_JSON_DEPTH)
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
