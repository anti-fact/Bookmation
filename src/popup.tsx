import {
  MESSAGE_SCHEMA_VERSION,
  type CommandShortcutEntry,
  type ExtensionResponse,
  type SaveBookmarkResponse,
} from "~extension/messages"
import { EXTENSION_COMMANDS } from "~extension/commands"
import { openOrFocusDashboardHome } from "~extension/open-dashboard-tab"
import { Button } from "~ui/primitives"

import "./style.css"
import * as React from "react"

const SAVE_LABEL = "このページをブックマーク"
const HOME_LABEL = "Bookmation ホームを開く"

async function sendMessage<T extends ExtensionResponse>(
  payload: Record<string, unknown>,
): Promise<T> {
  const response = (await chrome.runtime.sendMessage(payload)) as T
  if (chrome.runtime.lastError) {
    throw new Error(chrome.runtime.lastError.message)
  }
  return response
}

function formatShortcut(command: string, shortcuts: CommandShortcutEntry[]): string {
  const entry = shortcuts.find((item) => item.command === command)
  return entry?.shortcut ?? "未割り当て"
}

function IndexPopup() {
  const [shortcuts, setShortcuts] = React.useState<CommandShortcutEntry[]>([])
  const [status, setStatus] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    void (async () => {
      const response = await sendMessage<ExtensionResponse>({
        schemaVersion: MESSAGE_SCHEMA_VERSION,
        action: "GET_COMMAND_SHORTCUTS",
        requestId: crypto.randomUUID(),
      })
      if (response.ok && "shortcuts" in response) {
        setShortcuts(response.shortcuts)
      }
    })().catch(() => {
      setShortcuts([])
    })
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setStatus(null)
    try {
      const response = await sendMessage<SaveBookmarkResponse>({
        schemaVersion: MESSAGE_SCHEMA_VERSION,
        action: "SAVE_CURRENT_TAB",
        requestId: crypto.randomUUID(),
      })
      if (!response.ok) {
        const message =
          "message" in response && typeof response.message === "string"
            ? response.message
            : "保存に失敗しました"
        setStatus(message)
        return
      }
      setStatus(
        response.duplicate ? "すでに保存されています" : "保存しました",
      )
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  const openHome = () => {
    void openOrFocusDashboardHome(chrome.runtime, chrome.tabs, chrome.windows)
  }

  const openShortcutSettings = () => {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" })
  }

  return (
    <main className="min-w-[20rem] bg-bm-paper p-4 text-bm-ink">
      <h1 className="text-sm font-semibold">Bookmation</h1>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Button
            size="compact"
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {SAVE_LABEL}
          </Button>
          <span className="text-[11px] text-bm-control-muted">
            {formatShortcut(EXTENSION_COMMANDS.SAVE_CURRENT_PAGE, shortcuts)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button size="compact" type="button" variant="outline" onClick={openHome}>
            {HOME_LABEL}
          </Button>
          <span className="text-[11px] text-bm-control-muted">
            {formatShortcut(EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME, shortcuts)}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 text-[11px] text-bm-accent underline"
        onClick={openShortcutSettings}
      >
        割り当てを変更
      </button>

      {status ? (
        <p className="mt-3 text-xs text-bm-muted-text" role="status">
          {status}
        </p>
      ) : null}
    </main>
  )
}

export default IndexPopup
