import * as React from "react"

import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageResponse,
} from "~/extension/messages"
import { Button } from "~/ui/primitives"

type RecentBookmarkItem = {
  id: string
  title: string
  normalizedUrl: string
  savedAt: number
}

type ListBookmarksData = {
  items: RecentBookmarkItem[]
}

type SaveBookmarkData = {
  duplicate: boolean
  status: "saved" | "duplicate"
}

async function sendDashboardMessage(
  action: "save-bookmark-by-url" | "list-bookmarks",
  payload: Record<string, unknown>,
): Promise<ExtensionMessageResponse> {
  const requestId = crypto.randomUUID()
  const response = (await chrome.runtime.sendMessage({
    schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
    action,
    payload,
    requestId,
    source: "dashboard",
  })) as ExtensionMessageResponse

  if (chrome.runtime.lastError) {
    throw new Error(chrome.runtime.lastError.message)
  }
  return response
}

function errorMessage(response: ExtensionMessageResponse): string {
  if (response.ok) {
    return "保存に失敗しました"
  }
  switch (response.error.code) {
    case "INVALID_MESSAGE":
      return "リクエスト形式が正しくありません"
    case "ACTION_NOT_AVAILABLE":
      return "現在この URL は保存できません"
    default:
      return "保存に失敗しました"
  }
}

export function HomeSavePanel({
  onSaved,
  showRecent = true,
}: {
  onSaved?: () => void
  showRecent?: boolean
}) {
  const [rawUrl, setRawUrl] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [status, setStatus] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [recent, setRecent] = React.useState<RecentBookmarkItem[]>([])

  const loadRecent = React.useCallback(async () => {
    const response = await sendDashboardMessage("list-bookmarks", { limit: 8 })
    if (response.ok) {
      const data = response.data as ListBookmarksData
      setRecent(Array.isArray(data.items) ? data.items : [])
    }
  }, [])

  React.useEffect(() => {
    if (!showRecent) {
      return
    }
    void loadRecent().catch(() => {
      setRecent([])
    })
  }, [loadRecent, showRecent])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setStatus(null)
    try {
      const response = await sendDashboardMessage("save-bookmark-by-url", {
        url: rawUrl,
        ...(title.trim().length > 0 ? { title: title.trim() } : {}),
      })
      if (!response.ok) {
        setStatus(errorMessage(response))
        return
      }

      const data = response.data as SaveBookmarkData
      const duplicate = data.duplicate === true || data.status === "duplicate"
      setStatus(duplicate ? "すでに保存されています" : "保存しました")
      if (!duplicate) {
        setRawUrl("")
        setTitle("")
      }
      onSaved?.()
      if (showRecent) {
        await loadRecent()
      }
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

      {showRecent ? (
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
      ) : null}
    </div>
  )
}
