import * as React from "react"

import { Select, Slider, Switch } from "~/ui/primitives"

import { GeminiNanoSettings } from "./GeminiNanoSettings"
import type {
  AiGranularity,
  GeneralSettingsPort,
  GeneralSettingsSnapshot
} from "./general-settings-port"

const WINDOW_OPTIONS = [
  { label: "1週間", value: "LAST_7_DAYS" },
  { label: "1ヶ月", value: "LAST_30_DAYS" },
  { label: "1年", value: "LAST_365_DAYS" }
] as const

const WINDOW_MAX = {
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
  LAST_365_DAYS: 365
} as const

const GRANULARITY_COPY = [
  [
    "再利用を最優先",
    "関連する既存タグを強く優先し、中心主題に必要な場合だけ新規作成します。"
  ],
  ["粗い", "広めの既存タグを再利用し、新規作成は中心概念に絞ります。"],
  ["標準", "十分近い既存タグを再利用し、中心概念と主要概念を補います。"],
  ["細かい", "主要機能や仕組みまで、明示された概念を詳しく分類します。"],
  [
    "最も細かい",
    "表記揺れは既存タグを再利用し、独立した概念を細部まで分類します。"
  ]
] as const

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "設定の保存に失敗しました。もう一度お試しください。"
}

function SettingSwitchRow({
  checked,
  description,
  disabled,
  label,
  onCheckedChange
}: {
  checked: boolean
  description: string
  disabled: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="space-y-1">
      <Switch
        checked={checked}
        description={description}
        disabled={disabled}
        label={label}
        onCheckedChange={onCheckedChange}
        pending={disabled}
      />
      <p className="m-0 pl-2 text-xs font-medium text-bm-muted-text">
        状態: {checked ? "有効" : "無効"}
      </p>
    </div>
  )
}

