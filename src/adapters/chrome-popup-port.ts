import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageResponse
} from "~/extension/messages"
import { EXTENSION_COMMANDS, type ExtensionCommand } from "~/extension/commands"
import {
  buildDashboardUrl,
  DASHBOARD_ENTRY,
  DASHBOARD_HOME_ROUTE
} from "~/extension/paths"
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
  tabs: {
    create(properties: { url: string }): Promise<unknown>
  }
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

    async openHome() {
      await chromeApi.tabs.create({
        url: buildDashboardUrl(
          chromeApi.runtime.getURL(DASHBOARD_ENTRY),
          DASHBOARD_HOME_ROUTE
        )
      })
    },

    async openShortcutSettings() {
      await chromeApi.tabs.create({ url: SHORTCUT_SETTINGS_URL })
    },

    async saveCurrentPage() {
      const requestId = `popup-save:${createRequestId()}`
      const response = await chromeApi.runtime.sendMessage({
        action: "save-current-tab",
        payload: {},
        requestId,
        schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
        source: "popup"
      })

      return decodeMessageResponse(response, requestId)
    }
  }
}
