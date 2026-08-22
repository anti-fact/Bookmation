import * as React from "react"

import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageResponse
} from "~/extension/messages"
import { Button } from "~/ui/primitives"

type SaveBookmarkData = {
  duplicate: boolean
  status: "saved" | "duplicate"
}

export type BookmarkAddResult = {
  duplicate: boolean
}

async function saveBookmarkByUrl(
  payload: Record<string, unknown>
): Promise<ExtensionMessageResponse> {
  const requestId = crypto.randomUUID()
  const response = (await chrome.runtime.sendMessage({
    action: "save-bookmark-by-url",
    payload,
    requestId,
    schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
    source: "dashboard"
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

export function BookmarkAddForm({
  onSaved
}: {
  onSaved?: (result: BookmarkAddResult) => void
}) {
  const [rawUrl, setRawUrl] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [status, setStatus] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setStatus(null)
    try {
      const response = await saveBookmarkByUrl({
        url: rawUrl,
        ...(title.trim().length > 0 ? { title: title.trim() } : {})
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
      onSaved?.({ duplicate })
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      aria-label="ブックマーク追加フォーム"
      className="space-y-4"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="block text-xs font-medium">
        URL
        <input
          className="mt-1 w-full rounded border border-bm-muted px-2 py-1.5 text-sm"
          onChange={(event) => setRawUrl(event.target.value)}
          placeholder="https://example.com"
          required
          type="url"
          value={rawUrl}
        />
      </label>
      <label className="block text-xs font-medium">
        タイトル（任意）
        <input
          className="mt-1 w-full rounded border border-bm-muted px-2 py-1.5 text-sm"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="未入力時はページタイトルまたはホスト名"
          type="text"
          value={title}
        />
      </label>
      <div className="flex justify-start">
        <Button disabled={isSaving} size="compact" type="submit">
          保存する
        </Button>
      </div>
      {status ? (
        <p className="m-0 text-xs text-bm-muted-text" role="status">
          {status}
        </p>
      ) : null}
    </form>
  )
}
