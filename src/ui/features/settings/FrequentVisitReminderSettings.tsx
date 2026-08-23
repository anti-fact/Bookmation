import * as React from "react"

import type { FrequentVisitWindow } from "~/domain/types"
import { Switch } from "~/ui/primitives"
import { Select, type SelectOption } from "~/ui/primitives/select"

import type { GeneralSettingsPort } from "./general-settings-port"

const WINDOW_OPTIONS: SelectOption[] = [
  { label: "1週間", value: "LAST_7_DAYS" },
  { label: "1ヶ月", value: "LAST_30_DAYS" },
  { label: "1年", value: "LAST_365_DAYS" }
]

const WINDOW_MAX_DAYS: Record<FrequentVisitWindow, number> = {
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
  LAST_365_DAYS: 365
}

export function FrequentVisitReminderSettings({
  port
}: {
  port: GeneralSettingsPort
}) {
  const [enabled, setEnabled] = React.useState(false)
  const [window, setWindow] = React.useState<FrequentVisitWindow | null>(null)
  const [dayThreshold, setDayThreshold] = React.useState<string>("")
  const [pending, setPending] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const labelId = React.useId()

  React.useEffect(() => {
    let cancelled = false
    void port.getSnapshot().then(
      (snapshot) => {
        if (!cancelled) {
          setEnabled(snapshot.frequentVisitReminderEnabled)
          setWindow(snapshot.frequentVisitWindow)
          setDayThreshold(
            snapshot.frequentVisitDayThreshold === null
              ? ""
              : String(snapshot.frequentVisitDayThreshold)
          )
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

  const applyPatch = async (patch: {
    frequentVisitReminderEnabled?: boolean
    frequentVisitWindow?: FrequentVisitWindow | null
    frequentVisitDayThreshold?: number | null
  }) => {
    setPending(true)
    setSaveError(null)
    try {
      const snapshot = await port.updateReminderSettings(patch)
      setEnabled(snapshot.frequentVisitReminderEnabled)
      setWindow(snapshot.frequentVisitWindow)
      setDayThreshold(
        snapshot.frequentVisitDayThreshold === null
          ? ""
          : String(snapshot.frequentVisitDayThreshold)
      )
    } catch (error: unknown) {
      setSaveError(
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
        <h3 className="font-semibold text-bm-ink">
          自動ブックマークのリマインダー
        </h3>
        <p className="mt-1 text-sm text-bm-muted-text">{loadError}</p>
      </div>
    )
  }

  const windowValue = window ?? ""
  const maxDays = window ? WINDOW_MAX_DAYS[window] : null

  return (
    <div className="space-y-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-bm-ink" id={labelId}>
            自動ブックマークのリマインダー
          </h3>
          <Switch
            aria-labelledby={labelId}
            checked={enabled}
            controlOnly
            disabled={pending}
            label="自動ブックマークのリマインダー"
            onCheckedChange={(nextEnabled) => {
              void applyPatch({ frequentVisitReminderEnabled: nextEnabled })
            }}
            pending={pending}
          />
        </div>
        <p className="text-sm text-bm-muted-text">
          Bookmation
          拡張機能の履歴権限を許可した場合だけ、よく訪問する未保存ページを知らせます（Chrome
          アカウントの同期設定とは別です）。
        </p>
      </div>
      <Select
        className="w-48 max-w-full"
        disabled={pending || !enabled}
        label="訪問の集計期間"
        onValueChange={(value) => {
          void applyPatch({
            frequentVisitWindow: value as FrequentVisitWindow,
            frequentVisitDayThreshold: null
          })
        }}
        options={WINDOW_OPTIONS}
        placeholder="選択してください"
        size="compact"
        value={windowValue}
      />
      <label className="block max-w-xl">
        <span className="block text-sm font-semibold text-bm-ink">
          リマインダー表示までの訪問日数
        </span>
        <span className="mt-1 flex items-center gap-2">
          <input
            className="w-24 rounded-bm-field border-2 border-bm-border px-3 py-2 text-sm"
            disabled={pending || !enabled || window === null}
            min={1}
            max={maxDays ?? undefined}
            onChange={(event) => setDayThreshold(event.target.value)}
            onBlur={() => {
              const trimmed = dayThreshold.trim()
              if (trimmed.length === 0) {
                void applyPatch({ frequentVisitDayThreshold: null })
                return
              }
              const parsed = Number(trimmed)
              if (!Number.isInteger(parsed) || maxDays === null) {
                return
              }
              if (parsed < 1 || parsed > maxDays) {
                setSaveError(`1〜${maxDays}の整数を入力してください。`)
                return
              }
              void applyPatch({ frequentVisitDayThreshold: parsed })
            }}
            type="number"
            value={dayThreshold}
          />
          <span className="text-sm text-bm-muted-text">日</span>
        </span>
        <span className="mt-1 block text-sm text-bm-muted-text">
          初回は空欄です。期間を変更すると入力がクリアされます。
        </span>
      </label>
      {saveError ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
