import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageResponse
} from "~/extension/messages"
import type { FrequentVisitWindow } from "~/domain/types"
import {
  type GeneralSettingsPort,
  type GeneralSettingsSnapshot,
  type ReminderSettingsPatch
} from "~/ui/features/settings/general-settings-port"

export class GeneralSettingsPortError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "GeneralSettingsPortError"
  }
}

type GeneralSettingsChromeApi = Readonly<{
  runtime: {
    sendMessage(message: unknown): Promise<unknown>
    lastError?: { message?: string }
  }
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function decodeWindow(value: unknown): FrequentVisitWindow | null {
  if (value === null) {
    return null
  }
  if (
    value === "LAST_7_DAYS" ||
    value === "LAST_30_DAYS" ||
    value === "LAST_365_DAYS"
  ) {
    return value
  }
  return null
}

function decodeSnapshot(data: unknown): GeneralSettingsSnapshot {
  if (!isRecord(data) || typeof data.contextMenuBookmarkEnabled !== "boolean") {
    throw new GeneralSettingsPortError(
      "INVALID_RESPONSE",
      "設定を読み込めませんでした。"
    )
  }
  const frequentVisitReminderEnabled =
    typeof data.frequentVisitReminderEnabled === "boolean"
      ? data.frequentVisitReminderEnabled
      : false
  const frequentVisitWindow = decodeWindow(data.frequentVisitWindow)
  const frequentVisitDayThreshold =
    data.frequentVisitDayThreshold === null
      ? null
      : typeof data.frequentVisitDayThreshold === "number"
        ? data.frequentVisitDayThreshold
        : null

  return {
    contextMenuBookmarkEnabled: data.contextMenuBookmarkEnabled,
    frequentVisitReminderEnabled,
    frequentVisitWindow,
    frequentVisitDayThreshold,
  }
}

function decodeMessageResponse(
  value: unknown,
  requestId: string
): GeneralSettingsSnapshot {
  if (!isRecord(value) || value.requestId !== requestId) {
    throw new GeneralSettingsPortError(
      "INVALID_RESPONSE",
      "設定を読み込めませんでした。"
    )
  }

  const response = value as ExtensionMessageResponse
  if (!response.ok) {
    if (response.error.code === "REMINDER_PERMISSION_DENIED") {
      throw new GeneralSettingsPortError(
        response.error.code,
        "Bookmation の履歴権限を許可してください。Chrome アカウントの同期設定とは別です。"
      )
    }
    throw new GeneralSettingsPortError(
      response.error.code,
      response.error.code === "INTERNAL_ERROR"
        ? "設定の保存に失敗しました。もう一度お試しください。"
        : "設定を変更できませんでした。"
    )
  }

  return decodeSnapshot(response.data)
}

function sendMessage(
  chromeApi: GeneralSettingsChromeApi,
  action: string,
  payload: Record<string, unknown>,
  requestId: string
): Promise<GeneralSettingsSnapshot> {
  return chromeApi.runtime
    .sendMessage({
      action,
      payload,
      requestId,
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      source: "dashboard"
    })
    .then((value) => {
      if (chromeApi.runtime.lastError?.message) {
        throw new GeneralSettingsPortError(
          "RUNTIME_ERROR",
          chromeApi.runtime.lastError.message
        )
      }
      return decodeMessageResponse(value, requestId)
    })
}

/** Chrome runtime message を一般設定 Port へ変換します。 */
export function createChromeGeneralSettingsPort(
  chromeApi: GeneralSettingsChromeApi,
  createRequestId: () => string = () => crypto.randomUUID()
): GeneralSettingsPort {
  return {
    async getSnapshot() {
      const requestId = createRequestId()
      return sendMessage(
        chromeApi,
        "get-general-settings-snapshot",
        {},
        requestId
      )
    },

    async setContextMenuBookmarkEnabled(enabled) {
      const requestId = createRequestId()
      return sendMessage(
        chromeApi,
        "set-context-menu-bookmark-enabled",
        { enabled },
        requestId
      )
    },

    async updateReminderSettings(patch) {
      const requestId = createRequestId()
      return sendMessage(
        chromeApi,
        "update-reminder-settings",
        { ...patch },
        requestId
      )
    },
  }
}
