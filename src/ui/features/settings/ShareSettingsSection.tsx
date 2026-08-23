import * as React from "react"

import { Button, Checkbox } from "~/ui/primitives"

import type {
  ShareSelectionItem,
  ShareSettingsPort,
  ShareSettingsSnapshot
} from "./share-settings-port"

const KIND_LABEL = {
  BOOKMARK: "ブックマーク",
  CATEGORY: "カテゴリ",
  TAG: "タグ"
} as const

function uniqueBookmarkIds(
  items: readonly ShareSelectionItem[],
  selectedIds: ReadonlySet<string>
): string[] {
  return [
    ...new Set(
      items
        .filter((item) => selectedIds.has(item.id))
        .flatMap((item) => item.bookmarkIds)
    )
  ]
}

export function ShareSettingsSection({ port }: { port: ShareSettingsPort }) {
  const [snapshot, setSnapshot] = React.useState<ShareSettingsSnapshot | null>(
    null
  )
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [qrCapacityExceeded, setQrCapacityExceeded] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void port.load().then(
      (next) => active && setSnapshot(next),
      (loadError: unknown) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "共有設定を読み込めませんでした。"
          )
      }
    )
    return () => {
      active = false
    }
  }, [port])

  if (!snapshot) {
    return (
      <div aria-busy={!error} className="space-y-2">
        <h3 className="m-0 text-lg font-semibold text-bm-ink">共有</h3>
        <p
          className="m-0 text-sm text-bm-muted-text"
          role={error ? "alert" : undefined}
        >
          {error ?? "共有設定を読み込んでいます。"}
        </p>
      </div>
    )
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP")
  const filteredItems = normalizedQuery
    ? snapshot.items.filter((item) =>
        `${item.label} ${item.description ?? ""}`
          .toLocaleLowerCase("ja-JP")
          .includes(normalizedQuery)
      )
    : snapshot.items
  const bookmarkIds = uniqueBookmarkIds(snapshot.items, selectedIds)

  const runExport = async (format: "QR" | "CSV") => {
    if (bookmarkIds.length === 0 || pending) return
    setPending(true)
    setError(null)
    if (format === "QR") setQrCapacityExceeded(false)
    try {
      const result = await port.exportBookmarks(bookmarkIds, format)
      if (result.status === "QR_CAPACITY_EXCEEDED") {
        setQrCapacityExceeded(true)
        return
      }
      setMessage(result.message)
      if (format === "CSV") setQrCapacityExceeded(false)
    } catch (exportError: unknown) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "エクスポートできませんでした。"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="m-0 text-lg font-semibold text-bm-ink">共有</h3>
        <p className="mt-1 text-sm text-bm-muted-text">
          Drive同期と、QR／CSVによる共有を管理します。
        </p>
      </div>

      <section
        aria-labelledby="drive-account-heading"
        className="rounded-bm-field border-2 border-bm-border p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4
              className="m-0 font-semibold text-bm-ink"
              id="drive-account-heading"
            >
              Google Drive
            </h4>
            {snapshot.drive ? (
              <div className="mt-2 space-y-1 text-sm text-bm-muted-text">
                <p className="m-0">接続中: {snapshot.drive.accountEmail}</p>
                <p className="m-0">
                  同期状態: {snapshot.drive.state} / 未同期{" "}
                  {snapshot.drive.unsyncedCount}件
                </p>
                <p className="m-0">
                  対象: {snapshot.drive.fileName ?? "端末同期（appDataFolder）"}
                </p>
                <p className="m-0">
                  最終同期: {snapshot.drive.lastSyncedAt ?? "未同期"}
                </p>
              </div>
            ) : (
              <p className="mb-0 mt-2 text-sm text-bm-muted-text">
                Googleアカウントは未接続です。
              </p>
            )}
          </div>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true)
              setError(null)
              try {
                setSnapshot(await port.connectDrive())
              } catch (connectError: unknown) {
                setError(
                  connectError instanceof Error
                    ? connectError.message
                    : "Driveへ接続できませんでした。"
                )
              } finally {
                setPending(false)
              }
            }}
            variant="outline"
          >
            {snapshot.drive ? "アカウントを変更" : "アカウントを選択"}
          </Button>
        </div>
      </section>

      <section aria-labelledby="share-export-heading" className="space-y-4">
        <div>
          <h4
            className="m-0 font-semibold text-bm-ink"
            id="share-export-heading"
          >
            ユーザー間共有
          </h4>
          <p className="mb-0 mt-1 text-sm text-bm-muted-text">
            カテゴリ、タグ、個別ブックマークを同じ選択集合へまとめます。
          </p>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-bm-ink">
          共有対象を検索
          <input
            className="h-12 rounded-bm-field border-2 border-bm-border bg-bm-paper px-4 text-bm-ink outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="カテゴリ、タグ、ページ名"
            type="search"
            value={query}
          />
        </label>
        {filteredItems.length === 0 ? (
          <p className="rounded-bm-field bg-bm-accent p-4 text-sm text-bm-ink">
            共有できるブックマークはありません。
          </p>
        ) : (
          <ul className="m-0 grid max-h-80 list-none gap-2 overflow-y-auto p-0">
            {filteredItems.map((item) => (
              <li
                className="rounded-bm-field border-2 border-bm-border p-3"
                key={`${item.kind}:${item.id}`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={(checked) => {
                      setSelectedIds((current) => {
                        const next = new Set(current)
                        if (checked === true) next.add(item.id)
                        else next.delete(item.id)
                        return next
                      })
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-bm-ink">
                      {item.label}
                    </span>
                    <span className="block text-xs text-bm-muted-text">
                      {KIND_LABEL[item.kind]} · {item.bookmarkIds.length}件
                      {item.description ? ` · ${item.description}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 text-sm font-medium text-bm-ink">
          重複を除いた選択: {bookmarkIds.length}件
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={pending || bookmarkIds.length === 0}
            onClick={() => void runExport("QR")}
          >
            QRコードを生成
          </Button>
          <Button
            disabled={pending || bookmarkIds.length === 0}
            onClick={() => void runExport("CSV")}
            variant="outline"
          >
            CSVでエクスポート
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true)
              setError(null)
              try {
                await port.openQrReader()
              } catch (readerError: unknown) {
                setError(
                  readerError instanceof Error
                    ? readerError.message
                    : "QR読取を開始できませんでした。"
                )
              } finally {
                setPending(false)
              }
            }}
            variant="outline"
          >
            QRコードを読み取る
          </Button>
        </div>
        {qrCapacityExceeded ? (
          <div
            className="space-y-3 rounded-bm-field border-2 border-bm-danger p-4"
            role="alert"
          >
            <p className="m-0 text-sm text-bm-danger">
              選択したブックマークはQRコードの容量を超えています。
            </p>
            <Button disabled={pending} onClick={() => void runExport("CSV")}>
              CSVでエクスポート
            </Button>
          </div>
        ) : null}
      </section>

      {message ? (
        <p
          aria-live="polite"
          className="m-0 text-sm text-bm-muted-text"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
