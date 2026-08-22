import * as React from "react"

import { AppProviders, createBrowserAppRuntime } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"
import { createBrowserHashRouteStore } from "~/ui/app/hash-route"
import type {
  BookmarkListItem,
  BookmarkListPort
} from "~/ui/features/bookmarks/bookmark-list-port"

const fixtures = [
  "grid",
  "list",
  "empty",
  "single",
  "many",
  "loading",
  "initial-error",
  "page-error"
] as const

type BookmarkListFixtureName = (typeof fixtures)[number]

const previewImage = new URL(
  "../src/ui/assets/bookmation-logo.svg",
  import.meta.url
).href

function isFixtureName(value: string | null): value is BookmarkListFixtureName {
  return fixtures.some((fixture) => fixture === value)
}

function fixtureItems(count: number): BookmarkListItem[] {
  const categories = [
    { id: "category-development", name: "開発" },
    { id: "category-reading", name: "あとで読む" },
    { id: "category-design", name: "デザイン" }
  ]
  const tags = [
    { id: "tag-typescript", name: "TypeScript" },
    { id: "tag-react", name: "React" },
    { id: "tag-accessibility", name: "アクセシビリティ" }
  ]

  return Array.from({ length: count }, (_, index) => ({
    categories: [categories[index % categories.length]!],
    faviconSrc: previewImage,
    id: `fixture-bookmark-${index + 1}`,
    savedAt: Date.UTC(2026, 7, 22) - index * 86_400_000,
    siteName: index % 2 === 0 ? "Bookmation Docs" : "example.com",
    tags: index % 4 === 0 ? [] : tags.slice(0, (index % tags.length) + 1),
    thumbnailSrc: index % 3 === 0 ? previewImage : previewImage,
    title:
      index === 4
        ? "長い日本語のページ名でもカードやリストの操作が重ならず読み進められることを確認するブックマーク"
        : `Bookmation UI-04 サンプル ${index + 1}`,
    url: `https://example.com/bookmarks/${index + 1}`
  }))
}

function itemCount(fixture: BookmarkListFixtureName): number {
  switch (fixture) {
    case "empty":
      return 0
    case "single":
      return 1
    default:
      return 24
  }
}

function createFixturePort(fixture: BookmarkListFixtureName): BookmarkListPort {
  const items = fixtureItems(itemCount(fixture))

  return {
    getViewMode: async () => (fixture === "list" ? "LIST" : "GRID"),
    async loadPage({ cursor, filter, requestId }) {
      if (fixture === "loading" && cursor === null) {
        return new Promise(() => undefined)
      }
      if (fixture === "initial-error" && cursor === null) {
        throw new Error("fixture initial load error")
      }
      if (fixture === "page-error" && cursor !== null) {
        throw new Error("fixture next page error")
      }

      const filtered = items.filter((item) => {
        switch (filter.kind) {
          case "recent":
            return true
          case "category":
            return item.categories.some((label) => label.id === filter.id)
          case "tag":
            return item.tags.some((label) => label.id === filter.id)
          case "category-tag":
            return (
              item.categories.some(
                (label) => label.id === filter.categoryId
              ) && item.tags.some((label) => label.id === filter.tagId)
            )
        }
      })
      const start = cursor ? 9 : 0
      const pageItems = filtered.slice(start, start + 9)
      const last = pageItems.at(-1)
      const hasMore = start + pageItems.length < filtered.length

      return {
        items: pageItems,
        nextCursor:
          hasMore && last ? { id: last.id, savedAt: last.savedAt } : null,
        requestId,
        totalCount: filtered.length
      }
    },
    setViewMode: async () => undefined
  }
}

export function BookmarkListFixture() {
  const fixtureQuery = new URLSearchParams(window.location.search).get(
    "fixture"
  )
  const fixture = isFixtureName(fixtureQuery) ? fixtureQuery : "grid"
  const routeStore = React.useMemo(
    () => createBrowserHashRouteStore(window),
    []
  )
  const runtime = React.useMemo(
    () => createBrowserAppRuntime(window, "web-preview"),
    []
  )
  const port = React.useMemo(() => createFixturePort(fixture), [fixture])

  return (
    <AppProviders routeStore={routeStore} runtime={runtime}>
      <AppErrorBoundary>
        <ExtensionApp bookmarkListPort={port} />
      </AppErrorBoundary>

      <aside className="fixed bottom-3 left-3 z-bm-toast max-w-[calc(100vw-1.5rem)] rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-3 text-xs shadow-bm-floating">
        <details>
          <summary className="cursor-pointer select-none font-bold uppercase tracking-[0.12em]">
            Test preview / UI-04
          </summary>
          <p className="mb-0 mt-1 text-bm-muted-text">fixture: {fixture}</p>
          <nav
            aria-label="Bookmark list fixture切替"
            className="mt-3 flex max-w-sm flex-wrap gap-2"
          >
            {fixtures.map((name) => (
              <a
                aria-current={fixture === name ? "page" : undefined}
                className="rounded-bm-field border border-bm-border bg-bm-paper px-2 py-1 text-bm-ink no-underline outline-none hover:bg-bm-accent focus-visible:ring-2 focus-visible:ring-bm-focus aria-[current=page]:bg-bm-ink aria-[current=page]:text-bm-paper"
                href={`?view=bookmarks&fixture=${name}#/home`}
                key={name}
              >
                {name}
              </a>
            ))}
          </nav>
        </details>
      </aside>
    </AppProviders>
  )
}
