import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import type { AppRuntime } from "~/ui/app/AppProviders"

import { BookmarkListPage } from "./BookmarkListPage"
import type {
  BookmarkListFilter,
  BookmarkListItem,
  BookmarkListPageResult,
  BookmarkListPort
} from "./bookmark-list-port"

const bundledLogo = "chrome-extension://test/assets/icon.png"

function bookmark(id: string, savedAt: number): BookmarkListItem {
  return {
    categories: [{ id: "category-development", name: "開発" }],
    faviconSrc: bundledLogo,
    id,
    savedAt,
    siteName: "example.com",
    tags: [{ id: "tag-typescript", name: "TypeScript" }],
    thumbnailSrc: bundledLogo,
    title: `記事 ${id}`,
    url: `https://example.com/${id}`
  }
}

function createPort(
  loadPage: BookmarkListPort["loadPage"],
  viewMode: "GRID" | "LIST" = "GRID"
): BookmarkListPort {
  return {
    getViewMode: vi.fn().mockResolvedValue(viewMode),
    loadPage,
    setViewMode: vi.fn().mockResolvedValue(undefined)
  }
}

function createRuntime(initialScrollY = 0) {
  let intersectionCallback: (() => void) | undefined
  let scrollY = initialScrollY
  const scrollListeners = new Set<() => void>()
  const runtime: AppRuntime = {
    getScrollY: () => scrollY,
    kind: "web-preview",
    observeIntersection: vi.fn((_target, onIntersect) => {
      intersectionCallback = onIntersect
      return vi.fn()
    }),
    scrollTo: vi.fn((top) => {
      scrollY = top
      scrollListeners.forEach((listener) => listener())
    }),
    setManualScrollRestoration: vi.fn(() => vi.fn()),
    subscribeScroll: (listener) => {
      scrollListeners.add(listener)
      return () => scrollListeners.delete(listener)
    }
  }

  return {
    intersect: () => intersectionCallback?.(),
    runtime
  }
}

function renderPage(
  port: BookmarkListPort,
  runtime = createRuntime().runtime,
  filter: BookmarkListFilter = { kind: "recent" }
) {
  const onClearFilter = vi.fn()
  const onEdit = vi.fn()
  const onNavigateToFilter = vi.fn()

  function Harness() {
    const headingRef = React.useRef<HTMLHeadingElement>(null)
    return (
      <>
        <h1 ref={headingRef} tabIndex={-1}>
          最近追加したブックマーク
        </h1>
        <BookmarkListPage
          filter={filter}
          headingRef={headingRef}
          onClearFilter={onClearFilter}
          onEdit={onEdit}
          onNavigateToFilter={onNavigateToFilter}
          port={port}
          runtime={runtime}
        />
      </>
    )
  }

  const rendered = render(<Harness />)
  return {
    onClearFilter,
    onEdit,
    onNavigateToFilter,
    rerenderPage: () => rendered.rerender(<Harness />)
  }
}

function expectHoverEditTreatment(editButton: HTMLElement) {
  expect(editButton.className).toContain("pointer-events-none")
  expect(editButton.className).toContain("opacity-0")
  expect(editButton.className).toContain(
    "group-hover/bookmark:pointer-events-auto"
  )
  expect(editButton.className).toContain("group-hover/bookmark:opacity-100")
  expect(editButton.className).toContain("focus-visible:opacity-100")
}

function expectThumbnailHoverMask(editButton: HTMLElement) {
  const thumbnail = editButton.parentElement
  const bookmark = editButton.closest("article")
  const mask = thumbnail?.querySelector("[data-bookmark-hover-mask]")

  expect(thumbnail?.className).toContain("group/bookmark")
  expect(bookmark?.className).not.toContain("group/bookmark")
  expect(mask).not.toBeNull()
  expect(mask?.getAttribute("class")).toContain(
    "bg-[var(--bm-color-overlay)]"
  )
  expect(mask?.getAttribute("class")).toContain(
    "group-hover/bookmark:opacity-100"
  )
  expect(mask?.getAttribute("class")).toContain(
    "peer-focus-visible/edit:opacity-100"
  )
}

function expectBookmarkDestinationLinks(item: BookmarkListItem) {
  const thumbnailLink = screen.getByRole("link", {
    name: `${item.title}をサムネイルから開く`
  })
  const titleLink = screen.getByRole("link", { name: item.title })

  for (const link of [thumbnailLink, titleLink]) {
    expect(link.getAttribute("href")).toBe(item.url)
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noreferrer")
  }
}

