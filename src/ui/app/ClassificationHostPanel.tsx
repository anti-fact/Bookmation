/**
 * AI Host: Gemini Nano で PENDING Job を1件分類する UI
 * Dashboard top-level page でのみ LanguageModel を呼ぶ。
 */
import * as React from "react"
import { Button } from "~/ui/primitives"
import { createGeminiNanoClassificationProvider } from "~/adapters/prompt-api/gemini-nano-classification-provider"
import {
  defaultPolicyFromJobPolicy,
  runOneClassificationJob,
  type ClaimedClassificationContext,
  type ClassificationHostRunResult,
} from "~/application/classification-host-runner"
import type { ApplicableCandidate } from "~/domain"
import { EXTENSION_MESSAGE_SCHEMA_VERSION } from "~/extension/messages"

type MessageOk = { ok: true; data: unknown; requestId: string | null }
type MessageNg = { ok: false; error: { code: string }; requestId: string | null }

async function sendAiHostMessage(
  action: string,
  payload: Record<string, unknown>,
): Promise<MessageOk | MessageNg> {
  const requestId = crypto.randomUUID()
  const response = (await chrome.runtime.sendMessage({
    schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
    requestId,
    source: "ai-host",
    action,
    payload,
  })) as MessageOk | MessageNg
  if (chrome.runtime.lastError) {
    return {
      ok: false,
      requestId,
      error: { code: chrome.runtime.lastError.message ?? "INTERNAL_ERROR" },
    }
  }
  return response
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function sendDashboardMessage(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<MessageOk | MessageNg> {
  const requestId = crypto.randomUUID()
  const response = (await chrome.runtime.sendMessage({
    schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
    requestId,
    source: "dashboard",
    action,
    payload,
  })) as MessageOk | MessageNg
  if (chrome.runtime.lastError) {
    return {
      ok: false,
      requestId,
      error: { code: chrome.runtime.lastError.message ?? "INTERNAL_ERROR" },
    }
  }
  return response
}

export function ClassificationHostPanel() {
  const [executorInstanceId] = React.useState(() => crypto.randomUUID())
  const [busy, setBusy] = React.useState(false)
  const [capability, setCapability] = React.useState<string | null>(null)
  const [lastResult, setLastResult] = React.useState<ClassificationHostRunResult | null>(
    null,
  )
  const [error, setError] = React.useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = React.useState<number | null>(null)
  const [seedSummary, setSeedSummary] = React.useState<string | null>(null)

  const refreshCapability = async () => {
    const provider = createGeminiNanoClassificationProvider()
    const cap = await provider.capability()
    setCapability(cap.state)
    setError(null)
  }

  const seedLabels = async () => {
    setBusy(true)
    setError(null)
    setSeedSummary(null)
    try {
      const res = await sendDashboardMessage("seed-dev-classification-labels")
      if (!res.ok) {
        throw new Error(res.error.code)
      }
      setSeedSummary(JSON.stringify(res.data))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const runOnce = async () => {
    setBusy(true)
    setError(null)
    setLastResult(null)
    setDownloadProgress(null)
    try {
      const provider = createGeminiNanoClassificationProvider({
        onDownloadProgress: (loaded) => setDownloadProgress(loaded),
      })

      const result = await runOneClassificationJob({
        provider,
        ports: {
          async claim(): Promise<ClaimedClassificationContext | null> {
            const res = await sendAiHostMessage("claim-classification-job", {
              executorInstanceId,
            })
            if (!res.ok) {
              throw new Error(res.error.code)
            }
            const data = asRecord(res.data)
            const job = asRecord(data?.job)
            const bookmark = asRecord(data?.bookmark)
            const labels = asRecord(data?.labels)
            if (!job || !bookmark || !labels) return null

            const categoriesRaw = Array.isArray(labels.categories)
              ? labels.categories
              : []
            const tagsRaw = Array.isArray(labels.existingTags)
              ? labels.existingTags
              : []

            return {
              jobId: String(job.id),
              executorInstanceId,
              bookmarkRevision: Number(bookmark.revision),
              bookmarkTitle: String(bookmark.title ?? ""),
              bookmarkNormalizedUrl: String(bookmark.normalizedUrl ?? ""),
              policy: defaultPolicyFromJobPolicy(job.policy),
              categories: categoriesRaw.map((c) => {
                const r = asRecord(c)!
                return {
                  id: String(r.id),
                  name: String(r.name),
                  revision: Number(r.revision),
                }
              }),
              existingTags: tagsRaw.map((t) => {
                const r = asRecord(t)!
                return {
                  id: String(r.id),
                  name: String(r.name),
                  normalizedName: String(r.normalizedName ?? r.name),
                  origin: r.origin as "USER" | "AI" | "IMPORT" | "SHARE",
                  revision: Number(r.revision),
                  parentCategoryId: String(r.parentCategoryId),
                  parentCategoryRevision: Number(r.parentCategoryRevision),
                  deletedAt: null,
                }
              }),
            }
          },

          async applyValidated(args: {
            jobId: string
            executorInstanceId: string
            bookmarkRevision: number
            categoryId: string
            candidates: ApplicableCandidate[]
          }) {
            const res = await sendAiHostMessage("apply-validated-classification", {
              jobId: args.jobId,
              executorInstanceId: args.executorInstanceId,
              bookmarkRevision: args.bookmarkRevision,
              categoryId: args.categoryId,
              candidates: args.candidates as unknown as Record<string, unknown>[],
            })
            if (!res.ok) throw new Error(res.error.code)
          },

          async applyTerminal(args) {
            const res = await sendAiHostMessage("apply-classification-result", {
              jobId: args.jobId,
              executorInstanceId: args.executorInstanceId,
              bookmarkRevision: args.bookmarkRevision,
              outcome: args.outcome,
              errorCode: args.errorCode,
            })
            if (!res.ok) throw new Error(res.error.code)
          },
        },
      })

      setLastResult(result)
      const cap = await provider.capability()
      setCapability(cap.state)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Gemini Nano 分類 Host" className="space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Gemini Nano 分類 Host</h2>
        <p className="mt-1 text-sm text-gray-600">
          Dashboard（top-level）だけで Prompt API を呼び、PENDING Job を1件分類します。
          Service Worker では実行しません。Category が無いと
          <code className="mx-1">CATEGORY_INVALID</code>
          になるため、先にテスト用ラベルを投入してください。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void seedLabels()} disabled={busy}>
          テスト用ラベルを投入
        </Button>
        <Button type="button" variant="outline" onClick={() => void refreshCapability()} disabled={busy}>
          可用性を確認
        </Button>
        <Button type="button" onClick={() => void runOnce()} disabled={busy}>
          {busy ? "分類中…" : "次の Job を分類"}
        </Button>
      </div>

      <dl className="grid gap-1 text-sm text-gray-800">
        {seedSummary && (
          <div className="flex gap-2">
            <dt className="font-medium">seed:</dt>
            <dd className="break-all font-mono text-xs">{seedSummary}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="font-medium">capability:</dt>
          <dd>{capability ?? "（未確認）"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">executor:</dt>
          <dd className="break-all font-mono text-xs">{executorInstanceId}</dd>
        </div>
        {downloadProgress !== null && (
          <div className="flex gap-2">
            <dt className="font-medium">download:</dt>
            <dd>{Math.round(downloadProgress * 100)}%</dd>
          </div>
        )}
        {error && (
          <div className="flex gap-2 text-red-700">
            <dt className="font-medium">error:</dt>
            <dd>{error}</dd>
          </div>
        )}
        {lastResult && (
          <div className="flex gap-2">
            <dt className="font-medium">result:</dt>
            <dd className="break-all font-mono text-xs">
              {JSON.stringify(lastResult)}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
