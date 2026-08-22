import { BookmarkIcon, HomeIcon, KeyboardIcon } from "@radix-ui/react-icons"
import * as React from "react"

import { EXTENSION_COMMANDS } from "~/extension/commands"
import { Button } from "~/ui/primitives"
import { joinClassNames } from "~/ui/primitives/class-names"

import type { PopupPort, PopupShortcuts } from "./popup-port"

const bookmationLogo = new URL(
  "../../assets/bookmation-logo.svg",
  import.meta.url
).href

const EMPTY_SHORTCUTS: PopupShortcuts = {
  [EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME]: null,
  [EXTENSION_COMMANDS.SAVE_CURRENT_PAGE]: null
}

export type PopupSaveState = "idle" | "saving" | "saved" | "duplicate" | "error"

export type PopupShortcutsState = "loading" | "ready" | "error"

type PopupViewProps = {
  onChangeShortcuts: () => void
  onOpenHome: () => void
  onSave: () => void
  saveState: PopupSaveState
  shortcuts: PopupShortcuts
  shortcutsState: PopupShortcutsState
}

function shortcutLabel(
  state: PopupShortcutsState,
  value: string | null
): string {
  if (state === "loading") {
    return "確認中"
  }
  return value ?? "未割り当て"
}

function saveFeedback(state: PopupSaveState): {
  message: string
  role: "alert" | "status"
  tone: string
} {
  switch (state) {
    case "saving":
      return {
        message: "このページを保存しています…",
        role: "status",
        tone: "text-bm-muted-text"
      }
    case "saved":
      return {
        message: "このページを保存しました。",
        role: "status",
        tone: "text-bm-ink"
      }
    case "duplicate":
      return {
        message: "このページはすでに保存されています。",
        role: "status",
        tone: "text-bm-ink"
      }
    case "error":
      return {
        message: "このページを保存できませんでした。もう一度お試しください。",
        role: "alert",
        tone: "text-bm-danger"
      }
    case "idle":
      return {
        message: "ポップアップを開いただけでは保存されません。",
        role: "status",
        tone: "text-bm-muted-text"
      }
  }
}

function Shortcut({ value }: { value: string }) {
  return (
    <kbd className="self-end rounded-bm-chip border border-bm-border bg-bm-accent px-2 py-1 text-[0.6875rem] font-semibold leading-none text-bm-ink">
      {value}
    </kbd>
  )
}

/** production popupとWeb fixtureが共有する、状態を受け取るだけの表示部品です。 */
export function PopupView({
  onChangeShortcuts,
  onOpenHome,
  onSave,
  saveState,
  shortcuts,
  shortcutsState
}: PopupViewProps) {
  const feedback = saveFeedback(saveState)

  return (
    <main className="w-[22rem] max-w-full overflow-hidden rounded-bm-control border-[3px] border-bm-ink bg-bm-paper p-5 text-bm-ink">
      <header>
        <h1 className="m-0">
          <img
            alt="Bookmation"
            className="mx-auto block h-auto w-[9.9375rem] max-w-full"
            height={48}
            src={bookmationLogo}
            width={159}
          />
        </h1>
        <p className="mb-0 mt-4 text-sm leading-6 text-bm-muted-text">
          現在のページを保存するか、Bookmation ホームを開きます。
        </p>
      </header>

      <section aria-label="ポップアップ操作" className="mt-5 space-y-3">
        <Button
          aria-describedby="popup-save-feedback"
          className="min-h-14 w-full flex-col items-stretch justify-between rounded-bm-field px-4 py-3"
          loading={saveState === "saving"}
          onClick={onSave}
          variant="outline"
        >
          <span className="flex min-w-0 items-center gap-3 text-left leading-5">
            <BookmarkIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>このページをブックマーク</span>
          </span>
          <Shortcut
            value={shortcutLabel(
              shortcutsState,
              shortcuts[EXTENSION_COMMANDS.SAVE_CURRENT_PAGE]
            )}
          />
        </Button>

        <Button
          className="min-h-14 w-full flex-col items-stretch justify-between rounded-bm-field px-4 py-3"
          onClick={onOpenHome}
          variant="outline"
        >
          <span className="flex min-w-0 items-center gap-3 text-left leading-5">
            <HomeIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>Bookmation ホームを開く</span>
          </span>
          <Shortcut
            value={shortcutLabel(
              shortcutsState,
              shortcuts[EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME]
            )}
          />
        </Button>
      </section>

      <div className="mt-3 flex justify-end">
        <Button
          className="min-w-0 px-2"
          onClick={onChangeShortcuts}
          size="compact"
          variant="quiet"
        >
          <KeyboardIcon aria-hidden="true" className="size-4" />
          割り当てを変更
        </Button>
      </div>

      {shortcutsState === "error" ? (
        <p className="mb-0 mt-3 text-xs leading-5 text-bm-danger" role="alert">
          ショートカットを取得できませんでした。Chromeの管理画面で確認してください。
        </p>
      ) : null}

      <p
        aria-atomic="true"
        className={joinClassNames(
          "mb-0 mt-3 min-h-5 text-xs leading-5",
          feedback.tone
        )}
        id="popup-save-feedback"
        role={feedback.role}
      >
        {feedback.message}
      </p>
    </main>
  )
}

export function PopupApp({ port }: { port: PopupPort }) {
  const [saveState, setSaveState] = React.useState<PopupSaveState>("idle")
  const [shortcuts, setShortcuts] =
    React.useState<PopupShortcuts>(EMPTY_SHORTCUTS)
  const [shortcutsState, setShortcutsState] =
    React.useState<PopupShortcutsState>("loading")
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    let active = true

    void port
      .getShortcuts()
      .then((nextShortcuts) => {
        if (!active) return
        setShortcuts(nextShortcuts)
        setShortcutsState("ready")
      })
      .catch(() => {
        if (!active) return
        setShortcuts(EMPTY_SHORTCUTS)
        setShortcutsState("error")
      })

    return () => {
      active = false
      mountedRef.current = false
    }
  }, [port])

  const handleSave = React.useCallback(async () => {
    setSaveState("saving")
    try {
      const result = await port.saveCurrentPage()
      if (mountedRef.current) {
        setSaveState(result.status)
      }
    } catch {
      if (mountedRef.current) {
        setSaveState("error")
      }
    }
  }, [port])

  const handleOpenHome = React.useCallback(async () => {
    try {
      await port.openHome()
    } catch {
      if (mountedRef.current) {
        setSaveState("error")
      }
    }
  }, [port])

  const handleChangeShortcuts = React.useCallback(async () => {
    try {
      await port.openShortcutSettings()
    } catch {
      if (mountedRef.current) {
        setShortcutsState("error")
      }
    }
  }, [port])

  return (
    <PopupView
      onChangeShortcuts={() => void handleChangeShortcuts()}
      onOpenHome={() => void handleOpenHome()}
      onSave={() => void handleSave()}
      saveState={saveState}
      shortcuts={shortcuts}
      shortcutsState={shortcutsState}
    />
  )
}
