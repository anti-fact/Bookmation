/**
 * TASK-007: Prompt API のスパイク実装
 * Dashboard top-level page でPrompt APIの対応条件を検証する。
 *
 * 検証項目:
 * - Availability（利用可能性確認）
 * - モデル取得UX
 * - 日本語分類
 * - 構造化JSON出力
 * - ユーザー操作の必要性
 * - 最低Chrome バージョン
 */

import * as React from "react"
import { Button } from "~/ui/primitives"

type AvailabilityState = "unavailable" | "downloadable" | "downloading" | "available"

type PromptApiApplicationErrorCode =
  | "PROMPT_API_UNAVAILABLE"
  | "PROMPT_MODEL_PREPARING"
  | "PROMPT_MODEL_DOWNLOAD_FAILED"
  | "PROMPT_SESSION_FAILED"
  | "PROMPT_SESSION_ENDED"
  | "PROMPT_INVALID_STRUCTURED_OUTPUT"

type PromptApiMonitor = EventTarget & {
  addEventListener(
    type: "downloadprogress",
    listener: (event: Event & { loaded?: number }) => void
  ): void
}

type PromptApiTest = {
  availability: AvailabilityState | null
  error: string | null
  modelLoading: boolean
  lastTestTime: string | null
  classificationResult: string | null
}

// Chrome Prompt API の型定義
// Chrome v151+ での型定義に合わせる
interface LanguageModelOptions {
  expectedInputs: { type: "text"; languages: string[] }[]
  expectedOutputs: { type: "text"; languages: string[] }[]
  language?: string
  monitor?: (monitor: PromptApiMonitor) => void
  signal?: AbortSignal
}

