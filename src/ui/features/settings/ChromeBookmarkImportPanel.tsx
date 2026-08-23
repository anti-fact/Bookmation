import * as React from "react"

import { autoReuseFolderResolutions } from "~/domain"
import { parseNetscapeBookmarkHtml, type ParsedChromeBookmarkEntry } from "~/domain"
import { Button } from "~/ui/primitives"
import {
  ChromeBookmarkImportPortError,
  type ChromeBookmarkImportPort,
  type ChromeImportPreview,
} from "~/ui/features/settings/chrome-bookmark-import-port"

function importErrorMessage(error: unknown): string {
  if (error instanceof ChromeBookmarkImportPortError) {
    switch (error.code) {
      case "ACTION_NOT_AVAILABLE":
      case "INVALID_MESSAGE":
        return "拡張機能を再読み込みしてから、もう一度お試しください。"
      case "INTERNAL_ERROR":
        return "拡張機能との通信に失敗しました。拡張機能を再読み込みしてください。"
      default:
        return "プレビューの取得に失敗しました。"
    }
  }
  return "HTML ファイルの読み込みに失敗しました。"
}

function folderSkipLabel(reason: string): string {
  switch (reason) {
    case "FOLDER_NAME_INVALID":
      return "フォルダ名が不正"
    case "TAG_NAME_RESERVED":
      return "同名タグが削除済みで予約中"
    case "FOLDER_SKIPPED":
      return "フォルダ単位でスキップ"
    case "DUPLICATE_URL":
      return "既に登録済み"
    case "URL_INVALID":
    case "URL_NOT_ALLOWED":
      return "URLが不正"
    default:
      return reason
  }
}

function folderResolutionLabel(
  folder: ChromeImportPreview["folders"][number],
): string {
  if (folder.mode === "REUSE") {
    return `タグ付与: ${folder.tagName}`
  }
  if (folder.mode === "UNCLASSIFIED") {
    return `未分類で取り込み（予定タグ: ${folder.plannedTagName}）`
  }
  return `スキップ (${folder.reason})`
}

export function ChromeBookmarkImportPanel({
  importPort,
  onImported,
}: {
  importPort: ChromeBookmarkImportPort
  onImported?: () => void
}) {
  const [entries, setEntries] = React.useState<ParsedChromeBookmarkEntry[]>([])
  const [preview, setPreview] = React.useState<ChromeImportPreview | null>(null)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const importableCount = preview?.entries.filter((entry) => entry.importable).length ?? 0
  const canCommit = !!preview && importableCount > 0

  const handleFile = async (file: File) => {
    setPending(true)
    setError(null)
    setMessage(null)
    setSelectedFileName(file.name)
    try {
      const html = await file.text()
      const parsed = parseNetscapeBookmarkHtml(html)
      if (parsed.length === 0) {
        setError("ブックマークが見つかりませんでした。")
        setEntries([])
        setPreview(null)
        return
      }
      setEntries(parsed)
      const nextPreview = await importPort.preview(parsed)
      setPreview(nextPreview)
      const importable = nextPreview.entries.filter((entry) => entry.importable).length
      setMessage(`${parsed.length} 件を読み込みました。取り込み可能 ${importable} 件。`)
    } catch (error) {
      setError(importErrorMessage(error))
      setEntries([])
      setPreview(null)
    } finally {
      setPending(false)
    }
  }

  const handleCommit = async () => {
    if (!preview || !canCommit) return
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const commitRequestId = crypto.randomUUID()
      const result = await importPort.commit({
        commitRequestId,
        selectionFingerprint: preview.selectionFingerprint,
        entries,
        folderResolutions: autoReuseFolderResolutions(preview.folders),
      })
      setMessage(
        `取り込み完了: ${result.imported} 件 / 重複スキップ ${result.skippedDuplicate} 件 / その他スキップ ${result.skippedOther} 件 / 失敗 ${result.failed} 件`,
      )
      onImported?.()
      const refreshed = await importPort.preview(entries)
      setPreview(refreshed)
    } catch (error) {
      setError(importErrorMessage(error) || "取り込みに失敗しました。もう一度お試しください。")
    } finally {
      setPending(false)
    }
  }

  return (
    <fieldset className="space-y-4 border-t-2 border-bm-muted pt-6">
      <legend className="text-base font-semibold text-bm-ink">
        Chrome ブックマークの取り込み
      </legend>
      <p className="m-0 text-sm leading-6 text-bm-muted-text">
        Chrome ブックマークマネージャーからエクスポートした HTML
        ファイルを選びます。まずは未分類のブックマークとして追加します。同名タグが既にある場合のみ、そのタグを 1 件付与します。
      </p>
      <input
        accept=".html,text/html"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.target.value = ""
        }}
        ref={fileInputRef}
        type="file"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          type="button"
          variant="outline"
        >
          HTML ファイルを選択
        </Button>
        {selectedFileName ? (
          <p className="m-0 text-sm text-bm-muted-text">選択中: {selectedFileName}</p>
        ) : null}
      </div>

      {preview ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-bm-field border-2 border-bm-border">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-bm-border bg-bm-muted/30 text-left">
                  <th className="px-3 py-2 font-semibold">フォルダ</th>
                  <th className="px-3 py-2 font-semibold">件数</th>
                  <th className="px-3 py-2 font-semibold">取り込み方法</th>
                </tr>
              </thead>
              <tbody>
                {preview.folders.map((folder) => (
                  <tr className="border-b border-bm-border/60" key={folder.sourceFolderKey}>
                    <td className="px-3 py-2">{folder.folderName}</td>
                    <td className="px-3 py-2">{folder.bookmarkCount}</td>
                    <td className="px-3 py-2">{folderResolutionLabel(folder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="text-sm text-bm-muted-text">
            <summary className="cursor-pointer font-medium text-bm-ink">
              各 URL のプレビュー ({preview.entries.length} 件)
            </summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pl-4">
              {preview.entries.map((entry) => (
                <li key={entry.entryId}>
                  {entry.importable ? "✓" : "–"} {entry.title || entry.url}
                  {entry.skipReason ? ` (${folderSkipLabel(entry.skipReason)})` : ""}
                </li>
              ))}
            </ul>
          </details>

          <Button disabled={pending || !canCommit} onClick={() => void handleCommit()} type="button">
            {importableCount} 件を取り込む
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p aria-live="polite" className="m-0 text-sm text-bm-muted-text" role="status">
          {message}
        </p>
      ) : null}
    </fieldset>
  )
}