describe("BookmarkListPage", () => {
  it("renders GRID, persists LIST, and discloses tags by keyboard", async () => {
    const user = userEvent.setup()
    const item = bookmark("one", 2_000)
    const loadPage = vi
      .fn<BookmarkListPort["loadPage"]>()
      .mockImplementation(async ({ requestId }) => ({
        items: [item],
        nextCursor: null,
        requestId,
        totalCount: 1
      }))
    const port = createPort(loadPage)
    const { onEdit, onNavigateToFilter, rerenderPage } = renderPage(port)

    expect(await screen.findByText(item.title)).not.toBeNull()
    rerenderPage()
    expect(loadPage).toHaveBeenCalledTimes(1)
    const toolbar = screen.getByRole("region", {
      name: "ブックマーク一覧ツールバー"
    })
    expect(toolbar.className).not.toContain("sticky")
    expect(toolbar.className).not.toContain("backdrop-blur")
    expect(
      screen.queryByRole("button", { name: "カテゴリ・タグ一覧" })
    ).toBeNull()
    expect(screen.getByText("#開発")).not.toBeNull()
    expect(screen.queryByText("#TypeScript")).toBeNull()
    expect(
      screen
        .getByRole("radio", { name: "グリッド表示" })
        .getAttribute("aria-checked")
    ).toBe("true")
    const category = screen.getByRole("button", { name: "#開発" })
    expect(category.className).toContain("rounded-l-none")
    expect(category.className).toContain("rounded-r-bm-chip")
    const gridEditButton = screen.getByRole("button", {
      name: `${item.title}を編集`
    })
    expectHoverEditTreatment(gridEditButton)
    expectThumbnailHoverMask(gridEditButton)
    expectBookmarkDestinationLinks(item)

    const tags = screen.getByRole("button", { name: "タグ1件を表示" })
    tags.focus()
    await user.keyboard(" ")
    expect(screen.getByText("#TypeScript")).not.toBeNull()

    await user.click(screen.getByRole("button", { name: "#TypeScript" }))
    expect(onNavigateToFilter).toHaveBeenCalledWith({
      id: "tag-typescript",
      kind: "tag"
    })

    await user.click(screen.getByRole("radio", { name: "リスト表示" }))
    expect(port.setViewMode).toHaveBeenCalledWith("LIST")
    expect(
      screen
        .getByRole("radio", { name: "リスト表示" })
        .getAttribute("aria-checked")
    ).toBe("true")

    const listEditButton = screen.getByRole("button", {
      name: `${item.title}を編集`
    })
    expectHoverEditTreatment(listEditButton)
    expect(listEditButton.closest("article")?.className).toContain(
      "group/bookmark"
    )
    expectBookmarkDestinationLinks(item)
    expect(
      listEditButton
        .closest("article")
        ?.querySelector("[data-bookmark-hover-mask]")
    ).toBeNull()
    await user.click(listEditButton)
    expect(onEdit).toHaveBeenCalledWith(item.id)
  })

  it("loads one cursor once, deduplicates IDs, and announces the end", async () => {
    const first = bookmark("one", 2_000)
    const second = bookmark("two", 1_000)
    let resolveMore!: (result: BookmarkListPageResult) => void
    const morePage = new Promise<BookmarkListPageResult>((resolve) => {
      resolveMore = resolve
    })
    const loadPage = vi
      .fn<BookmarkListPort["loadPage"]>()
      .mockImplementationOnce(async ({ requestId }) => ({
        items: [first],
        nextCursor: { id: first.id, savedAt: first.savedAt },
        requestId,
        totalCount: 2
      }))
      .mockImplementationOnce(() => morePage)
    const port = createPort(loadPage)
    const runtime = createRuntime()
    renderPage(port, runtime.runtime)

    expect(await screen.findByText(first.title)).not.toBeNull()
    await waitFor(() =>
      expect(runtime.runtime.observeIntersection).toHaveBeenCalled()
    )

    runtime.intersect()
    runtime.intersect()
    expect(loadPage).toHaveBeenCalledTimes(2)
    const requestId = loadPage.mock.calls[1]?.[0].requestId ?? ""
    resolveMore({
      items: [first, second],
      nextCursor: null,
      requestId,
      totalCount: 2
    })

    expect(await screen.findByText(second.title)).not.toBeNull()
    expect(screen.getAllByText(first.title)).toHaveLength(1)
    expect(screen.getByText("すべて表示しました。")).not.toBeNull()
  })

  it("shows only the tag for a tag-only filter and combines a selected category", async () => {
    const user = userEvent.setup()
    const item = bookmark("tag-only", 2_000)
    const loadPage = vi
      .fn<BookmarkListPort["loadPage"]>()
      .mockImplementation(async ({ requestId }) => ({
        items: [item],
        nextCursor: null,
        requestId,
        totalCount: 1
      }))
    const filter: BookmarkListFilter = {
      id: "tag-typescript",
      kind: "tag"
    }
    const { onClearFilter, onNavigateToFilter } = renderPage(
      createPort(loadPage),
      createRuntime().runtime,
      filter
    )

    expect(await screen.findByText(item.title)).not.toBeNull()
    const trail = screen.getByRole("list", { name: "現在の絞り込み" })
    const segments = within(trail).getAllByRole("listitem")
    expect(segments).toHaveLength(1)
    expect(segments[0]?.textContent).toBe("#TypeScript")
    expect(loadPage).toHaveBeenCalledWith(
      expect.objectContaining({ filter })
    )

    await user.click(screen.getByRole("button", { name: "#開発" }))
    expect(onNavigateToFilter).toHaveBeenCalledWith({
      categoryId: "category-development",
      kind: "category-tag",
      tagId: "tag-typescript"
    })

    await user.click(
      screen.getByRole("button", {
        name: "「TypeScript」の絞り込みを解除"
      })
    )
    expect(onClearFilter).toHaveBeenCalledOnce()
  })

  it("shows both labels for a combined category and tag filter", async () => {
    const user = userEvent.setup()
    const item = bookmark("combined", 2_000)
    const loadPage = vi
      .fn<BookmarkListPort["loadPage"]>()
      .mockImplementation(async ({ requestId }) => ({
        items: [item],
        nextCursor: null,
        requestId,
        totalCount: 1
      }))
    const filter: BookmarkListFilter = {
      categoryId: "category-development",
      kind: "category-tag",
      tagId: "tag-typescript"
    }
    const { onNavigateToFilter } = renderPage(
      createPort(loadPage),
      createRuntime().runtime,
      filter
    )

    expect(await screen.findByText(item.title)).not.toBeNull()
    const trail = screen.getByRole("list", { name: "現在の絞り込み" })
    const segments = within(trail).getAllByRole("listitem")
    expect(segments.map((segment) => segment.textContent)).toEqual([
      "#開発",
      "#TypeScript"
    ])
    expect(loadPage).toHaveBeenCalledWith(
      expect.objectContaining({ filter })
    )

    await user.click(
      screen.getByRole("button", { name: "「開発」の絞り込みを解除" })
    )
    expect(onNavigateToFilter).toHaveBeenCalledWith({
      id: "tag-typescript",
      kind: "tag"
    })

    await user.click(
      screen.getByRole("button", {
        name: "「TypeScript」の絞り込みを解除"
      })
    )
    expect(onNavigateToFilter).toHaveBeenCalledWith({
      id: "category-development",
      kind: "category"
    })
  })

  it("keeps the category when a tag is selected from a category filter", async () => {
    const user = userEvent.setup()
    const item = bookmark("category-then-tag", 2_000)
    const loadPage = vi
      .fn<BookmarkListPort["loadPage"]>()
      .mockImplementation(async ({ requestId }) => ({
        items: [item],
        nextCursor: null,
        requestId,
        totalCount: 1
      }))
    const { onNavigateToFilter } = renderPage(
      createPort(loadPage),
      createRuntime().runtime,
      { id: "category-development", kind: "category" }
    )

    expect(await screen.findByText(item.title)).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "タグ1件を表示" }))
    await user.click(screen.getByRole("button", { name: "#TypeScript" }))
    expect(onNavigateToFilter).toHaveBeenCalledWith({
      categoryId: "category-development",
      kind: "category-tag",
      tagId: "tag-typescript"
    })
  })

  it("retries a failed additional page from the same cursor", async () => {
    const first = bookmark("one", 2_000)
    const second = bookmark("two", 1_000)
    const loadPage = vi
      .fn<BookmarkListPort["loadPage"]>()
      .mockImplementationOnce(async ({ requestId }) => ({
        items: [first],
        nextCursor: { id: first.id, savedAt: first.savedAt },
        requestId,
        totalCount: 2
      }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(async ({ requestId }) => ({
        items: [second],
        nextCursor: null,
        requestId,
        totalCount: 2
      }))
    const port = createPort(loadPage)
    const runtime = createRuntime()
    const user = userEvent.setup()
    renderPage(port, runtime.runtime)

    expect(await screen.findByText(first.title)).not.toBeNull()
    await waitFor(() =>
      expect(runtime.runtime.observeIntersection).toHaveBeenCalled()
    )
    runtime.intersect()
    const retry = await screen.findByRole("button", {
      name: "この位置から再試行"
    })
    await user.click(retry)

    expect(await screen.findByText(second.title)).not.toBeNull()
    expect(loadPage).toHaveBeenCalledTimes(3)
  })

  it("shows an empty state and returns focus to the heading from back-to-top", async () => {
    const runtime = createRuntime(600)
    const port = createPort(async ({ requestId }) => ({
      items: [],
      nextCursor: null,
      requestId,
      totalCount: 0
    }))
    const user = userEvent.setup()
    renderPage(port, runtime.runtime)

    expect(
      await screen.findByText("ブックマークはまだありません")
    ).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "トップへ戻る" }))

    expect(runtime.runtime.scrollTo).toHaveBeenCalledWith(0)
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "最近追加したブックマーク" })
    )
  })
})
