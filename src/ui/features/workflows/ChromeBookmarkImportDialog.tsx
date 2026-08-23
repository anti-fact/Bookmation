import * as React from "react"

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select
} from "~/ui/primitives"

import type {
  BookmarkImportPort,
  BookmarkImportPreview,
  BookmarkImportResult
} from "./workflow-ports"

export function ChromeBookmarkImportDialog({
  port
}: {
  port: BookmarkImportPort
}) {
  const [open, setOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<BookmarkImportPreview | null>(
    null
  )
  const [parents, setParents] = React.useState<Record<string, string>>({})
  const [skipped, setSkipped] = React.useState<Set<string>>(new Set())
  const [result, setResult] = React.useState<BookmarkImportResult | null>(null)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = React.useState("")

  const prepare = async () => {
    setPending(true)
    setError(null)
    try {
      const next = await port.prepare()
      setPreview(next)
      setParents(
        Object.fromEntries(
          next.groups
            .filter(
              (group) =>
                group.resolution.kind === "NEW" &&
                group.resolution.parentCategoryId
            )
            .map((group) => [
              group.id,
              group.resolution.kind === "NEW"
                ? (group.resolution.parentCategoryId ?? "")
                : ""
            ])
        )
      )
      setSkipped(
        new Set(
          next.groups
            .filter((group) => group.resolution.kind === "INVALID")
            .map((group) => group.id)
        )
      )
      setResult(null)
      setOpen(true)
    } catch (prepareError: unknown) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : "Chromeブックマークを読み込めませんでした。"
      )
    } finally {
      setPending(false)
    }
  }

  const unresolved = preview?.groups.some(
    (group) =>
      group.resolution.kind === "NEW" &&
      !skipped.has(group.id) &&
      !parents[group.id]
  )

  return (
    <section
      className="space-y-3 rounded-bm-field border-2 border-bm-border p-4"
      aria-labelledby="chrome-import-heading"
    >
      <h3 className="m-0 font-semibold text-bm-ink" id="chrome-import-heading">
        Chrome標準ブックマーク
      </h3>
      <p className="m-0 text-sm text-bm-muted-text">
        元のフォルダ構造は変更せず、直上フォルダだけをタグとして取り込みます。
      </p>
      <Button
        disabled={pending}
        onClick={() => void prepare()}
        variant="outline"
      >
        Chromeブックマークを取り込む
      </Button>
      {error && !open ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent aria-label="Chromeブックマーク取込">
          <DialogHeader>
            <DialogTitle>Chromeブックマークを取り込む</DialogTitle>
            <DialogDescription>
              各直上フォルダに割り当てるタグと親カテゴリを確認してください。祖先フォルダは保存しません。
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-3" role="status">
              <p className="m-0 font-semibold">
                {result.importedCount}件を取り込みました。
              </p>
              <p className="m-0 text-sm text-bm-muted-text">
                スキップ {result.skippedCount}件 / 失敗 {result.failed.length}件
              </p>
              {result.failed.length > 0 ? (
                <ul className="m-0 pl-5 text-sm text-bm-danger">
                  {result.failed.map((item) => (
                    <li key={item.title}>
                      {item.title}: {item.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : preview ? (
            <div className="space-y-5">
              <ul className="m-0 max-h-[45dvh] space-y-4 overflow-y-auto p-0">
                {preview.groups.map((group) => (
                  <li
                    className="list-none rounded-bm-field border-2 border-bm-border p-4"
                    key={group.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="m-0 font-semibold">
                          {group.folderName || "（名前なし）"}
                        </p>
                        <p className="m-0 text-xs text-bm-muted-text">
                          出所: {group.sourcePath} / {group.bookmarks.length}件
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={skipped.has(group.id)}
                          onCheckedChange={(checked) => {
                            setSkipped((current) => {
                              const next = new Set(current)
                              if (checked === true) next.add(group.id)
                              else next.delete(group.id)
                              return next
                            })
                          }}
                        />
                        スキップ
                      </label>
                    </div>
                    {group.resolution.kind === "REUSE" ? (
                      <p className="mb-0 mt-3 text-sm">
                        既存タグ「{group.resolution.tagName}」をカテゴリ「
                        {group.resolution.categoryName}」のまま再利用します。
                      </p>
                    ) : group.resolution.kind === "INVALID" ? (
                      <p className="mb-0 mt-3 text-sm text-bm-danger">
                        {group.resolution.reason}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <p className="m-0 text-sm">
                          作成予定タグ:{" "}
                          <strong>{group.resolution.tagName}</strong>
                        </p>
                        <Select
                          disabled={skipped.has(group.id)}
                          label={`${group.folderName}の親カテゴリ`}
                          onValueChange={(value) =>
                            setParents((current) => ({
                              ...current,
                              [group.id]: value
                            }))
                          }
                          options={preview.categories.map((category) => ({
                            label: category.name,
                            value: category.id
                          }))}
                          placeholder="カテゴリを選択"
                          value={parents[group.id] ?? ""}
                        />
                      </div>
                    )}
                    <ul className="mb-0 mt-3 space-y-1 pl-5 text-xs text-bm-muted-text">
                      {group.bookmarks.map((bookmark) => (
                        <li key={bookmark.id}>
                          {bookmark.title} — {bookmark.url}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              <div className="rounded-bm-field bg-bm-accent p-4">
                <p className="m-0 text-sm font-semibold">
                  親カテゴリを新規作成
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    aria-label="新しいカテゴリ名"
                    className="h-10 min-w-48 flex-1 rounded-bm-field border-2 border-bm-border bg-bm-paper px-3 outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    value={newCategoryName}
                  />
                  <Button
                    disabled={pending || !newCategoryName.trim()}
                    onClick={async () => {
                      setPending(true)
                      setError(null)
                      try {
                        const category =
                          await port.createCategory(newCategoryName)
                        setPreview((current) =>
                          current
                            ? {
                                ...current,
                                categories: [...current.categories, category]
                              }
                            : current
                        )
                        setNewCategoryName("")
                      } catch (createError: unknown) {
                        setError(
                          createError instanceof Error
                            ? createError.message
                            : "カテゴリを作成できませんでした。"
                        )
                      } finally {
                        setPending(false)
                      }
                    }}
                    size="compact"
                  >
                    作成
                  </Button>
                </div>
              </div>
              {unresolved ? (
                <p className="m-0 text-sm text-bm-danger">
                  新規タグを取り込むには親カテゴリを選択してください。
                </p>
              ) : null}
              {error ? (
                <p className="m-0 text-sm text-bm-danger" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="outline">
              閉じる
            </Button>
            {!result && preview ? (
              <Button
                disabled={pending || unresolved}
                loading={pending}
                onClick={async () => {
                  setPending(true)
                  setError(null)
                  try {
                    setResult(
                      await port.confirm({
                        groups: preview.groups.map((group) => ({
                          groupId: group.id,
                          parentCategoryId:
                            group.resolution.kind === "NEW"
                              ? (parents[group.id] ?? null)
                              : null,
                          skip: skipped.has(group.id)
                        }))
                      })
                    )
                  } catch (confirmError: unknown) {
                    setError(
                      confirmError instanceof Error
                        ? confirmError.message
                        : "取込を完了できませんでした。"
                    )
                  } finally {
                    setPending(false)
                  }
                }}
                variant="solid"
              >
                取り込む
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
