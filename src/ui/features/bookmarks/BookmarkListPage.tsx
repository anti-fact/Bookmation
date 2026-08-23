import {
  ArrowUpIcon,
  ChevronDownIcon,
  GridIcon,
  ImageIcon,
  ListBulletIcon,
  Pencil1Icon
} from "@radix-ui/react-icons"
import * as React from "react"

import type { AppRuntime } from "~/ui/app/AppProviders"
import { LabelRibbonTrail } from "~/ui/components/LabelRibbonTrail"
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  IconButton,
  RadioGroup,
  RadioGroupItem,
  Tooltip
} from "~/ui/primitives"
import { joinClassNames } from "~/ui/primitives/class-names"

import type {
  BookmarkListCursor,
  BookmarkListFilter,
  BookmarkListItem,
  BookmarkListPort,
  BookmarkViewMode
} from "./bookmark-list-port"

const fallbackLogo = new URL(
  "../../assets/bookmation-logo.svg",
  import.meta.url
).href

type BookmarkListPageProps = {
  filter: BookmarkListFilter
  headingRef: React.RefObject<HTMLHeadingElement>
  onClearFilter: () => void
  onEdit: (bookmark: BookmarkListItem) => void
  onNavigateToFilter: (
    filter: Exclude<BookmarkListFilter, { kind: "recent" }>
  ) => void
  port: BookmarkListPort
  runtime: AppRuntime
}

type PageStatus = "loading" | "ready" | "error"
type MoreStatus = "idle" | "loading" | "error" | "end"

function cursorKey(cursor: BookmarkListCursor | null): string {
  return cursor ? `${cursor.savedAt}:${cursor.id}` : "initial"
}

function filterKey(filter: BookmarkListFilter): string {
  switch (filter.kind) {
    case "recent":
      return "recent"
    case "category":
    case "tag":
      return `${filter.kind}:${filter.id}`
    case "category-tag":
      return `category:${filter.categoryId}:tag:${filter.tagId}`
  }
}

function formatSavedAt(value: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium"
  }).format(value)
}

function siteLabel(bookmark: BookmarkListItem): string {
  if (bookmark.siteName?.trim()) {
    return bookmark.siteName
  }

  try {
    return new URL(bookmark.url).hostname
  } catch {
    return bookmark.url
  }
}

function BookmarkImage({
  alt,
  className,
  src
}: {
  alt: string
  className: string
  src: string | null
}) {
  const [failed, setFailed] = React.useState(false)

  if (!src || failed) {
    return (
      <div
        aria-label={`${alt}の画像なし`}
        className={joinClassNames(
          "flex items-center justify-center overflow-hidden bg-bm-accent",
          className
        )}
        role="img"
      >
        <img
          alt=""
          className="h-auto w-2/5 max-w-[10rem] opacity-55"
          src={fallbackLogo}
        />
      </div>
    )
  }

  return (
    <img
      alt=""
      className={joinClassNames("object-cover", className)}
      onError={() => setFailed(true)}
      src={src}
    />
  )
}

function CategoryLinks({
  bookmark,
  onNavigateToFilter
}: Pick<BookmarkListPageProps, "onNavigateToFilter"> & {
  bookmark: BookmarkListItem
}) {
  if (bookmark.categories.length === 0) {
    return (
      <span className="inline-flex min-h-5 items-center rounded-l-none rounded-r-bm-chip bg-bm-muted px-2 text-[0.6875rem] font-bold text-bm-paper">
        未分類
      </span>
    )
  }

  return (
    <div aria-label="カテゴリ" className="flex min-w-0 flex-wrap gap-1">
      {bookmark.categories.map((category) => (
        <button
          className="inline-flex min-h-5 items-center rounded-l-none rounded-r-bm-chip bg-bm-paper px-2 text-[0.6875rem] font-bold text-bm-ink outline-none transition-colors hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
          key={category.id}
          onClick={() =>
            onNavigateToFilter({ id: category.id, kind: "category" })
          }
          type="button"
        >
          #{category.name}
        </button>
      ))}
    </div>
  )
}

