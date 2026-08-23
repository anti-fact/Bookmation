import * as React from "react"

import { Button } from "~/ui/primitives"

type AvailabilityState =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available"

type PromptApiMonitor = EventTarget & {
  addEventListener(
    type: "downloadprogress",
    listener: (event: Event & { loaded?: number }) => void
  ): void
}

interface LanguageModelOptions {
  expectedInputs: { type: "text"; languages: string[] }[]
  expectedOutputs: { type: "text"; languages: string[] }[]
  monitor?: (monitor: PromptApiMonitor) => void
}

interface LanguageModelSession {
  destroy: () => void
}

interface LanguageModel {
  availability: (options: LanguageModelOptions) => Promise<AvailabilityState>
  create: (options: LanguageModelOptions) => Promise<LanguageModelSession>
}

declare global {
  interface Window {
    LanguageModel?: LanguageModel
  }
}

const PROMPT_OPTIONS = {
  expectedInputs: [{ type: "text" as const, languages: ["ja"] }],
  expectedOutputs: [{ type: "text" as const, languages: ["ja"] }]
}

const AVAILABILITY_COPY: Record<AvailabilityState, string> = {
  available: "準備済みです。AI仕分けを利用できます。",
  downloadable: "利用するにはモデルのダウンロードが必要です。",
  downloading: "モデルをダウンロードしています。",
  unavailable: "この環境ではGemini Nanoを利用できません。"
}

export function GeminiNanoSettings() {
  const [availability, setAvailability] =
    React.useState<AvailabilityState | null>(null)
  const [checking, setChecking] = React.useState(true)
  const [modelLoading, setModelLoading] = React.useState(false)
  const [downloadProgress, setDownloadProgress] = React.useState<number | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)

  const checkAvailability = React.useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const languageModel = window.LanguageModel
      if (!languageModel) {
        setAvailability("unavailable")
        return
      }
      setAvailability(await languageModel.availability(PROMPT_OPTIONS))
    } catch (availabilityError) {
      setAvailability("unavailable")
      setError(
        `Gemini Nanoの状態を確認できませんでした。${
          availabilityError instanceof Error
            ? ` ${availabilityError.message}`
            : ""
        }`
      )
    } finally {
      setChecking(false)
    }
  }, [])

  React.useEffect(() => {
    void checkAvailability()
  }, [checkAvailability])

  const prepareModel = async () => {
    let session: LanguageModelSession | null = null
    setModelLoading(true)
    setDownloadProgress(null)
    setError(null)

    try {
      const languageModel = window.LanguageModel
      if (!languageModel) {
        setAvailability("unavailable")
        return
      }

      const nextAvailability = await languageModel.availability(PROMPT_OPTIONS)
      setAvailability(nextAvailability)
      if (nextAvailability === "unavailable") return
      if (nextAvailability === "available") return

      setAvailability("downloading")
      session = await languageModel.create({
        ...PROMPT_OPTIONS,
        monitor: (monitor) => {
          monitor.addEventListener("downloadprogress", (event) => {
            if (typeof event.loaded !== "number") return
            setDownloadProgress(
              Math.max(0, Math.min(100, Math.round(event.loaded * 100)))
            )
          })
        }
      })
      setDownloadProgress(100)
      setAvailability("available")
    } catch (preparationError) {
      setAvailability((current) =>
        current === "downloading" ? "downloadable" : current
      )
      setError(
        `Gemini Nanoのダウンロードに失敗しました。${
          preparationError instanceof Error
            ? ` ${preparationError.message}`
            : " もう一度お試しください。"
        }`
      )
    } finally {
      session?.destroy()
      setModelLoading(false)
    }
  }

  const statusCopy = checking
    ? "状態を確認しています。"
    : availability
      ? AVAILABILITY_COPY[availability]
      : "状態を確認してください。"

  const canPrepare =
    availability === "downloadable" || availability === "downloading"

  return (
    <section
      aria-label="Gemini Nano設定"
      className="space-y-4 border-t-2 border-bm-muted pt-6"
    >
      <div>
        <h4 className="m-0 text-base font-semibold text-bm-ink">
          Gemini Nano
        </h4>
        <p className="mt-1 text-sm leading-6 text-bm-muted-text">
          AI仕分けに使うChrome内蔵モデルを、この端末に準備します。
        </p>
      </div>

      <div className="max-w-xl rounded-bm-field border-2 border-bm-border p-4">
        <p aria-live="polite" className="m-0 text-sm text-bm-ink" role="status">
          {statusCopy}
        </p>

        {modelLoading && downloadProgress !== null ? (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-bm-muted-text">
              <label htmlFor="gemini-nano-download-progress">
                ダウンロード進捗
              </label>
              <span>{downloadProgress}%</span>
            </div>
            <progress
              className="h-2 w-full accent-bm-ink"
              id="gemini-nano-download-progress"
              max={100}
              value={downloadProgress}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {canPrepare ? (
            <Button
              disabled={checking}
              loading={modelLoading}
              onClick={() => void prepareModel()}
              size="compact"
            >
              {modelLoading
                ? "モデルを準備中"
                : availability === "downloading"
                  ? "モデルの準備を続ける"
                  : "モデルをダウンロード"}
            </Button>
          ) : null}
          <Button
            disabled={checking || modelLoading}
            onClick={() => void checkAvailability()}
            size="compact"
            variant="quiet"
          >
            {checking ? "確認中" : "状態を再確認"}
          </Button>
        </div>
      </div>

      {availability === "unavailable" && !error ? (
        <p className="m-0 text-sm leading-6 text-bm-muted-text">
          対応するChromeと端末要件を確認し、Chromeを再起動してから再確認してください。
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
