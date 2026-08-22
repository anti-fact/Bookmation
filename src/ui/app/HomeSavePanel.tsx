import * as React from "react"

import {
  MESSAGE_SCHEMA_VERSION,
  type ExtensionResponse,
  type ListRecentBookmarksResponse,
  type SaveBookmarkResponse,
} from "~/extension/messages"
import { Button } from "~/ui/primitives"

async function sendMessage<T extends ExtensionResponse>(
  payload: Record<string, unknown>,
): Promise<T> {
  const response = (await chrome.runtime.sendMessage(payload)) as T
  if (chrome.runtime.lastError) {
    throw new Error(chrome.runtime.lastError.message)
  }
  return response
}

export function HomeSavePanel() {
  const [rawUrl, setRawUrl] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [status, setStatus] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [recent, setRecent] = React.useState<
    ListRecentBookmarksResponse["items"]
  >([])

  const loadRecent = React.useCallback(async () => {
    const response = await sendMessage<ListRecentBookmarksResponse>({
      schemaVersion: MESSAGE_SCHEMA_VERSION,
      action: "LIST_RECENT_BOOKMARKS",
      requestId: crypto.randomUUID(),
      limit: 8,
    })
    if (response.ok) {
      setRecent(response.items)
    }
  }, [])

  React.useEffect(() => {
    void loadRecent().catch(() => {
      setRecent([])
    })
  }, [loadRecent])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setStatus(null)
    try {
      const response = await sendMessage<SaveBookmarkResponse>({
        schemaVersion: MESSAGE_SCHEMA_VERSION,
        action: "SAVE_BOOKMARK_BY_URL",
        requestId: crypto.randomUUID(),
        rawUrl,
        title: title.trim().length > 0 ? title : undefined,
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
      if (!response.duplicate) {
        setRawUrl("")
        setTitle("")
      }
      await loadRecent()
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="rounded-bm-dialog border border-bm-muted bg-bm-paper p-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <h2 className="m-0 text-sm font-semibold">URL を保存</h2>
        <p className="mt-1 text-xs text-bm-muted-text">
          http または https の URL を入力して保存します。
        </p>
        <label className="mt-3 block text-xs font-medium">
          URL
          <input
            className="mt-1 w-full rounded border border-bm-muted px-2 py-1.5 text-sm"
            type="url"
            required
            value={rawUrl}
            onChange={(event) => setRawUrl(event.target.value)}
            placeholder="https://example.com"
          />
        </label>
        <label className="mt-3 block text-xs font-medium">
          タイトル（任意）
          <input
            className="mt-1 w-full rounded border border-bm-muted px-2 py-1.5 text-sm"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="未入力時はページタイトルまたはホスト名"
          />
        </label>
        <div className="mt-4">
          <Button size="compact" type="submit" disabled={isSaving}>
            保存する
          </Button>
        </div>
        {status ? (
          <p className="mt-3 text-xs text-bm-muted-text" role="status">
            {status}
          </p>
        ) : null}
      </form>

      <section aria-label="最近追加したブックマーク">
        <h2 className="m-0 text-sm font-semibold">最近追加</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-xs text-bm-muted-text">
            まだブックマークがありません。
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {recent.map((item) => (
              <li
                key={item.id}
                className="rounded border border-bm-muted px-3 py-2 text-xs"
              >
                <p className="m-0 font-medium text-bm-ink">{item.title}</p>
                <p className="m-0 mt-1 truncate text-bm-muted-text">
                  {item.normalizedUrl}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
