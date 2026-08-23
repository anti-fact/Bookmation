import { MagnifyingGlassIcon } from "@radix-ui/react-icons"
import * as React from "react"

import type { SearchPort, SearchSuggestion } from "./search-port"

export function SearchBox({
  initialQuery = "",
  onSelect,
  onSubmit,
  port
}: {
  initialQuery?: string
  onSelect: (item: SearchSuggestion) => void
  onSubmit: (query: string) => void
  port: SearchPort
}) {
  const [query, setQuery] = React.useState(initialQuery)
  const [suggestionQuery, setSuggestionQuery] = React.useState("")
  const [items, setItems] = React.useState<SearchSuggestion[]>([])
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [open, setOpen] = React.useState(false)
  const [isComposing, setIsComposing] = React.useState(false)
  const composing = React.useRef(false)
  const request = React.useRef(0)
  const listboxId = React.useId()

  React.useEffect(() => {
    setQuery(initialQuery)
    setSuggestionQuery("")
    setItems([])
    setActiveIndex(-1)
    setOpen(false)
  }, [initialQuery])

  React.useEffect(() => {
    const current = ++request.current
    if (!suggestionQuery.trim() || isComposing) {
      setItems([])
      setOpen(false)
      return
    }
    const timer = window.setTimeout(() => {
      void port
        .suggest(suggestionQuery)
        .then((next) => {
          if (request.current !== current) return
          setItems(
            next
              .slice()
              .sort(
                (left, right) =>
                  Number(right.entityType === "LABEL") -
                  Number(left.entityType === "LABEL")
              )
              .slice(0, 8)
          )
          setOpen(true)
          setActiveIndex(-1)
        })
        .catch(() => {
          if (request.current === current) {
            setItems([])
            setOpen(true)
          }
        })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [isComposing, port, suggestionQuery])

  const dismissSuggestions = () => {
    request.current += 1
    setSuggestionQuery("")
    setItems([])
    setActiveIndex(-1)
    setOpen(false)
  }

  const select = (item: SearchSuggestion) => {
    dismissSuggestions()
    onSelect(item)
  }

  const submit = () => {
    const value = query.trim()
    if (value) {
      setOpen(false)
      onSubmit(value)
    }
  }
  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex h-[3.125rem] overflow-hidden rounded-bm-pill border-2 border-bm-ink bg-bm-paper focus-within:ring-2 focus-within:ring-bm-focus">
        <input
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-label="ブックマーク、カテゴリ、タグを検索"
          className="min-w-0 flex-1 bg-transparent px-5 text-sm outline-none"
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            if (!composing.current) setSuggestionQuery(nextQuery)
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            setIsComposing(false)
            setQuery(event.currentTarget.value)
            setSuggestionQuery(event.currentTarget.value)
          }}
          onCompositionStart={() => {
            composing.current = true
            setIsComposing(true)
          }}
          onFocus={() => {
            if (query.trim()) setSuggestionQuery(query)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActiveIndex((value) => Math.min(value + 1, items.length - 1))
              setOpen(true)
            }
            if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex((value) => Math.max(value - 1, 0))
            }
            if (event.key === "Escape") {
              setOpen(false)
              setActiveIndex(-1)
            }
            if (event.key === "Enter" && !composing.current) {
              event.preventDefault()
              const active = items[activeIndex]
              if (active) select(active)
              else submit()
            }
          }}
          placeholder="ブックマーク、カテゴリ、タグを検索"
          role="combobox"
          value={query}
        />
        <button
          aria-label="検索する"
          className="inline-flex w-[2.875rem] items-center justify-center bg-bm-paper text-bm-ink transition-colors hover:bg-bm-ink hover:text-bm-paper"
          onClick={submit}
          type="button"
        >
          <MagnifyingGlassIcon className="size-6" />
        </button>
      </div>
      {open ? (
        <ul
          className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-bm-popover m-0 max-h-80 list-none overflow-auto rounded-bm-field border-2 border-bm-border bg-bm-paper p-1 shadow-bm-control"
          id={listboxId}
          role="listbox"
        >
          {items.length ? (
            items.map((item, index) => (
              <li
                aria-selected={activeIndex === index}
                className="cursor-pointer rounded-bm-field px-3 py-2 text-sm hover:bg-bm-ink hover:text-bm-paper aria-selected:bg-bm-ink aria-selected:text-bm-paper"
                id={`${listboxId}-${index}`}
                key={`${item.entityType}:${item.entityId}`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  select(item)
                }}
                role="option"
              >
                <span className="block font-semibold">{item.displayText}</span>
                <span className="text-xs opacity-70">
                  {item.entityType === "BOOKMARK"
                    ? "ブックマーク"
                    : item.labelKind === "CATEGORY"
                      ? "カテゴリ"
                      : "タグ"}
                </span>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-bm-muted-text" role="option">
              候補はありません
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
