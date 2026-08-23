import { ArrowLeftIcon, PlusIcon } from "@radix-ui/react-icons"
import * as React from "react"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "~/ui/primitives"

import { BookmarkTagField, normalizedLabelName } from "./BookmarkTagField"
import {
  bookmarkFormErrorMessage,
  type BookmarkCategoryOption,
  type BookmarkFormPort,
  type BookmarkTagOption
} from "./bookmark-form-port"
import type { BookmarkListItem } from "./bookmark-list-port"

type BookmarkDialogStep = "FORM" | "CREATE_TAG" | "CREATE_CATEGORY"

export type BookmarkDialogMode =
  | { kind: "add" }
  | { bookmark: BookmarkListItem; kind: "edit" }

type BookmarkDialogProps = {
  mode: BookmarkDialogMode
  onComplete: (message: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  port: BookmarkFormPort
}

type StableRequest = {
  fingerprint: string
  requestId: string
}

function stableRequestId(
  target: React.MutableRefObject<StableRequest | null>,
  fingerprint: string
): string {
  if (target.current?.fingerprint !== fingerprint) {
    target.current = { fingerprint, requestId: crypto.randomUUID() }
  }
  return target.current.requestId
}

function statusMessage(error: unknown): string {
  return bookmarkFormErrorMessage(error)
}

type ParentCategoryFieldProps = {
  error: string | null
  onCreateCategory: () => void
  onErrorChange: (value: string | null) => void
  onQueryChange: (value: string) => void
  onSelectedChange: (value: BookmarkCategoryOption | null) => void
  port: BookmarkFormPort
  query: string
  selected: BookmarkCategoryOption | null
}

function ParentCategoryField({
  error,
  onCreateCategory,
  onErrorChange,
  onQueryChange,
  onSelectedChange,
  port,
  query,
  selected
}: ParentCategoryFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const searchRequest = React.useRef(0)
  const selectedRef = React.useRef(selected)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [candidates, setCandidates] = React.useState<BookmarkCategoryOption[]>(
    []
  )
  const [listboxVisible, setListboxVisible] = React.useState(false)

  selectedRef.current = selected

  React.useEffect(() => {
    const currentRequest = ++searchRequest.current
    if (!query.trim()) {
      setCandidates([])
      setActiveIndex(-1)
      setListboxVisible(false)
      if (selectedRef.current) onSelectedChange(null)
      return
    }

    let active = true
    void port
      .searchCategories(query)
      .then((items) => {
        if (!active || currentRequest !== searchRequest.current) return
        const limited = items.slice(0, 8)
        setCandidates(limited)
        setActiveIndex(-1)
        const queryName = normalizedLabelName(query)
        const exact =
          queryName === null
            ? null
            : (limited.find(
                (item) => normalizedLabelName(item.name) === queryName
              ) ?? null)
        if (
          !selectedRef.current ||
          normalizedLabelName(selectedRef.current.name) !== queryName
        ) {
          onSelectedChange(exact)
        }
      })
      .catch(() => {
        if (!active || currentRequest !== searchRequest.current) return
        setCandidates([])
        setActiveIndex(-1)
        if (
          !selectedRef.current ||
          normalizedLabelName(selectedRef.current.name) !==
            normalizedLabelName(query)
        ) {
          onSelectedChange(null)
        }
      })

    return () => {
      active = false
    }
  }, [onSelectedChange, port, query])

  const choose = (category: BookmarkCategoryOption) => {
    onQueryChange(category.name)
    onSelectedChange(category)
    onErrorChange(null)
    setListboxVisible(false)
    inputRef.current?.focus()
  }
  const listboxOpen = listboxVisible && candidates.length > 0
  const errorId = error ? "parent-category-error" : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium" htmlFor="parent-category-input">
          親カテゴリ
        </label>
        <button
          className="inline-flex items-center gap-1 rounded-bm-field px-1 py-0.5 text-xs font-semibold text-bm-ink outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus"
          onClick={onCreateCategory}
          type="button"
        >
          <PlusIcon aria-hidden="true" />
          新規作成
        </button>
      </div>
      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls="parent-category-candidates"
          aria-describedby={errorId}
          aria-expanded={listboxOpen}
          aria-invalid={error ? true : undefined}
          aria-activedescendant={
            listboxOpen && activeIndex >= 0
              ? `parent-category-candidate-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          className="w-full rounded-bm-field border-2 border-bm-border bg-bm-paper px-3 py-2 text-sm outline-none placeholder:text-bm-placeholder focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
          id="parent-category-input"
          onChange={(event) => {
            onQueryChange(event.target.value)
            onSelectedChange(null)
            onErrorChange(null)
            setListboxVisible(true)
          }}
          onFocus={() => setListboxVisible(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && candidates.length > 0) {
              event.preventDefault()
              setListboxVisible(true)
              setActiveIndex((index) => (index + 1) % candidates.length)
              return
            }
            if (event.key === "ArrowUp" && candidates.length > 0) {
              event.preventDefault()
              setListboxVisible(true)
              setActiveIndex((index) =>
                index <= 0 ? candidates.length - 1 : index - 1
              )
              return
            }
            if (event.key === "Escape") {
              setListboxVisible(false)
              setActiveIndex(-1)
              return
            }
            if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault()
              const candidate = candidates[activeIndex]
              if (candidate) choose(candidate)
            }
          }}
          placeholder="既存のカテゴリを検索"
          ref={inputRef}
          role="combobox"
          type="text"
          value={query}
        />
        {listboxOpen ? (
          <ul
            className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-bm-popover m-0 max-h-60 list-none overflow-y-auto rounded-bm-field border-2 border-bm-border bg-bm-paper p-1 shadow-bm-control"
            id="parent-category-candidates"
            role="listbox"
          >
            {candidates.map((category, index) => (
              <li
                aria-selected={
                  selected?.id === category.id || activeIndex === index
                }
                className="cursor-pointer rounded-bm-field px-3 py-2 text-sm font-semibold outline-none hover:bg-bm-ink hover:text-bm-paper aria-selected:bg-bm-ink aria-selected:text-bm-paper"
                id={`parent-category-candidate-${index}`}
                key={category.id}
                onClick={() => choose(category)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                role="option"
              >
                #{category.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {selected ? (
        <p className="m-0 text-xs text-bm-muted-text">
          選択中: #{selected.name}
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-xs text-bm-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function BookmarkDialog({
  mode,
  onComplete,
  onOpenChange,
  open,
  port
}: BookmarkDialogProps) {
  const [step, setStep] = React.useState<BookmarkDialogStep>("FORM")
  const [title, setTitle] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [tags, setTags] = React.useState<BookmarkTagOption[]>([])
  const [tagQuery, setTagQuery] = React.useState("")
  const [resolvedTag, setResolvedTag] =
    React.useState<BookmarkTagOption | null>(null)
  const [tagName, setTagName] = React.useState("")
  const [categoryQuery, setCategoryQuery] = React.useState("")
  const [selectedCategory, setSelectedCategory] =
    React.useState<BookmarkCategoryOption | null>(null)
  const [categoryError, setCategoryError] = React.useState<string | null>(null)
  const [categoryName, setCategoryName] = React.useState("")
  const [status, setStatus] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [sideDraftStarted, setSideDraftStarted] = React.useState(false)
  const [focusTagOnFormMount, setFocusTagOnFormMount] = React.useState(false)
  const saveRequest = React.useRef<StableRequest | null>(null)
  const tagCreateRequest = React.useRef<StableRequest | null>(null)
  const categoryCreateRequest = React.useRef<StableRequest | null>(null)

  const modeKey =
    mode.kind === "add"
      ? "add"
      : `edit:${mode.bookmark.id}:${mode.bookmark.revision}`

  React.useEffect(() => {
    if (!open) {
      setFocusTagOnFormMount(false)
      return
    }
    setStep("FORM")
    setTitle(mode.kind === "edit" ? mode.bookmark.title : "")
    setUrl(mode.kind === "edit" ? mode.bookmark.url : "")
    setTags(mode.kind === "edit" ? (mode.bookmark.tags ?? []) : [])
    setTagQuery("")
    setResolvedTag(null)
    setTagName("")
    setCategoryQuery("")
    setSelectedCategory(null)
    setCategoryError(null)
    setCategoryName("")
    setStatus(null)
    setPending(false)
    setSideDraftStarted(false)
    setFocusTagOnFormMount(false)
    saveRequest.current = null
    tagCreateRequest.current = null
    categoryCreateRequest.current = null
  }, [mode, modeKey, open])

  const openTagCreation = () => {
    if (!sideDraftStarted) {
      setTagName(tagQuery)
      setCategoryQuery("")
      setSelectedCategory(null)
      setCategoryError(null)
      setSideDraftStarted(true)
    }
    setStatus(null)
    setStep("CREATE_TAG")
  }

  const handleBookmarkSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setStatus(null)
    try {
      if (mode.kind === "add") {
        const fingerprint = JSON.stringify({
          tagIds: tags.map((tag) => tag.id),
          title,
          url
        })
        const result = await port.saveBookmark({
          requestId: stableRequestId(saveRequest, fingerprint),
          tagIds: tags.map((tag) => tag.id),
          title,
          url
        })
        if (result.duplicate) {
          setStatus("すでに保存されています")
          return
        }
        onComplete("ブックマークを保存しました")
        return
      }

      await port.updateBookmark({
        bookmarkId: mode.bookmark.id,
        expectedRevision: mode.bookmark.revision,
        tagIds: tags.map((tag) => tag.id),
        title: title.trim(),
        url
      })
      onComplete("ブックマークを更新しました")
    } catch (error: unknown) {
      setStatus(statusMessage(error))
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async () => {
    if (mode.kind !== "edit") return
    setPending(true)
    setStatus(null)
    try {
      await port.deleteBookmark({
        bookmarkId: mode.bookmark.id,
        expectedRevision: mode.bookmark.revision
      })
      onComplete("ブックマークを削除しました")
    } catch (error: unknown) {
      setStatus(statusMessage(error))
    } finally {
      setPending(false)
    }
  }

  const handleTagCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!tagName.trim()) {
      setStatus("タグ名を入力してください")
      return
    }
    if (!selectedCategory) {
      setCategoryError("既存のカテゴリを候補から選択してください")
      return
    }

    setPending(true)
    setStatus(null)
    try {
      const fingerprint = JSON.stringify({
        categoryId: selectedCategory.id,
        categoryRevision: selectedCategory.revision,
        name: tagName
      })
      const created = await port.createTag({
        category: selectedCategory,
        name: tagName,
        requestId: stableRequestId(tagCreateRequest, fingerprint)
      })
      setTagQuery(created.name)
      setResolvedTag(created)
      setStatus(null)
      setFocusTagOnFormMount(true)
      setStep("FORM")
      setSideDraftStarted(false)
      setTagName("")
      setCategoryQuery("")
      setSelectedCategory(null)
      tagCreateRequest.current = null
    } catch (error: unknown) {
      setStatus(statusMessage(error))
    } finally {
      setPending(false)
    }
  }

  const handleCategoryCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!categoryName.trim()) {
      setStatus("カテゴリ名を入力してください")
      return
    }
    setPending(true)
    setStatus(null)
    try {
      const created = await port.createCategory({
        name: categoryName,
        requestId: stableRequestId(categoryCreateRequest, categoryName)
      })
      setSelectedCategory(created)
      setCategoryQuery(created.name)
      setCategoryError(null)
      setCategoryName("")
      setStatus(null)
      setStep("CREATE_TAG")
      categoryCreateRequest.current = null
    } catch (error: unknown) {
      setStatus(statusMessage(error))
    } finally {
      setPending(false)
    }
  }

  const dialogTitle =
    step === "CREATE_TAG"
      ? "タグを新規作成"
      : step === "CREATE_CATEGORY"
        ? "カテゴリを新規作成"
        : mode.kind === "add"
          ? "ブックマークを追加"
          : "ブックマークを編集"

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent closeLabel={`${dialogTitle}を閉じる`}>
        <DialogHeader>
          {step !== "FORM" ? (
            <button
              className="mb-2 inline-flex items-center gap-1 rounded-bm-field px-1 py-1 text-xs font-semibold outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus"
              onClick={() => {
                setStatus(null)
                if (step === "CREATE_CATEGORY") {
                  setStep("CREATE_TAG")
                } else {
                  setFocusTagOnFormMount(true)
                  setStep("FORM")
                }
              }}
              type="button"
            >
              <ArrowLeftIcon aria-hidden="true" />
              戻る
            </button>
          ) : null}
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {step === "CREATE_TAG"
              ? "タグ名と親カテゴリを指定します。元のブックマーク入力は保持されます。"
              : step === "CREATE_CATEGORY"
                ? "タグの親にするカテゴリを作成します。"
                : "カテゴリは選択したタグの親から自動で決まります。"}
          </DialogDescription>
        </DialogHeader>

        {step === "FORM" ? (
          <form
            aria-label={
              mode.kind === "add"
                ? "ブックマーク追加フォーム"
                : "ブックマーク編集フォーム"
            }
            className="space-y-5"
            onSubmit={(event) => void handleBookmarkSubmit(event)}
          >
            <label className="block text-xs font-medium">
              URL
              <input
                className="mt-1 w-full rounded-bm-field border-2 border-bm-border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
                onChange={(event) => {
                  setUrl(event.target.value)
                  setStatus(null)
                }}
                placeholder="https://example.com"
                required
                type="url"
                value={url}
              />
            </label>
            <label className="block text-xs font-medium">
              {mode.kind === "add" ? "タイトル（任意）" : "タイトル"}
              <input
                className="mt-1 w-full rounded-bm-field border-2 border-bm-border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
                onChange={(event) => {
                  setTitle(event.target.value)
                  setStatus(null)
                }}
                placeholder={
                  mode.kind === "add"
                    ? "未入力時はページタイトルまたはホスト名"
                    : undefined
                }
                required={mode.kind === "edit"}
                type="text"
                value={title}
              />
            </label>

            <BookmarkTagField
              autoFocus={focusTagOnFormMount}
              onCreateTag={openTagCreation}
              onQueryChange={setTagQuery}
              onResolvedTagChange={setResolvedTag}
              onTagsChange={setTags}
              port={port}
              query={tagQuery}
              resolvedTag={resolvedTag}
              tags={tags}
            />

            {status ? (
              <p className="m-0 text-sm text-bm-danger" role="alert">
                {status}
              </p>
            ) : null}

            <DialogFooter
              className={
                mode.kind === "edit" ? "sm:justify-between" : undefined
              }
            >
              {mode.kind === "edit" ? (
                <Button
                  loading={pending}
                  onClick={() => void handleDelete()}
                  tone="danger"
                  type="button"
                  variant="outline"
                >
                  削除する
                </Button>
              ) : null}
              <Button loading={pending} type="submit" variant="solid">
                保存する
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === "CREATE_TAG" ? (
          <form
            aria-label="タグ作成フォーム"
            className="space-y-5"
            onSubmit={(event) => void handleTagCreate(event)}
          >
            <label className="block text-xs font-medium">
              タグ名
              <input
                autoFocus
                className="mt-1 w-full rounded-bm-field border-2 border-bm-border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
                onChange={(event) => {
                  setTagName(event.target.value)
                  setStatus(null)
                }}
                required
                type="text"
                value={tagName}
              />
            </label>
            <ParentCategoryField
              error={categoryError}
              onCreateCategory={() => {
                setCategoryName(categoryQuery)
                setStatus(null)
                setStep("CREATE_CATEGORY")
              }}
              onErrorChange={setCategoryError}
              onQueryChange={setCategoryQuery}
              onSelectedChange={setSelectedCategory}
              port={port}
              query={categoryQuery}
              selected={selectedCategory}
            />
            {status ? (
              <p className="m-0 text-sm text-bm-danger" role="alert">
                {status}
              </p>
            ) : null}
            <DialogFooter>
              <Button loading={pending} type="submit" variant="solid">
                タグを作成
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === "CREATE_CATEGORY" ? (
          <form
            aria-label="カテゴリ作成フォーム"
            className="space-y-5"
            onSubmit={(event) => void handleCategoryCreate(event)}
          >
            <label className="block text-xs font-medium">
              カテゴリ名
              <input
                autoFocus
                className="mt-1 w-full rounded-bm-field border-2 border-bm-border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
                onChange={(event) => {
                  setCategoryName(event.target.value)
                  setStatus(null)
                }}
                required
                type="text"
                value={categoryName}
              />
            </label>
            {status ? (
              <p className="m-0 text-sm text-bm-danger" role="alert">
                {status}
              </p>
            ) : null}
            <DialogFooter>
              <Button loading={pending} type="submit" variant="solid">
                カテゴリを作成
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