interface LanguageModelSession {
  prompt: (
    text: string,
    options?: {
      responseConstraint?: Record<string, unknown>
      signal?: AbortSignal
    }
  ) => Promise<string>
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

export function PromptApiTester() {
  const [testState, setTestState] = React.useState<PromptApiTest>({
    availability: null,
    error: null,
    modelLoading: false,
    lastTestTime: null,
    classificationResult: null
  })

  const promptOptions = {
    expectedInputs: [{ type: "text" as const, languages: ["ja"] }],
    expectedOutputs: [{ type: "text" as const, languages: ["ja"] }]
  }

  const setApplicationError = (
    code: PromptApiApplicationErrorCode,
    detail?: string
  ) => {
    setTestState((prev) => ({
      ...prev,
      error: `${code}${detail ? `: ${detail}` : ""}`,
      modelLoading: false
    }))
  }

  const checkAvailability = async () => {
    try {
      // Service Worker では実行しない - top-level extension page のみ
      const lm = window.LanguageModel
      if (!lm) {
        setApplicationError("PROMPT_API_UNAVAILABLE")
        return
      }

      const availability = await lm.availability({
        ...promptOptions
      })

      setTestState((prev) => ({
        ...prev,
        availability: availability,
        error: null,
        lastTestTime: new Date().toISOString()
      }))
    } catch (error) {
      setApplicationError(
        "PROMPT_API_UNAVAILABLE",
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  const testClassification = async () => {
    let session: LanguageModelSession | null = null

    try {
      const lm = window.LanguageModel
      if (!lm) {
        setApplicationError("PROMPT_API_UNAVAILABLE")
        return
      }

      // 最初にAvailabilityを確認
      const availability = await lm.availability({
        ...promptOptions
      })

      if (availability === "unavailable") {
        setTestState((prev) => ({ ...prev, availability }))
        setApplicationError("PROMPT_API_UNAVAILABLE")
        return
      }

      setTestState((prev) => ({
        ...prev,
        modelLoading: true
      }))

      // モデルの作成 - 日本語対応を指定
      session = await lm.create({
        ...promptOptions,
        monitor: (monitor) => {
          monitor.addEventListener("downloadprogress", (event) => {
            const loaded = event.loaded
            if (typeof loaded === "number") {
              setTestState((prev) => ({
                ...prev,
                error: `PROMPT_MODEL_PREPARING: ${Math.round(loaded * 100)}%`
              }))
            }
          })
        }
      })

      // テスト用の分類プロンプト（構造化JSON出力）
      const testBookmark = {
        title: "React Documentation",
        url: "https://react.dev",
        content: "React is a JavaScript library for building user interfaces"
      }

      const prompt = `次のブックマークをカテゴリとタグに分類してください。

ブックマーク:
- タイトル: ${testBookmark.title}
- URL: ${testBookmark.url}

以下のJSON形式で返してください:
{
  "category": "分類されるカテゴリ名（例：開発・技術）",
  "tags": ["タグ1", "タグ2"],
  "confidence": 0.0-1.0の信頼度
}`

      const responseConstraint = {
        type: "object",
        properties: {
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["category", "tags", "confidence"],
        additionalProperties: false
      }
      const result = await session.prompt(prompt, { responseConstraint })
      JSON.parse(result)

      setTestState((prev) => ({
        ...prev,
        modelLoading: false,
        classificationResult: result,
        error: null,
        lastTestTime: new Date().toISOString()
      }))
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : ""
      setApplicationError(
        error instanceof SyntaxError
          ? "PROMPT_INVALID_STRUCTURED_OUTPUT"
          : errorName === "AbortError"
            ? "PROMPT_SESSION_ENDED"
            : testState.availability === "downloadable" ||
                testState.availability === "downloading"
              ? "PROMPT_MODEL_DOWNLOAD_FAILED"
          : "PROMPT_SESSION_FAILED",
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      session?.destroy()
    }
  }

  const getAvailabilityColor = (availability: AvailabilityState | null) => {
    switch (availability) {
      case "available":
        return "text-green-600"
      case "downloading":
        return "text-yellow-600"
      case "downloadable":
        return "text-blue-600"
      case "unavailable":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h2 className="font-semibold text-gray-900">Prompt API スパイク検証</h2>
        <p className="mt-1 text-sm text-gray-600">
          TASK-007: 対応条件とホスト要件の確認
        </p>
      </div>

      {/* Availability チェック */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">
          1. Availability確認
        </h3>
        <div className="flex gap-2">
          <Button onClick={checkAvailability} size="compact">
            Availability チェック
          </Button>
          {testState.availability && (
            <span className={`text-sm font-medium ${getAvailabilityColor(testState.availability)}`}>
              {testState.availability}
            </span>
          )}
        </div>
        {testState.lastTestTime && (
          <p className="text-xs text-gray-500">
            最終テスト時刻: {new Date(testState.lastTestTime).toLocaleString("ja-JP")}
          </p>
        )}
      </div>

      {/* 分類テスト */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">
          2. 日本語分類テスト
        </h3>
        <Button
          onClick={testClassification}
          size="compact"
          disabled={
            (testState.availability !== "available" &&
              testState.availability !== "downloadable" &&
              testState.availability !== "downloading") ||
            testState.modelLoading
          }
        >
          {testState.modelLoading
            ? "モデル準備中..."
            : testState.availability === "available"
              ? "分類テスト実行"
              : "モデルを準備して分類"}
        </Button>
      </div>

      {/* エラー表示 */}
      {testState.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          エラー: {testState.error}
        </div>
      )}

      {/* 結果表示 */}
      {testState.classificationResult && (
        <div className="rounded-md bg-green-50 p-3">
          <h4 className="text-sm font-medium text-green-900">分類結果</h4>
          <pre className="mt-2 overflow-auto rounded bg-white p-2 text-xs text-gray-900">
            {testState.classificationResult}
          </pre>
        </div>
      )}

      {/* 環境情報 */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700">環境情報</h3>
        <dl className="mt-2 space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <dt>LanguageModel 定義:</dt>
            <dd>
              {typeof window.LanguageModel !== "undefined"
                ? "✓ 利用可能"
                : "✗ 利用不可"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>実行コンテキスト:</dt>
            <dd>Top-level page (Service Worker ではなし)</dd>
          </div>
          <div className="flex justify-between">
            <dt>ユーザー操作:</dt>
            <dd>必要（ジェスチャからのみPrompt API実行可能）</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