export function GeneralSettingsSection({ port }: { port: GeneralSettingsPort }) {
  const [snapshot, setSnapshot] =
    React.useState<GeneralSettingsSnapshot | null>(null)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [liveMessage, setLiveMessage] = React.useState("")
  const [visitDaysDraft, setVisitDaysDraft] = React.useState("")
  const [archiveDaysDraft, setArchiveDaysDraft] = React.useState("30")
  const [granularityDraft, setGranularityDraft] =
    React.useState<AiGranularity>(0)

  const applySnapshot = React.useCallback((next: GeneralSettingsSnapshot) => {
    setSnapshot(next)
    setVisitDaysDraft(
      next.frequentVisitDayThreshold === null
        ? ""
        : String(next.frequentVisitDayThreshold)
    )
    setArchiveDaysDraft(String(next.archiveAfterDays))
    setGranularityDraft(next.aiGranularity)
  }, [])

  React.useEffect(() => {
    let active = true
    void port.getSnapshot().then(
      (next) => {
        if (!active) return
        applySnapshot(next)
      },
      (loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      }
    )
    const unsubscribe = port.subscribePermissionChanges((next) => {
      if (!active) return
      applySnapshot(next)
      setLiveMessage(
        "履歴へのアクセスが取り消されたため、自動アーカイブを無効にしました。"
      )
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [applySnapshot, port])

  const save = async (
    operation: () => Promise<GeneralSettingsSnapshot>,
    successMessage: string,
    onFailure?: () => void
  ) => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      applySnapshot(await operation())
      setLiveMessage(successMessage)
    } catch (saveError: unknown) {
      onFailure?.()
      const message = errorMessage(saveError)
      setError(message)
      setLiveMessage(message)
    } finally {
      setPending(false)
    }
  }

  if (!snapshot) {
    return (
      <div className="space-y-2" aria-busy={!error}>
        <h3 className="m-0 font-semibold text-bm-ink">一般設定</h3>
        <p
          className="m-0 text-sm text-bm-muted-text"
          role={error ? "alert" : undefined}
        >
          {error ?? "設定を読み込んでいます。"}
        </p>
      </div>
    )
  }

  const visitMax = snapshot.frequentVisitWindow
    ? WINDOW_MAX[snapshot.frequentVisitWindow]
    : undefined
  const granularityCopy = GRANULARITY_COPY[granularityDraft]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="m-0 text-lg font-semibold text-bm-ink">一般設定</h3>
        <p className="mt-1 text-sm text-bm-muted-text">
          ブックマークの提案、整理、保存方法を設定します。
        </p>
      </div>

      <fieldset className="m-0 space-y-5 border-0 p-0" disabled={pending}>
        <legend className="mb-4 text-base font-semibold text-bm-ink">
          訪問リマインダー
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            className="w-48 max-w-full"
            disabled={pending}
            label="訪問の集計期間"
            onValueChange={(value) => {
              setVisitDaysDraft("")
              void save(
                () =>
                  port.updateSettings({
                    frequentVisitDayThreshold: null,
                    frequentVisitWindow: value as keyof typeof WINDOW_MAX
                  }),
                "訪問の集計期間を変更しました。訪問日数を入力してください。"
              )
            }}
            options={[...WINDOW_OPTIONS]}
            placeholder="期間を選択"
            size="compact"
            value={snapshot.frequentVisitWindow ?? ""}
          />
          <label className="grid gap-2 text-sm font-semibold text-bm-ink">
            リマインダー表示までの訪問日数
            <span className="flex items-center gap-2">
              <input
                className="h-10 w-24 rounded-bm-field border-2 border-bm-border bg-bm-paper px-3 text-sm text-bm-ink outline-none focus-visible:ring-2 focus-visible:ring-bm-focus disabled:cursor-not-allowed disabled:opacity-45"
                disabled={pending || !snapshot.frequentVisitWindow}
                inputMode="numeric"
                max={visitMax}
                min={1}
                onBlur={() => {
                  if (visitDaysDraft === "") {
                    void save(
                      () =>
                        port.updateSettings({
                          frequentVisitDayThreshold: null
                        }),
                      "訪問日数を未設定にしました。"
                    )
                    return
                  }
                  const value = Number(visitDaysDraft)
                  if (
                    !Number.isInteger(value) ||
                    value < 1 ||
                    value > (visitMax ?? 0)
                  ) {
                    setError(
                      `訪問日数は1〜${visitMax}の整数で入力してください。`
                    )
                    setVisitDaysDraft(
                      snapshot.frequentVisitDayThreshold === null
                        ? ""
                        : String(snapshot.frequentVisitDayThreshold)
                    )
                    return
                  }
                  void save(
                    () =>
                      port.updateSettings({ frequentVisitDayThreshold: value }),
                    "訪問日数を保存しました。"
                  )
                }}
                onChange={(event) => setVisitDaysDraft(event.target.value)}
                type="number"
                value={visitDaysDraft}
              />
              <span className="font-normal">日</span>
            </span>
          </label>
        </div>
        <SettingSwitchRow
          checked={snapshot.frequentVisitReminderEnabled}
          description="オンにすると、目的を説明したうえで履歴と通知へのアクセスを確認します。"
          disabled={pending}
          label="自動ブックマークのリマインダー"
          onCheckedChange={(enabled) => {
            void save(
              () => port.setFrequentVisitReminderEnabled(enabled),
              `リマインダーを${enabled ? "有効" : "無効"}にしました。`
            )
          }}
        />
      </fieldset>

      <fieldset
        className="m-0 space-y-5 border-0 border-t-2 border-bm-muted p-0 pt-6"
        disabled={pending}
      >
        <legend className="sr-only">アーカイブ設定</legend>
        <SettingSwitchRow
          checked={snapshot.autoArchiveEnabled}
          description="オンにすると、目的を説明したうえで履歴へのアクセスを確認します。"
          disabled={pending}
          label="自動アーカイブ"
          onCheckedChange={(enabled) => {
            void save(
              () => port.setAutoArchiveEnabled(enabled),
              `自動アーカイブを${enabled ? "有効" : "無効"}にしました。`
            )
          }}
        />
        <label className="grid max-w-sm gap-2 text-sm font-semibold text-bm-ink">
          アーカイブ化の閾値
          <span className="flex items-center gap-2">
            <input
              className="h-10 w-24 rounded-bm-field border-2 border-bm-border bg-bm-paper px-3 text-sm text-bm-ink outline-none focus-visible:ring-2 focus-visible:ring-bm-focus disabled:cursor-not-allowed disabled:opacity-45"
              disabled={pending}
              inputMode="numeric"
              min={1}
              onBlur={() => {
                const value = Number(archiveDaysDraft)
                if (!Number.isInteger(value) || value < 1) {
                  setError("アーカイブ日数は1以上の整数で入力してください。")
                  setArchiveDaysDraft(String(snapshot.archiveAfterDays))
                  return
                }
                void save(
                  () => port.updateSettings({ archiveAfterDays: value }),
                  "アーカイブ日数を保存しました。"
                )
              }}
              onChange={(event) => setArchiveDaysDraft(event.target.value)}
              type="number"
              value={archiveDaysDraft}
            />
            <span className="font-normal">日</span>
          </span>
        </label>
      </fieldset>

      <GeminiNanoSettings />

      <div className="space-y-4 border-t-2 border-bm-muted pt-6">
        <Slider
          disabled={pending}
          formatValue={(value) =>
            `${value}: ${GRANULARITY_COPY[value]?.[0] ?? ""}`
          }
          label="AIタグの細分化"
          max={4}
          min={0}
          onValueChange={(value) => {
            setGranularityDraft(value as AiGranularity)
          }}
          onValueCommit={([value]) => {
            void save(
              () =>
                port.updateSettings({ aiGranularity: value as AiGranularity }),
              "AIタグの細分化を保存しました。",
              () => setGranularityDraft(snapshot.aiGranularity)
            )
          }}
          showMarks
          step={1}
          value={granularityDraft}
        />
        <p className="m-0 text-sm leading-6 text-bm-muted-text">
          <strong className="text-bm-ink">{granularityCopy[0]}:</strong>{" "}
          {granularityCopy[1]} 値はタグ件数の上限ではありません。
        </p>
      </div>

      <div className="border-t-2 border-bm-muted pt-6">
        <SettingSwitchRow
          checked={snapshot.contextMenuBookmarkEnabled}
          description="ページおよびリンクの右クリックメニューにBookmationの保存項目を表示します。"
          disabled={pending}
          label="右クリックメニューから保存"
          onCheckedChange={(enabled) => {
            void save(
              () => port.setContextMenuBookmarkEnabled(enabled),
              `右クリックメニューから保存を${enabled ? "有効" : "無効"}にしました。`
            )
          }}
        />
      </div>

      {error ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only" role="status">
        {liveMessage}
      </p>
    </div>
  )
}
