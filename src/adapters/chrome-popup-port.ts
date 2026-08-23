import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageResponse
} from "~/extension/messages"
import { EXTENSION_COMMANDS, type ExtensionCommand } from "~/extension/commands"
import { openOrFocusDashboardHome } from "~/extension/open-dashboard-tab"
import {
  clearPopupSaveFeedback,
  POPUP_SAVE_FEEDBACK_STORAGE_KEY,
  readPopupSaveFeedback,
  type PopupSaveFeedbackRecord,
} from "~/extension/popup-save-feedback"
import {
  PopupPortError,
  type PopupPort,
  type PopupSaveResult,
  type PopupShortcuts
} from "~/ui/features/popup/popup-port"

type ChromeCommandSummary = Readonly<{
  name?: string
  shortcut?: string
}>

export type PopupChromeApi = Readonly<{
  commands: {
    getAll(): Promise<ChromeCommandSummary[]>
  }
  runtime: {
    getURL(path: string): string
    sendMessage(message: unknown): Promise<unknown>
  }
  storage: {
    session: Pick<typeof chrome.storage.session, "get" | "set" | "remove"> & {
      onChanged: {
        addListener(
          callback: (
            changes: Record<string, chrome.storage.StorageChange>,
            areaName: string,
          ) => void,
        ): void
        removeListener(
          callback: (
            changes: Record<string, chrome.storage.StorageChange>,
            areaName: string,
          ) => void,
        ): void
      }
    }
  }
  tabs: Pick<typeof chrome.tabs, "create" | "query" | "update">
  windows: Pick<typeof chrome.windows, "update">
}>

const SHORTCUT_SETTINGS_URL = "chrome://extensions/shortcuts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function decodeSaveResult(data: unknown): PopupSaveResult {
  if (!isRecord(data)) {
    throw new PopupPortError(
      "INVALID_RESPONSE",
      "保存結果を確認できませんでした。"
    )
  }

  if (data.status === "saved" || data.status === "duplicate") {
    return { status: data.status }
  }
  if (typeof data.duplicate === "boolean") {
    return { status: data.duplicate ? "duplicate" : "saved" }
  }

  throw new PopupPortError(
    "INVALID_RESPONSE",
    "保存結果を確認できませんでした。"
  )
}

function decodeMessageResponse(
  value: unknown,
  requestId: string
): PopupSaveResult {
  if (!isRecord(value) || value.requestId !== requestId) {
    throw new PopupPortError(
      "INVALID_RESPONSE",
      "保存結果を確認できませんでした。"
    )
  }

  const response = value as ExtensionMessageResponse
  if (!response.ok) {
    throw new PopupPortError(
      response.error.code,
      response.error.code === "ACTION_NOT_AVAILABLE"
        ? "現在このページを保存できません。"
        : "このページを保存できませんでした。"
    )
  }

  return decodeSaveResult(response.data)
}

function emptyShortcuts(): PopupShortcuts {
  return {
    [EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME]: null,
    [EXTENSION_COMMANDS.SAVE_CURRENT_PAGE]: null
  }
}

/** Chrome APIをUIから隔離し、popupで使う値だけへ変換します。 */
export function createChromePopupPort(
  chromeApi: PopupChromeApi,
  createRequestId: () => string = () => crypto.randomUUID()
): PopupPort {
  return {
    async getShortcuts() {
      const shortcuts = emptyShortcuts()
      const commands = await chromeApi.commands.getAll()

      for (const command of commands) {
        if (
          command.name !== EXTENSION_COMMANDS.SAVE_CURRENT_PAGE &&
          command.name !== EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME
        ) {
          continue
        }

        const name = command.name as ExtensionCommand
        const shortcut = command.shortcut?.trim()
        shortcuts[name] = shortcut ? shortcut : null
      }

      return shortcuts
    },

    async getPendingSaveFeedback() {
      return readPopupSaveFeedback(chromeApi.storage.session)
    },

    async clearSaveFeedback() {
      await clearPopupSaveFeedback(chromeApi.storage.session)
    },

    onSaveFeedbackChanged(listener) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        if (areaName !== "session") {
          return
        }
        const change = changes[POPUP_SAVE_FEEDBACK_STORAGE_KEY]
        const record = change?.newValue as PopupSaveFeedbackRecord | undefined
        if (record?.status === "saved" || record?.status === "duplicate") {
          listener(record.status)
        }
      }
      chromeApi.storage.session.onChanged.addListener(handler)
      return () => chromeApi.storage.session.onChanged.removeListener(handler)
    },

    async openHome() {
      await openOrFocusDashboardHome(
        chromeApi.runtime,
        chromeApi.tabs,
        chromeApi.windows,
      )
    },

    async openShortcutSettings() {
      await chromeApi.tabs.create({ url: SHORTCUT_SETTINGS_URL })
    },

    async saveCurrentPage() {
      const [activeTab] = await chromeApi.tabs.query({
        active: true,
        currentWindow: true,
      })
      const requestId = `popup-save:${createRequestId()}`
      const payload =
        activeTab?.url !== undefined
          ? {
              rawUrl: activeTab.url,
              title: activeTab.title ?? "",
              faviconUrl: activeTab.favIconUrl ?? null,
            }
          : {}
      const response = await chromeApi.runtime.sendMessage({
        action: "save-current-tab",
        payload,
        requestId,
        schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
        source: "popup",
      })

      return decodeMessageResponse(response, requestId)
    },
  }
}
