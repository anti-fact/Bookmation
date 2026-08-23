import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageResponse
} from "~/extension/messages"
import {
  type AiGranularity,
  type GeneralSettingsPort,
  type GeneralSettingsSnapshot,
  type GeneralSettingsUpdate
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

type PermissionName = "history" | "notifications"
type PermissionRequest = { permissions: PermissionName[] }

type GeneralSettingsChromeApi = Readonly<{
  runtime: {
    sendMessage(message: unknown): Promise<unknown>
    lastError?: { message?: string }
  }
  permissions?: {
    contains(permissions: PermissionRequest): Promise<boolean>
    request(permissions: PermissionRequest): Promise<boolean>
    onRemoved?: {
      addListener(listener: (permissions: PermissionRequest) => void): void
      removeListener(listener: (permissions: PermissionRequest) => void): void
    }
  }
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isGranularity(value: unknown): value is AiGranularity {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 4
}

function decodeSnapshot(data: unknown): GeneralSettingsSnapshot {
  if (
    !isRecord(data) ||
    typeof data.frequentVisitReminderEnabled !== "boolean" ||
    !(
      data.frequentVisitWindow === null ||
      data.frequentVisitWindow === "LAST_7_DAYS" ||
      data.frequentVisitWindow === "LAST_30_DAYS" ||
      data.frequentVisitWindow === "LAST_365_DAYS"
    ) ||
    !(
      data.frequentVisitDayThreshold === null ||
      Number.isInteger(data.frequentVisitDayThreshold)
    ) ||
    typeof data.autoArchiveEnabled !== "boolean" ||
    !Number.isInteger(data.archiveAfterDays) ||
    typeof data.contextMenuBookmarkEnabled !== "boolean" ||
    !isGranularity(data.aiGranularity)
  ) {
    throw new GeneralSettingsPortError(
      "INVALID_RESPONSE",
      "設定を読み込めませんでした。"
    )
  }
  return data as GeneralSettingsSnapshot
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
    throw new GeneralSettingsPortError(
      response.error.code,
      response.error.code === "INTERNAL_ERROR"
        ? "設定の保存に失敗しました。もう一度お試しください。"
        : "設定を変更できませんでした。"
    )
  }

  return decodeSnapshot(response.data)
}

function sendSettingsMessage(
  chromeApi: GeneralSettingsChromeApi,
  action:
    | "get-general-settings-snapshot"
    | "update-general-settings"
    | "set-context-menu-bookmark-enabled",
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

/** Chrome runtime message とoptional permissionを一般設定 Port へ変換します。 */
export function createChromeGeneralSettingsPort(
  chromeApi: GeneralSettingsChromeApi,
  createRequestId: () => string = () => crypto.randomUUID()
): GeneralSettingsPort {
  const sendUpdate = (
    update: GeneralSettingsUpdate | Record<string, boolean>
  ) => {
    const requestId = createRequestId()
    return sendSettingsMessage(
      chromeApi,
      "update-general-settings",
      update,
      requestId
    )
  }

  const requestPermissions = async (permissions: PermissionName[]) => {
    if (!chromeApi.permissions) return false
    const request = { permissions }
    if (await chromeApi.permissions.contains(request)) return true
    return chromeApi.permissions.request(request)
  }

  const port: GeneralSettingsPort = {
    async getSnapshot() {
      const requestId = createRequestId()
      const snapshot = await sendSettingsMessage(
        chromeApi,
        "get-general-settings-snapshot",
        {},
        requestId
      )
      if (
        snapshot.autoArchiveEnabled &&
        !(await chromeApi.permissions?.contains({ permissions: ["history"] }))
      ) {
        return sendUpdate({ autoArchiveEnabled: false })
      }
      return snapshot
    },

    updateSettings(update) {
      return sendUpdate(update)
    },

    async setFrequentVisitReminderEnabled(enabled) {
      if (
        enabled &&
        !(await requestPermissions(["history", "notifications"]))
      ) {
        throw new GeneralSettingsPortError(
          "REMINDER_PERMISSION_REQUIRED",
          "履歴と通知へのアクセスが許可されていないため、リマインダーを有効にできません。"
        )
      }
      return sendUpdate({ frequentVisitReminderEnabled: enabled })
    },

    async setAutoArchiveEnabled(enabled) {
      if (enabled && !(await requestPermissions(["history"]))) {
        throw new GeneralSettingsPortError(
          "ARCHIVE_HISTORY_PERMISSION_REQUIRED",
          "履歴へのアクセスが許可されていないため、自動アーカイブを有効にできません。"
        )
      }
      return sendUpdate({ autoArchiveEnabled: enabled })
    },

    async setContextMenuBookmarkEnabled(enabled) {
      const requestId = createRequestId()
      return sendSettingsMessage(
        chromeApi,
        "set-context-menu-bookmark-enabled",
        { enabled },
        requestId
      )
    },

    subscribePermissionChanges(listener) {
      const event = chromeApi.permissions?.onRemoved
      if (!event) return () => undefined
      const handleRemoved = (removed: PermissionRequest) => {
        if (!removed.permissions.includes("history")) return
        void port.getSnapshot().then(listener)
      }
      event.addListener(handleRemoved)
      return () => event.removeListener(handleRemoved)
    }
  }

  return port
}
