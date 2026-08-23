import * as React from "react"

import { Switch } from "~/ui/primitives"

import type { GeneralSettingsPort } from "./general-settings-port"

const SETTING_LABEL = "右クリックメニューから保存"
const SETTING_DESCRIPTION =
  "ページおよびリンクの右クリックメニューに Bookmation の保存項目を表示します。"

function statusLabel(enabled: boolean): string {
  return enabled ? "有効" : "無効"
}

function toggleLiveMessage(enabled: boolean): string {
  return enabled
    ? "右クリックメニューから保存を有効にしました。"
    : "右クリックメニューから保存を無効にしました。"
}

export function ContextMenuBookmarkSwitch({
  port
}: {
  port: GeneralSettingsPort
}) {
  const [enabled, setEnabled] = React.useState<boolean | null>(null)
  const [pending, setPending] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [liveMessage, setLiveMessage] = React.useState("")
  const generatedId = React.useId()
  const labelId = `context-menu-bookmark-label-${generatedId}`
  const descriptionId = `context-menu-bookmark-description-${generatedId}`
  const statusId = `context-menu-bookmark-status-${generatedId}`

  React.useEffect(() => {
    let cancelled = false

    void port.getSnapshot().then(
      (snapshot) => {
        if (!cancelled) {
          setEnabled(snapshot.contextMenuBookmarkEnabled)
          setLoadError(null)
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "設定を読み込めませんでした。"
          )
        }
      }
    )

    return () => {
      cancelled = true
    }
  }, [port])

  const handleCheckedChange = async (nextEnabled: boolean) => {
    if (enabled === null || pending) {
      return
    }

    setPending(true)
    setSaveError(null)

    try {
      const snapshot = await port.setContextMenuBookmarkEnabled(nextEnabled)
      setEnabled(snapshot.contextMenuBookmarkEnabled)
      setLiveMessage(toggleLiveMessage(snapshot.contextMenuBookmarkEnabled))
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "設定の保存に失敗しました。もう一度お試しください。"
      )
      setLiveMessage(
        error instanceof Error
          ? error.message
          : "設定の保存に失敗しました。もう一度お試しください。"
      )
    } finally {
      setPending(false)
    }
  }

  if (loadError) {
    return (
      <div>
        <h3 className="font-semibold text-bm-ink">{SETTING_LABEL}</h3>
        <p className="mt-1 text-sm text-bm-muted-text">{loadError}</p>
      </div>
    )
  }

  const isLoaded = enabled !== null
  const checked = enabled ?? false
  const statusText = `状態: ${statusLabel(checked)}`

  return (
    <div className="space-y-1">
      <div className="flex w-full items-start justify-between gap-6">
        <div className="min-w-0">
          <h3 className="font-semibold text-bm-ink" id={labelId}>
            {SETTING_LABEL}
          </h3>
          <p className="mt-1 text-sm text-bm-muted-text" id={descriptionId}>
            {SETTING_DESCRIPTION}
          </p>
          {isLoaded ? (
            <p
              aria-live="polite"
              className="mt-1 text-sm font-medium text-bm-muted-text"
              id={statusId}
            >
              {statusText}
            </p>
          ) : null}
        </div>
        <Switch
          aria-describedby={
            isLoaded ? `${descriptionId} ${statusId}` : descriptionId
          }
          aria-labelledby={labelId}
          checked={checked}
          controlOnly
          disabled={!isLoaded}
          label={SETTING_LABEL}
          onCheckedChange={(nextChecked) => {
            void handleCheckedChange(nextChecked)
          }}
          pending={pending || !isLoaded}
        />
      </div>
      {saveError ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {saveError}
        </p>
      ) : null}
      {liveMessage ? (
        <p aria-live="polite" className="sr-only" role="status">
          {liveMessage}
        </p>
      ) : null}
    </div>
  )
}
