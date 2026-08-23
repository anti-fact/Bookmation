import { Pencil2Icon, TrashIcon } from "@radix-ui/react-icons"
import * as React from "react"

import {
  LABEL_RIBBON_CLIP_PATH,
  LABEL_RIBBON_SEGMENT_CLASS
} from "~/ui/components/LabelRibbonTrail"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "~/ui/primitives"

import type {
  CategoryEditDetail,
  LabelManagementPort,
  ManagedCategory,
  ManagedTag
} from "./label-management-port"

export type LabelsCreateRequest = {
  id: number
  kind: "category" | "tag"
} | null
type Editor =
  | { kind: "category"; category: ManagedCategory }
  | { kind: "tag"; tag: ManagedTag }
  | { kind: "create-category" }
  | { kind: "create-tag" }
  | null

export function LabelsPage({
  createRequest,
  manageMode,
  onCreateRequestHandled,
  onNavigate,
  port
}: {
  createRequest: LabelsCreateRequest
  manageMode: boolean
  onCreateRequestHandled: () => void
  onNavigate: (filter: { id: string; kind: "category" | "tag" }) => void
  port: LabelManagementPort
}) {
  const [categories, setCategories] = React.useState<ManagedCategory[]>([])
  const [editor, setEditor] = React.useState<Editor>(null)
  const [name, setName] = React.useState("")
  const [categoryQuery, setCategoryQuery] = React.useState("")
  const [parentId, setParentId] = React.useState("")
  const [returnToTag, setReturnToTag] = React.useState<{
    editor: Extract<Exclude<Editor, null>, { kind: "create-tag" | "tag" }>
    name: string
  } | null>(null)
  const [detail, setDetail] = React.useState<CategoryEditDetail | null>(null)
  const [status, setStatus] = React.useState("読み込み中です")
  const [submitting, setSubmitting] = React.useState(false)

  const reload = React.useCallback(async () => {
    setStatus("読み込み中です")
    try {
      const items = await port.list()
      setCategories(items)
      setStatus(items.length ? "" : "カテゴリはまだありません")
    } catch {
      setStatus("カテゴリ・タグを読み込めませんでした")
    }
  }, [port])

  React.useEffect(() => void reload(), [reload])
  React.useEffect(() => {
    if (!createRequest) return
    setEditor({
      kind: createRequest.kind === "category" ? "create-category" : "create-tag"
    })
    setName("")
    setCategoryQuery("")
    setParentId("")
    onCreateRequestHandled()
  }, [createRequest, onCreateRequestHandled])

  const openEditor = async (next: Exclude<Editor, null>) => {
    setEditor(next)
    setName(
      next.kind === "category"
        ? next.category.name
        : next.kind === "tag"
          ? next.tag.name
          : ""
    )
    setParentId(next.kind === "tag" ? next.tag.parentCategoryId : "")
    setCategoryQuery(next.kind === "tag" ? next.tag.parentCategoryName : "")
    setDetail(null)
    if (next.kind === "category") {
      try {
        setDetail(await port.getCategoryDetail(next.category.id))
      } catch {
        setStatus("カテゴリの影響範囲を読み込めませんでした")
      }
    }
  }

  const selectedCategory = categories.find((item) => item.id === parentId)
  const categoryCandidates = categories
    .filter((item) =>
      item.name
        .toLocaleLowerCase()
        .includes(categoryQuery.trim().toLocaleLowerCase())
    )
    .slice(0, 8)
  const submit = async () => {
    if (!editor || submitting) return
    setSubmitting(true)
    const returningFromCategory =
      editor.kind === "create-category" && returnToTag !== null
    try {
      if (editor.kind === "create-category") {
        const created = await port.createCategory({
          name,
          requestId: crypto.randomUUID()
        })
        setCategories((items) => [
          ...items,
          { ...created, origin: "USER", tags: [] }
        ])
        if (returnToTag) {
          setEditor(returnToTag.editor)
          setName(returnToTag.name)
          setParentId(created.id)
          setCategoryQuery(created.name)
          setReturnToTag(null)
        } else {
          setName("")
        }
      } else if (editor.kind === "category") {
        await port.updateCategory({
          category: editor.category,
          name
        })
        setEditor(null)
      } else if (editor.kind === "create-tag" && selectedCategory) {
        await port.createTag({
          category: selectedCategory,
          name,
          requestId: crypto.randomUUID()
        })
        setName("")
      } else if (editor.kind === "tag" && selectedCategory) {
        await port.updateTag({
          category: selectedCategory,
          name,
          requestId: `tag-update:${crypto.randomUUID()}`,
          tag: editor.tag
        })
        setEditor(null)
      }
      if (!returningFromCategory) await reload()
      setStatus("保存しました")
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === "DUPLICATE_NORMALIZED_NAME"
          ? "同じ名前は使用できません"
          : "保存できませんでした。入力を保ったまま再試行できます"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!editor || submitting) return
    setSubmitting(true)
    try {
      if (editor.kind === "tag")
        await port.deleteTag({
          id: editor.tag.id,
          revision: editor.tag.revision
        })
      if (editor.kind === "category" && detail)
        await port.deleteCategory({
          detail,
          requestId: `category-delete:${crypto.randomUUID()}`
        })
      setEditor(null)
      await reload()
      setStatus("削除しました")
    } catch {
      setStatus("最新の状態を確認して、もう一度削除してください")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-label="カテゴリ・タグ一覧" className="space-y-8">
      {status ? (
        <p
          aria-live="polite"
          className="rounded-bm-field bg-bm-paper px-4 py-3 text-sm"
        >
          {status}
        </p>
      ) : null}
      {categories.map((category) => (
        <section aria-labelledby={`category-${category.id}`} key={category.id}>
          <button
            className={`${LABEL_RIBBON_SEGMENT_CLASS} group relative outline-none focus-visible:ring-2 focus-visible:ring-bm-focus`}
            id={`category-${category.id}`}
            onClick={() =>
              manageMode
                ? void openEditor({ category, kind: "category" })
                : onNavigate({ id: category.id, kind: "category" })
            }
            style={{ clipPath: LABEL_RIBBON_CLIP_PATH }}
            type="button"
          >
            <span
              className={
                manageMode
                  ? "whitespace-nowrap transition-opacity group-hover:opacity-20 group-focus-visible:opacity-20"
                  : "whitespace-nowrap"
              }
            >
              #{category.name}
            </span>
            {manageMode ? (
              <Pencil2Icon
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            ) : null}
          </button>
          <div className="flex flex-wrap gap-3 p-4 sm:px-8">
            {category.tags.length ? (
              category.tags.map((tag) => (
                <button
                  className="group inline-flex min-h-10 items-center gap-2 rounded-bm-chip border-2 border-bm-border bg-bm-accent px-4 text-sm font-semibold outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus"
                  key={tag.id}
                  onClick={() =>
                    manageMode
                      ? void openEditor({ kind: "tag", tag })
                      : onNavigate({ id: tag.id, kind: "tag" })
                  }
                  type="button"
                >
                  #{tag.name}
                  {manageMode ? (
                    <Pencil2Icon className="size-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="m-0 text-sm text-bm-muted-text">
                タグはまだありません
              </p>
            )}
          </div>
        </section>
      ))}

      <Dialog
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
        open={editor !== null}
      >
        <DialogContent closeLabel="編集画面を閉じる">
          <DialogHeader>
            <DialogTitle>
              {editor?.kind === "create-category"
                ? "カテゴリを作成"
                : editor?.kind === "create-tag"
                  ? "タグを作成"
                  : editor?.kind === "category"
                    ? `#${editor.category.name}を管理`
                    : `#${editor?.tag.name ?? "タグ"}を編集`}
            </DialogTitle>
            <DialogDescription>
              正規化後に同じ名前は作成できません。削除した項目も名前を予約します。
            </DialogDescription>
          </DialogHeader>

          {editor?.kind === "category" ? (
            <div className="space-y-5">
              <label className="block text-sm font-semibold">
                名前
                <input
                  className="mt-2 block w-full rounded-bm-field border-2 border-bm-border px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <div className="rounded-bm-field bg-bm-accent p-4 text-sm">
                <p className="m-0">
                  子タグ: {detail?.activeTagCount ?? "確認中"}件
                </p>
                <p className="mb-0 mt-2">
                  関連ブックマーク:{" "}
                  {detail?.referencedActiveBookmarkCount ?? "確認中"}件
                </p>
                {detail?.activeTags.length ? (
                  <p className="mb-0 mt-2">
                    {detail.activeTags.map((tag) => `#${tag.name}`).join("、")}
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-bm-danger">
                カテゴリを削除すると子タグも削除されます。ブックマーク本体は残ります。
                AI分類が有効な場合は、影響するブックマークの再分類が行われます。
              </p>
              <div className="flex flex-wrap justify-between gap-3">
                <Button
                  disabled={!detail || submitting}
                  onClick={() => void remove()}
                  tone="danger"
                  variant="solid"
                >
                  カテゴリと子タグを削除
                </Button>
                <div className="flex gap-3">
                  <Button onClick={() => setEditor(null)} variant="outline">
                    キャンセル
                  </Button>
                  <Button
                    disabled={submitting || !name.trim()}
                    onClick={() => void submit()}
                  >
                    保存する
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <label className="block text-sm font-semibold">
                名前
                <input
                  className="mt-2 block w-full rounded-bm-field border-2 border-bm-border px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              {editor?.kind === "create-tag" || editor?.kind === "tag" ? (
                <div className="relative grid gap-2">
                  <div className="flex items-end justify-between gap-3">
                    <label className="flex-1 text-sm font-semibold">
                      親カテゴリ
                      <input
                        aria-expanded={categoryQuery.length > 0}
                        aria-haspopup="listbox"
                        className="mt-2 block w-full rounded-bm-field border-2 border-bm-border px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
                        onChange={(event) => {
                          const query = event.target.value
                          setCategoryQuery(query)
                          const exact = categories.find(
                            (item) =>
                              item.name.toLocaleLowerCase() ===
                              query.trim().toLocaleLowerCase()
                          )
                          setParentId(exact?.id ?? "")
                        }}
                        role="combobox"
                        value={categoryQuery}
                      />
                    </label>
                    <Button
                      onClick={() => {
                        setReturnToTag({ editor, name })
                        setEditor({ kind: "create-category" })
                        setName("")
                      }}
                      variant="quiet"
                    >
                      カテゴリを新規作成
                    </Button>
                  </div>
                  {categoryQuery && !selectedCategory ? (
                    <ul
                      className="m-0 max-h-48 list-none overflow-auto rounded-bm-field border-2 border-bm-border bg-bm-paper p-1"
                      role="listbox"
                    >
                      {categoryCandidates.map((item) => (
                        <li
                          className="cursor-pointer rounded-bm-field px-3 py-2 text-sm outline-none hover:bg-bm-ink hover:text-bm-paper"
                          key={item.id}
                          onClick={() => {
                            setParentId(item.id)
                            setCategoryQuery(item.name)
                          }}
                          role="option"
                        >
                          #{item.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {categoryQuery &&
                  !selectedCategory &&
                  !categoryCandidates.length ? (
                    <p className="m-0 text-xs text-bm-danger">
                      既存のカテゴリを選択するか、新規作成してください
                    </p>
                  ) : null}
                </div>
              ) : null}
              {editor?.kind === "tag" ? (
                <p className="text-sm text-bm-muted-text">
                  作成元: {editor.tag.origin}／利用件数: {editor.tag.usageCount}
                  件
                </p>
              ) : null}
              <div className="flex flex-wrap justify-between gap-3">
                {editor?.kind === "tag" ? (
                  <Button
                    disabled={submitting}
                    onClick={() => void remove()}
                    tone="danger"
                    variant="solid"
                  >
                    <TrashIcon />
                    タグを削除
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  disabled={
                    submitting ||
                    !name.trim() ||
                    ((editor?.kind === "create-tag" ||
                      editor?.kind === "tag") &&
                      !selectedCategory)
                  }
                  onClick={() => void submit()}
                >
                  {editor?.kind.startsWith("create")
                    ? "作成して続ける"
                    : "保存する"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
