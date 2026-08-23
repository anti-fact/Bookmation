import * as React from "react"

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "~/ui/primitives"

import type {
  DriveWorkflowState,
  QrImportResult,
  QrReadResult,
  ShareExportResult,
  ShareSelectionItem,
  ShareWorkflowPort
} from "./workflow-ports"

function selectedBookmarks(
  items: readonly ShareSelectionItem[],
  selected: ReadonlySet<string>
) {
  return [
    ...new Set(
      items
        .filter((item) => selected.has(item.id))
        .flatMap((item) => item.bookmarkIds)
    )
  ]
}

export function ShareWorkflowPanel({ port }: { port: ShareWorkflowPort }) {
  const [exportOpen, setExportOpen] = React.useState(false)
  const [readerOpen, setReaderOpen] = React.useState(false)
  const [driveOpen, setDriveOpen] = React.useState(false)
  const [items, setItems] = React.useState<readonly ShareSelectionItem[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [exportResult, setExportResult] =
    React.useState<ShareExportResult | null>(null)
  const [readerResult, setReaderResult] = React.useState<QrReadResult | null>(
    null
  )
  const [importResult, setImportResult] = React.useState<QrImportResult | null>(
    null
  )
  const [drive, setDrive] = React.useState<DriveWorkflowState | null>(null)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const bookmarkIds = selectedBookmarks(items, selected)

  const run = async <T,>(
    operation: () => Promise<T>,
    onSuccess: (value: T) => void
  ) => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      onSuccess(await operation())
    } catch (operationError: unknown) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "操作を完了できませんでした。"
      )
    } finally {
      setPending(false)
    }
  }

  const beginExport = () => {
    void run(
      () => port.loadSelection(),
      (next) => {
        setItems(next)
        setSelected(new Set())
        setExportResult(null)
        setExportOpen(true)
      }
    )
  }

  const readQr = (source: "CAMERA" | "FILE", file?: File) => {
    void run(
      () => port.readQr(source, file),
      (next) => {
        setReaderResult(next)
        setImportResult(null)
      }
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="m-0 text-lg font-semibold text-bm-ink">共有と取込</h3>
        <p className="mt-1 text-sm text-bm-muted-text">
          権限は操作を開始した時だけ確認します。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button onClick={beginExport}>QR／CSVで共有</Button>
        <Button
          onClick={() => {
            setReaderResult(null)
            setImportResult(null)
            setReaderOpen(true)
          }}
          variant="outline"
        >
          QRコードを読み取る
        </Button>
        <Button
          onClick={() => {
            setDriveOpen(true)
            void run(() => port.loadDriveState(), setDrive)
          }}
          variant="outline"
        >
          Google Drive
        </Button>
      </div>
      {error && !exportOpen && !readerOpen && !driveOpen ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog onOpenChange={setExportOpen} open={exportOpen}>
        <DialogContent aria-label="QRとCSVで共有">
          <DialogHeader>
            <DialogTitle>共有するブックマークを選ぶ</DialogTitle>
            <DialogDescription>
              カテゴリ、タグ、個別選択をBookmark
              IDへ展開し、重複を除いた固定集合を出力します。
            </DialogDescription>
          </DialogHeader>
          <ul className="m-0 max-h-[45dvh] space-y-2 overflow-y-auto p-0">
            {items.map((item) => (
              <li
                className="list-none rounded-bm-field border-2 border-bm-border p-3"
                key={`${item.kind}:${item.id}`}
              >
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={(checked) => {
                      setSelected((current) => {
                        const next = new Set(current)
                        if (checked === true) next.add(item.id)
                        else next.delete(item.id)
                        return next
                      })
                      setExportResult(null)
                    }}
                  />
                  <span>
                    <strong>{item.label}</strong>{" "}
                    <span className="text-xs text-bm-muted-text">
                      {item.kind} · {item.bookmarkIds.length}件
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-medium">
            重複を除いた選択: {bookmarkIds.length}件
          </p>
          {exportResult?.status === "QR_CAPACITY_EXCEEDED" ? (
            <div
              className="space-y-3 rounded-bm-field border-2 border-bm-danger p-4"
              role="alert"
            >
              <p className="m-0 text-sm text-bm-danger">
                選択したブックマークはQRコードの容量を超えています。
              </p>
              <Button
                disabled={pending}
                onClick={() =>
                  void run(
                    () => port.exportBookmarks(bookmarkIds, "CSV"),
                    setExportResult
                  )
                }
              >
                CSVでエクスポート
              </Button>
            </div>
          ) : exportResult?.status === "READY" ? (
            <div className="rounded-bm-field bg-bm-accent p-4" role="status">
              {exportResult.qrDataUrl ? (
                <img
                  alt="生成した共有QRコード"
                  className="mx-auto size-48"
                  src={exportResult.qrDataUrl}
                />
              ) : null}
              <p className="m-0 text-sm">{exportResult.message}</p>
            </div>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-bm-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setExportOpen(false)} variant="outline">
              閉じる
            </Button>
            <Button
              disabled={pending || bookmarkIds.length === 0}
              onClick={() =>
                void run(
                  () => port.exportBookmarks(bookmarkIds, "CSV"),
                  setExportResult
                )
              }
              variant="outline"
            >
              CSVでエクスポート
            </Button>
            <Button
              disabled={pending || bookmarkIds.length === 0}
              onClick={() =>
                void run(
                  () => port.exportBookmarks(bookmarkIds, "QR"),
                  setExportResult
                )
              }
              variant="solid"
            >
              QRコードを生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setReaderOpen} open={readerOpen}>
        <DialogContent aria-label="QRコード読取">
          <DialogHeader>
            <DialogTitle>QRコードを読み取る</DialogTitle>
            <DialogDescription>
              カメラはこの操作でだけ要求します。許可しない場合は画像ファイルを選べます。
            </DialogDescription>
          </DialogHeader>
          {!readerResult ? (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={pending}
                onClick={() => readQr("CAMERA")}
                variant="solid"
              >
                カメラを使用
              </Button>
              <label className="inline-flex min-h-12 cursor-pointer items-center rounded-bm-pill border-2 border-bm-ink px-5 text-sm font-semibold hover:bg-bm-ink hover:text-bm-paper">
                画像ファイルを選択
                <input
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) readQr("FILE", file)
                  }}
                  type="file"
                />
              </label>
            </div>
          ) : readerResult.status === "CAMERA_DENIED" ? (
            <div className="space-y-3" role="alert">
              <p className="m-0 text-sm text-bm-danger">
                カメラへのアクセスが拒否されました。画像ファイルから読み取ってください。
              </p>
              <label className="inline-flex min-h-12 cursor-pointer items-center rounded-bm-pill border-2 border-bm-ink px-5 text-sm font-semibold hover:bg-bm-ink hover:text-bm-paper">
                画像ファイルを選択
                <input
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) readQr("FILE", file)
                  }}
                  type="file"
                />
              </label>
            </div>
          ) : readerResult.status === "INVALID" ? (
            <p className="m-0 text-sm text-bm-danger" role="alert">
              {readerResult.message}
            </p>
          ) : importResult ? (
            <div className="space-y-2" role="status">
              <p className="m-0 font-semibold">QR取込が完了しました。</p>
              <p className="m-0 text-sm text-bm-muted-text">
                取込 {importResult.importedCount}件 / 重複・skip{" "}
                {importResult.skippedCount}件 / 失敗 {importResult.failedCount}
                件
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="m-0 font-semibold">取込内容を確認</p>
              <p className="m-0 text-sm">
                Bookmark {readerResult.bookmarkCount}件 / 重複{" "}
                {readerResult.duplicateCount}件 / Category{" "}
                {readerResult.categoryCount}件 / Tag {readerResult.tagCount}件
              </p>
              <Button
                disabled={pending}
                onClick={() =>
                  void run(
                    () => port.confirmQrImport(readerResult.previewId),
                    setImportResult
                  )
                }
                variant="solid"
              >
                取り込む
              </Button>
            </div>
          )}
          {error ? (
            <p className="mt-3 text-sm text-bm-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setReaderOpen(false)} variant="outline">
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setDriveOpen} open={driveOpen}>
        <DialogContent aria-label="Google Drive接続">
          <DialogHeader>
            <DialogTitle>Google Drive</DialogTitle>
            <DialogDescription>
              同一アカウントの端末同期と、別アカウントへのファイル共有は別の領域として接続します。
            </DialogDescription>
          </DialogHeader>
          {drive ? (
            <div className="space-y-3">
              <p className="m-0 text-sm">状態: {drive.status}</p>
              <p className="m-0 text-sm">
                アカウント: {drive.accountEmail ?? "未接続"}
              </p>
              <p className="m-0 text-sm">
                領域:{" "}
                {drive.mode === "APP_DATA"
                  ? "端末同期（appDataFolder）"
                  : drive.mode === "SHARED_FILE"
                    ? `共有ファイル（${drive.fileName ?? "未選択"}）`
                    : "未選択"}
              </p>
              {drive.status === "CONFLICT" ? (
                <div
                  className="space-y-3 rounded-bm-field border-2 border-bm-danger p-4"
                  role="alert"
                >
                  <p className="m-0 text-sm">{drive.conflictSummary}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pending}
                      onClick={() =>
                        void run(
                          () => port.resolveDriveConflict("LOCAL"),
                          setDrive
                        )
                      }
                      size="compact"
                    >
                      ローカルを採用
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        void run(
                          () => port.resolveDriveConflict("REMOTE"),
                          setDrive
                        )
                      }
                      size="compact"
                      variant="outline"
                    >
                      Driveを採用
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="m-0 text-sm">接続状態を読み込んでいます。</p>
          )}
          {error ? (
            <p className="mt-3 text-sm text-bm-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setDriveOpen(false)} variant="outline">
              閉じる
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                void run(() => port.connectDrive("SHARED_FILE"), setDrive)
              }
              variant="outline"
            >
              別アカウントと共有
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                void run(() => port.connectDrive("APP_DATA"), setDrive)
              }
              variant="solid"
            >
              端末同期へ接続
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
