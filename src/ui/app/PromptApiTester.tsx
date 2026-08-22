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
  expectedInputs: { type: string }[]
  expectedOutputs: { type: string }[]
  language?: string
}

interface LanguageModelSession {
  prompt: (text: string) => Promise<string>
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

  const checkAvailability = async () => {
    try {
      // Service Worker では実行しない - top-level extension page のみ
      const lm = window.LanguageModel
      if (!lm) {
        setTestState((prev) => ({
          ...prev,
          error: "LanguageModel is not available in this context"
        }))
        return
      }

      const availability = await lm.availability({
        // Chrome v151+ では expectedInputs/expectedOutputs は {type: string}[] 形式
        expectedInputs: [{ type: "text" }],
        expectedOutputs: [{ type: "text" }],
        language: "ja"
      })

      setTestState((prev) => ({
        ...prev,
        availability: availability,
        error: null,
        lastTestTime: new Date().toISOString()
      }))
    } catch (error) {
      setTestState((prev) => ({
        ...prev,
        error: `Availability check failed: ${error instanceof Error ? error.message : String(error)}`,
        availability: null
      }))
    }
  }

  const testClassification = async () => {
    try {
      const lm = window.LanguageModel
      if (!lm) {
        setTestState((prev) => ({
          ...prev,
          error: "LanguageModel is not available"
        }))
        return
      }

      // 最初にAvailabilityを確認
      const availability = await lm.availability({
        expectedInputs: [{ type: "text" }],
        expectedOutputs: [{ type: "text" }],
        language: "ja"
      })

      if (availability !== "available") {
        setTestState((prev) => ({
          ...prev,
          availability,
          error: `Model not available: ${availability}`
        }))
        return
      }

      setTestState((prev) => ({
        ...prev,
        modelLoading: true
      }))

      // モデルの作成 - 日本語対応を指定
      const session = await lm.create({
        expectedInputs: [{ type: "text" }],
        expectedOutputs: [{ type: "text" }],
        language: "ja"
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

      const result = await session.prompt(prompt)

      setTestState((prev) => ({
        ...prev,
        modelLoading: false,
        classificationResult: result,
        error: null,
        lastTestTime: new Date().toISOString()
      }))
    } catch (error) {
      setTestState((prev) => ({
        ...prev,
        modelLoading: false,
        error: `Classification test failed: ${error instanceof Error ? error.message : String(error)}`
      }))
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
    // 外側の設定内容sectionが持つpaddingをそのまま使い、他の設定説明と左端を揃えます。
    <section aria-label="Prompt API スパイク設定" className="space-y-4">
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
          disabled={testState.availability !== "available" || testState.modelLoading}
        >
          {testState.modelLoading ? "モデル準備中..." : "分類テスト実行"}
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
    </section>
  )
}