function TagDisclosure({
  bookmark,
  onNavigateToFilter
}: Pick<BookmarkListPageProps, "onNavigateToFilter"> & {
  bookmark: BookmarkListItem
}) {
  const [open, setOpen] = React.useState(false)
  const tags = bookmark.tags
  const trigger = (
    <CollapsibleTrigger asChild disabled={tags.length === 0}>
      <button
        aria-label={
          tags.length === 0
            ? "タグなし"
            : `タグ${tags.length}件を${open ? "隠す" : "表示"}`
        }
        className={joinClassNames(
          "group inline-flex min-h-7 items-center gap-1 rounded-bm-chip border border-bm-border px-2 text-xs font-semibold outline-none transition-colors hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-bm-paper disabled:cursor-default disabled:border-bm-muted disabled:text-bm-muted-text disabled:hover:bg-bm-paper disabled:hover:text-bm-muted-text",
          open ? "bg-bm-ink text-bm-paper" : "bg-bm-paper text-bm-ink"
        )}
        type="button"
      >
        タグ {tags.length}件
        {tags.length > 0 ? (
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 transition-transform group-data-[state=open]:rotate-180"
          />
        ) : null}
      </button>
    </CollapsibleTrigger>
  )

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      {tags.length > 0 ? (
        <Tooltip content={tags.map((tag) => `#${tag.name}`).join("、")}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <CollapsibleContent>
        <div aria-label="タグ" className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              className="rounded-bm-chip border border-bm-border bg-bm-paper px-2 py-1 text-xs text-bm-ink outline-none transition-colors hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
              key={tag.id}
              onClick={() => onNavigateToFilter({ id: tag.id, kind: "tag" })}
              type="button"
            >
              #{tag.name}
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function BookmarkCard({
  bookmark,
  onEdit,
  onNavigateToFilter
}: Pick<BookmarkListPageProps, "onEdit" | "onNavigateToFilter"> & {
  bookmark: BookmarkListItem
}) {
  return (
    <article className="min-w-0">
      <div className="group/bookmark relative overflow-hidden rounded-bm-field border border-bm-border bg-bm-accent">
        <a
          aria-label={`${bookmark.title}をサムネイルから開く`}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bm-focus"
          href={bookmark.url}
          rel="noreferrer"
          target="_blank"
        >
          <BookmarkImage
            alt={bookmark.title}
            className="aspect-[16/9] w-full"
            src={bookmark.thumbnailSrc}
          />
        </a>
        <IconButton
          className="peer/edit pointer-events-none absolute right-2 top-2 z-10 bg-bm-paper opacity-0 shadow-bm-control group-hover/bookmark:pointer-events-auto group-hover/bookmark:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
          label={`${bookmark.title}を編集`}
          onClick={() => onEdit(bookmark)}
          shape="pill"
          size="compact"
          tooltipSide="left"
        >
          <Pencil1Icon className="size-4" />
        </IconButton>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[var(--bm-color-overlay)] opacity-0 transition-opacity group-hover/bookmark:opacity-100 peer-focus-visible/edit:opacity-100"
          data-bookmark-hover-mask=""
        />
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
        <CategoryLinks
          bookmark={bookmark}
          onNavigateToFilter={onNavigateToFilter}
        />
        <span aria-hidden="true">•</span>
        <span className="min-w-0 truncate text-xs text-bm-muted-text">
          {siteLabel(bookmark)}
        </span>
      </div>
      <a
        className="mt-2 block truncate text-base font-semibold text-bm-ink outline-none hover:underline focus-visible:rounded-bm-field focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2"
        href={bookmark.url}
        rel="noreferrer"
        target="_blank"
      >
        {bookmark.title}
      </a>
      <p className="mb-0 mt-1 text-xs text-bm-muted-text">
        保存日 {formatSavedAt(bookmark.savedAt)}
      </p>
      <div className="mt-3">
        <TagDisclosure
          bookmark={bookmark}
          onNavigateToFilter={onNavigateToFilter}
        />
      </div>
    </article>
  )
}

function BookmarkRow({
  bookmark,
  onEdit,
  onNavigateToFilter
}: Pick<BookmarkListPageProps, "onEdit" | "onNavigateToFilter"> & {
  bookmark: BookmarkListItem
}) {
  return (
    <article className="group/bookmark grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)_auto] gap-3 border-b border-bm-border py-4 sm:grid-cols-[3.75rem_minmax(0,1fr)_auto] sm:gap-4">
      <a
        aria-label={`${bookmark.title}をサムネイルから開く`}
        className="block self-start rounded-bm-field outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
        href={bookmark.url}
        rel="noreferrer"
        target="_blank"
      >
        <img
          alt=""
          className="size-[3.25rem] rounded-bm-field border border-bm-border object-cover sm:size-[3.75rem]"
          src={bookmark.faviconSrc}
        />
      </a>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CategoryLinks
            bookmark={bookmark}
            onNavigateToFilter={onNavigateToFilter}
          />
          <span aria-hidden="true">•</span>
          <span className="min-w-0 truncate text-xs text-bm-muted-text">
            {siteLabel(bookmark)}
          </span>
          <span className="text-xs text-bm-muted-text">
            {formatSavedAt(bookmark.savedAt)}
          </span>
        </div>
        <a
          className="mt-1 block truncate text-base font-semibold text-bm-ink outline-none hover:underline focus-visible:rounded-bm-field focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 sm:text-lg"
          href={bookmark.url}
          rel="noreferrer"
          target="_blank"
        >
          {bookmark.title}
        </a>
        <div className="mt-2">
          <TagDisclosure
            bookmark={bookmark}
            onNavigateToFilter={onNavigateToFilter}
          />
        </div>
      </div>

      <IconButton
        className="pointer-events-none self-start opacity-0 group-hover/bookmark:pointer-events-auto group-hover/bookmark:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
        label={`${bookmark.title}を編集`}
        onClick={() => onEdit(bookmark)}
        shape="pill"
        size="compact"
        tooltipSide="left"
      >
        <Pencil1Icon className="size-4" />
      </IconButton>
    </article>
  )
}

function ViewModeControl({
  onValueChange,
  value
}: {
  onValueChange: (value: BookmarkViewMode) => void
  value: BookmarkViewMode
}) {
  return (
    <RadioGroup
      aria-label="ブックマークの表示形式"
      className="rounded-bm-control bg-bm-on-panel p-1"
      onValueChange={(nextValue) => {
        if (nextValue === "GRID" || nextValue === "LIST") {
          onValueChange(nextValue)
        }
      }}
      value={value}
    >
      <RadioGroupItem
        aria-label="グリッド表示"
        className="size-10 rounded-bm-field text-bm-ink transition-colors hover:bg-bm-ink hover:text-bm-paper data-[state=checked]:bg-bm-ink data-[state=checked]:text-bm-paper data-[state=checked]:shadow-bm-control"
        value="GRID"
      >
        <GridIcon className="size-5" />
      </RadioGroupItem>
      <RadioGroupItem
        aria-label="リスト表示"
        className="size-10 rounded-bm-field text-bm-ink transition-colors hover:bg-bm-ink hover:text-bm-paper data-[state=checked]:bg-bm-ink data-[state=checked]:text-bm-paper data-[state=checked]:shadow-bm-control"
        value="LIST"
      >
        <ListBulletIcon className="size-5" />
      </RadioGroupItem>
    </RadioGroup>
  )
}

function ListPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div className="animate-pulse" key={index}>
          <div className="aspect-[16/9] rounded-bm-field bg-bm-accent" />
          <div className="mt-3 h-4 w-2/3 rounded bg-bm-on-panel" />
          <div className="mt-2 h-5 w-full rounded bg-bm-on-panel" />
        </div>
      ))}
    </div>
  )
}

