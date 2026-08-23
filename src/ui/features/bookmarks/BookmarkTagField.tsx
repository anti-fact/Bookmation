import { ChevronDownIcon, Cross2Icon, PlusIcon } from "@radix-ui/react-icons"
import * as React from "react"

import { normalizeLabelName } from "~/domain"
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "~/ui/primitives"

import type { BookmarkFormPort, BookmarkTagOption } from "./bookmark-form-port"

export function normalizedLabelName(value: string): string | null {
  try {
    return normalizeLabelName(value).normalized
  } catch {
    return null
  }
}

function namesMatch(left: string, right: string): boolean {
  const leftNormalized = normalizedLabelName(left)
  return (
    leftNormalized !== null && leftNormalized === normalizedLabelName(right)
  )
}

type BookmarkTagFieldProps = {
  autoFocus?: boolean
  onCreateTag: () => void
  onQueryChange: (value: string) => void
  onResolvedTagChange: (value: BookmarkTagOption | null) => void
  onTagsChange: (value: BookmarkTagOption[]) => void
  port: BookmarkFormPort
  query: string
  resolvedTag: BookmarkTagOption | null
  tags: BookmarkTagOption[]
}

export function BookmarkTagField({
  autoFocus = false,
  onCreateTag,
  onQueryChange,
  onResolvedTagChange,
  onTagsChange,
  port,
  query,
  resolvedTag,
  tags = []
}: BookmarkTagFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const searchRequest = React.useRef(0)
  const composing = React.useRef(false)
  const resolvedTagRef = React.useRef(resolvedTag)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [candidates, setCandidates] = React.useState<BookmarkTagOption[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [listboxVisible, setListboxVisible] = React.useState(false)
  const [open, setOpen] = React.useState(true)

  resolvedTagRef.current = resolvedTag

  React.useEffect(() => {
    const currentRequest = ++searchRequest.current
    if (!query.trim()) {
      setCandidates([])
      setActiveIndex(-1)
      setListboxVisible(false)
      if (resolvedTagRef.current) onResolvedTagChange(null)
      return
    }

    let active = true
    void port
      .searchTags(query)
      .then((items) => {
        if (!active || currentRequest !== searchRequest.current) return
        const limited = items.slice(0, 8)
        setCandidates(limited)
        setActiveIndex(-1)
        const exact =
          limited.find((item) => namesMatch(item.name, query)) ?? null
        if (
          !resolvedTagRef.current ||
          !namesMatch(resolvedTagRef.current.name, query)
        ) {
          onResolvedTagChange(exact)
        }
      })
      .catch(() => {
        if (!active || currentRequest !== searchRequest.current) return
        setCandidates([])
        setActiveIndex(-1)
        if (
          !resolvedTagRef.current ||
          !namesMatch(resolvedTagRef.current.name, query)
        ) {
          onResolvedTagChange(null)
        }
      })

    return () => {
      active = false
    }
  }, [onResolvedTagChange, port, query])

  const commitTag = React.useCallback(
    (candidate: BookmarkTagOption | null) => {
      if (!candidate) {
        setError("既存のタグを候補から選択してください")
        return
      }
      if (tags.some((tag) => tag.id === candidate.id)) {
        setError("このタグはすでに追加されています")
        return
      }

      onTagsChange([...tags, candidate])
      onQueryChange("")
      onResolvedTagChange(null)
      setCandidates([])
      setActiveIndex(-1)
      setError(null)
      setListboxVisible(false)
      inputRef.current?.focus()
    },
    [onQueryChange, onResolvedTagChange, onTagsChange, tags]
  )

  const activeCandidate =
    activeIndex >= 0 ? (candidates[activeIndex] ?? null) : null
  const listboxOpen = listboxVisible && candidates.length > 0
  const errorId = error ? "bookmark-tag-field-error" : undefined

  const categories = Array.from(
    new Map(
      tags.map((tag) => [
        tag.parentCategoryId,
        { id: tag.parentCategoryId, name: tag.parentCategoryName }
      ])
    ).values()
  )

  return (
    <section aria-label="タグ設定" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium" htmlFor="bookmark-tag-input">
          タグ
        </label>
        <button
          className="inline-flex items-center gap-1 rounded-bm-field px-1 py-0.5 text-xs font-semibold text-bm-ink outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus"
          onClick={onCreateTag}
          type="button"
        >
          <PlusIcon aria-hidden="true" />
          新規作成
        </button>
      </div>

      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls="bookmark-tag-candidates"
          aria-describedby={errorId}
          aria-expanded={listboxOpen}
          aria-invalid={error ? true : undefined}
          aria-activedescendant={
            listboxOpen && activeIndex >= 0
              ? `bookmark-tag-candidate-${activeIndex}`
              : undefined
          }
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full rounded-bm-field border-2 border-bm-border bg-bm-paper px-3 py-2 text-sm text-bm-ink outline-none placeholder:text-bm-placeholder focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
          id="bookmark-tag-input"
          onChange={(event) => {
            onQueryChange(event.target.value)
            onResolvedTagChange(null)
            setError(null)
            setListboxVisible(true)
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onCompositionStart={() => {
            composing.current = true
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
            if (
              event.key === "Enter" &&
              !composing.current &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              commitTag(activeCandidate ?? resolvedTag)
            }
          }}
          placeholder="既存のタグを検索"
          ref={inputRef}
          role="combobox"
          type="text"
          value={query}
        />

        {listboxOpen ? (
          <ul
            className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-bm-popover m-0 max-h-60 list-none overflow-y-auto rounded-bm-field border-2 border-bm-border bg-bm-paper p-1 shadow-bm-control"
            id="bookmark-tag-candidates"
            role="listbox"
          >
            {candidates.map((candidate, index) => (
              <li
                aria-selected={
                  resolvedTag?.id === candidate.id || activeIndex === index
                }
                className="group cursor-pointer rounded-bm-field px-3 py-2 text-sm outline-none hover:bg-bm-ink hover:text-bm-paper aria-selected:bg-bm-ink aria-selected:text-bm-paper"
                id={`bookmark-tag-candidate-${index}`}
                key={candidate.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => {
                  onQueryChange(candidate.name)
                  onResolvedTagChange(candidate)
                  setActiveIndex(index)
                  setError(null)
                  setListboxVisible(false)
                  inputRef.current?.focus()
                }}
                role="option"
              >
                <span className="block font-semibold">#{candidate.name}</span>
                <span className="block text-xs text-bm-muted-text group-hover:text-bm-paper group-aria-[selected=true]:text-bm-paper">
                  カテゴリ: {candidate.parentCategoryName}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="m-0 text-xs text-bm-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}

      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between gap-3">
          <CollapsibleTrigger asChild>
            <button
              aria-label={`現在のタグ${tags.length}件を${open ? "隠す" : "表示"}`}
              className="group inline-flex min-h-8 items-center gap-1 rounded-bm-chip px-2 text-xs font-semibold text-bm-ink outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus data-[state=open]:bg-bm-ink data-[state=open]:text-bm-paper"
              type="button"
            >
              タグ {tags.length}件
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 transition-transform group-data-[state=open]:rotate-180"
              />
            </button>
          </CollapsibleTrigger>
          <Button
            onClick={() => commitTag(resolvedTag)}
            size="compact"
            type="button"
          >
            追加
          </Button>
        </div>
        <CollapsibleContent>
          {tags.length > 0 ? (
            <div aria-label="現在のタグ" className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  aria-label={`タグ「${tag.name}」を解除`}
                  className="group relative inline-flex min-h-8 min-w-20 items-center justify-center rounded-bm-chip border border-bm-border bg-bm-paper px-3 py-1 text-xs text-bm-ink outline-none transition-colors hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
                  key={tag.id}
                  onClick={() =>
                    onTagsChange(
                      tags.filter((current) => current.id !== tag.id)
                    )
                  }
                  type="button"
                >
                  <span className="transition-opacity group-hover:opacity-20 group-focus-visible:opacity-20">
                    #{tag.name}
                  </span>
                  <Cross2Icon
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="m-0 text-xs text-bm-muted-text">
              追加済みのタグはありません。
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="rounded-bm-field bg-bm-accent px-3 py-2">
        <p className="m-0 text-xs font-semibold">カテゴリ（タグから自動）</p>
        <p className="mb-0 mt-1 text-xs text-bm-muted-text">
          {categories.length > 0
            ? categories.map((category) => `#${category.name}`).join("、")
            : "タグを追加すると自動で表示されます"}
        </p>
      </div>
    </section>
  )
}