export function BookmarkListPage({
  filter,
  headingRef,
  onClearFilter,
  onEdit,
  onNavigateToFilter,
  port,
  runtime
}: BookmarkListPageProps) {
  const [items, setItems] = React.useState<BookmarkListItem[]>([])
  const [moreStatus, setMoreStatus] = React.useState<MoreStatus>("idle")
  const [nextCursor, setNextCursor] = React.useState<BookmarkListCursor | null>(
    null
  )
  const [pageStatus, setPageStatus] = React.useState<PageStatus>("loading")
  const [statusMessage, setStatusMessage] = React.useState("")
  const [totalCount, setTotalCount] = React.useState(0)
  const [viewMode, setViewMode] = React.useState<BookmarkViewMode>("GRID")
  const [viewModeError, setViewModeError] = React.useState(false)
  const generationRef = React.useRef(0)
  const itemsRef = React.useRef<BookmarkListItem[]>([])
  const requestedCursorsRef = React.useRef(new Set<string>())
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const currentFilterKey = filterKey(filter)
  const filterCategoryId =
    filter.kind === "category"
      ? filter.id
      : filter.kind === "category-tag"
        ? filter.categoryId
        : undefined
  const filterKind = filter.kind
  const filterTagId =
    filter.kind === "tag"
      ? filter.id
      : filter.kind === "category-tag"
        ? filter.tagId
        : undefined

  const load = React.useCallback(
    async (
      cursor: BookmarkListCursor | null,
      kind: "initial" | "more",
      generation = generationRef.current
    ) => {
      const key = cursorKey(cursor)
      if (requestedCursorsRef.current.has(key)) {
        return
      }
      requestedCursorsRef.current.add(key)

      if (kind === "initial") {
        setPageStatus("loading")
      } else {
        setMoreStatus("loading")
      }

      const requestId = `bookmark-list:${crypto.randomUUID()}`
      try {
        let requestFilter: BookmarkListFilter
        switch (filterKind) {
          case "recent":
            requestFilter = { kind: "recent" }
            break
          case "category":
            requestFilter = { id: filterCategoryId!, kind: "category" }
            break
          case "tag":
            requestFilter = { id: filterTagId!, kind: "tag" }
            break
          case "category-tag":
            requestFilter = {
              categoryId: filterCategoryId!,
              kind: "category-tag",
              tagId: filterTagId!
            }
            break
        }
        const result = await port.loadPage({
          cursor,
          filter: requestFilter,
          requestId
        })
        if (
          generationRef.current !== generation ||
          result.requestId !== requestId
        ) {
          return
        }

        if (kind === "initial") {
          itemsRef.current = result.items
          setItems(result.items)
          setPageStatus("ready")
          setStatusMessage(`${result.items.length}件を読み込みました。`)
        } else {
          const existingIds = new Set(itemsRef.current.map((item) => item.id))
          const additions = result.items.filter(
            (item) => !existingIds.has(item.id)
          )
          const mergedItems = [...itemsRef.current, ...additions]
          itemsRef.current = mergedItems
          setItems(mergedItems)
          setStatusMessage(`${additions.length}件を追加で読み込みました。`)
        }

        const repeatedCursor =
          result.nextCursor &&
          cursor &&
          cursorKey(result.nextCursor) === cursorKey(cursor)
        const resolvedNextCursor = repeatedCursor ? null : result.nextCursor
        setNextCursor(resolvedNextCursor)
        setTotalCount(result.totalCount)
        setMoreStatus(resolvedNextCursor ? "idle" : "end")
      } catch {
        requestedCursorsRef.current.delete(key)
        if (generationRef.current !== generation) {
          return
        }
        if (kind === "initial") {
          setPageStatus("error")
        } else {
          setMoreStatus("error")
        }
        setStatusMessage("ブックマークを読み込めませんでした。")
      }
    },
    [filterCategoryId, filterKind, filterTagId, port]
  )

  React.useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    itemsRef.current = []
    requestedCursorsRef.current = new Set()
    setItems([])
    setMoreStatus("idle")
    setNextCursor(null)
    setPageStatus("loading")
    setStatusMessage("")
    setTotalCount(0)
    void load(null, "initial", generation)

    return () => {
      generationRef.current += 1
    }
  }, [currentFilterKey, load])

  React.useEffect(() => {
    let active = true
    void port
      .getViewMode()
      .then((mode) => {
        if (active) setViewMode(mode)
      })
      .catch(() => {
        if (active) setViewModeError(true)
      })
    return () => {
      active = false
    }
  }, [port])

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !nextCursor || moreStatus !== "idle") {
      return
    }
    return runtime.observeIntersection(sentinel, () => {
      void load(nextCursor, "more")
    })
  }, [load, moreStatus, nextCursor, runtime])

  const showBackToTop = React.useSyncExternalStore(
    runtime.subscribeScroll,
    () => runtime.getScrollY() >= 480,
    () => false
  )

  const handleViewModeChange = (nextMode: BookmarkViewMode) => {
    const previousMode = viewMode
    setViewMode(nextMode)
    setViewModeError(false)
    void port.setViewMode(nextMode).catch(() => {
      setViewMode(previousMode)
      setViewModeError(true)
    })
  }

  const handleNavigateToFilter: BookmarkListPageProps["onNavigateToFilter"] = (
    nextFilter
  ) => {
    if (filter.kind === "category" && nextFilter.kind === "tag") {
      onNavigateToFilter({
        categoryId: filter.id,
        kind: "category-tag",
        tagId: nextFilter.id
      })
      return
    }
    if (filter.kind === "tag" && nextFilter.kind === "category") {
      onNavigateToFilter({
        categoryId: nextFilter.id,
        kind: "category-tag",
        tagId: filter.id
      })
      return
    }
    onNavigateToFilter(nextFilter)
  }

  const handleRemoveFilter = (filterId: string) => {
    if (filter.kind === "recent") {
      return
    }
    if (filter.kind === "category-tag") {
      if (filterId === "category") {
        onNavigateToFilter({ id: filter.tagId, kind: "tag" })
      } else if (filterId === "tag") {
        onNavigateToFilter({ id: filter.categoryId, kind: "category" })
      }
      return
    }
    onClearFilter()
  }

  const filterTrail = (() => {
    if (filter.kind === "recent") {
      return [{ id: "recent", label: "最近追加" }]
    }

    if (filter.kind === "category") {
      const matchingCategory = items
        .flatMap((item) => item.categories)
        .find((category) => category.id === filter.id)
      return [{ id: "category", label: matchingCategory?.name ?? filter.id }]
    }

    const matchingTag = items
      .flatMap((item) => item.tags)
      .find(
        (tag) => tag.id === (filter.kind === "tag" ? filter.id : filter.tagId)
      )
    if (filter.kind === "tag") {
      return [{ id: "tag", label: matchingTag?.name ?? filter.id }]
    }

    const matchingCategory = items
      .flatMap((item) => item.categories)
      .find((category) => category.id === filter.categoryId)
    return [
      {
        id: "category",
        label: matchingCategory?.name ?? filter.categoryId
      },
      { id: "tag", label: matchingTag?.name ?? filter.tagId }
    ]
  })()

  return (
    <section aria-busy={pageStatus === "loading"} aria-label="ブックマーク一覧">
      <div
        aria-label="ブックマーク一覧ツールバー"
        className="-mx-4 -mt-8 mb-8 border-b border-bm-on-panel bg-bm-paper px-4 py-4 sm:-mx-8 sm:px-8 lg:-mx-[4.5rem] lg:px-[4.5rem]"
        role="region"
      >
        <div className="mx-auto flex w-full max-w-[81rem] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <LabelRibbonTrail
              items={filterTrail}
              onRemove={
                filter.kind === "recent" ? undefined : handleRemoveFilter
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p aria-live="polite" className="m-0 text-sm font-semibold">
              読込済み {items.length} / 全 {totalCount}件
            </p>
            <ViewModeControl
              onValueChange={handleViewModeChange}
              value={viewMode}
            />
          </div>
        </div>
        {viewModeError ? (
          <p
            className="mx-auto mb-0 mt-2 w-full max-w-[81rem] text-right text-xs text-bm-danger"
            role="alert"
          >
            表示形式を保存できませんでした。
          </p>
        ) : null}
      </div>

      {statusMessage ? (
        <p aria-live="polite" className="sr-only" role="status">
          {statusMessage}
        </p>
      ) : null}

      {pageStatus === "loading" ? <ListPlaceholder /> : null}

      {pageStatus === "error" ? (
        <div className="rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-6 text-center">
          <ImageIcon aria-hidden="true" className="mx-auto size-8" />
          <p className="mb-0 mt-3 text-sm">
            ブックマークを読み込めませんでした。
          </p>
          <Button className="mt-4" onClick={() => void load(null, "initial")}>
            再試行
          </Button>
        </div>
      ) : null}

      {pageStatus === "ready" && items.length === 0 ? (
        <div className="rounded-bm-dialog border-2 border-dashed border-bm-muted bg-bm-paper px-6 py-16 text-center">
          <ImageIcon
            aria-hidden="true"
            className="mx-auto size-10 text-bm-muted"
          />
          <h2 className="mb-0 mt-4 text-xl font-bold">
            ブックマークはまだありません
          </h2>
          <p className="mb-0 mt-2 text-sm text-bm-muted-text">
            ポップアップから現在のページを保存すると、ここに表示されます。
          </p>
        </div>
      ) : null}

      {pageStatus === "ready" && items.length > 0 ? (
        viewMode === "GRID" ? (
          <div className="grid grid-cols-1 gap-x-7 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            {items.map((bookmark) => (
              <BookmarkCard
                bookmark={bookmark}
                key={bookmark.id}
                onEdit={onEdit}
                onNavigateToFilter={handleNavigateToFilter}
              />
            ))}
          </div>
        ) : (
          <div className="border-t border-bm-border">
            {items.map((bookmark) => (
              <BookmarkRow
                bookmark={bookmark}
                key={bookmark.id}
                onEdit={onEdit}
                onNavigateToFilter={handleNavigateToFilter}
              />
            ))}
          </div>
        )
      ) : null}

      <div
        className="flex min-h-24 items-center justify-center"
        ref={sentinelRef}
      >
        {moreStatus === "loading" ? (
          <p className="m-0 text-sm text-bm-muted-text" role="status">
            続きを読み込んでいます…
          </p>
        ) : null}
        {moreStatus === "error" ? (
          <div className="text-center">
            <p className="m-0 text-sm text-bm-danger">
              続きを読み込めませんでした。
            </p>
            <Button
              className="mt-3"
              onClick={() => void load(nextCursor, "more")}
              size="compact"
            >
              この位置から再試行
            </Button>
          </div>
        ) : null}
        {moreStatus === "end" && items.length > 0 ? (
          <p className="m-0 text-sm text-bm-muted-text">すべて表示しました。</p>
        ) : null}
      </div>

      {showBackToTop ? (
        <IconButton
          className="fixed bottom-5 right-5 z-bm-floating shadow-bm-floating sm:bottom-8 sm:right-8"
          label="トップへ戻る"
          onClick={() => {
            runtime.scrollTo(0)
            headingRef.current?.focus({ preventScroll: true })
          }}
          shape="pill"
          tooltipSide="left"
          variant="outline"
        >
          <ArrowUpIcon aria-hidden="true" className="size-6" />
        </IconButton>
      ) : null}
    </section>
  )
}
