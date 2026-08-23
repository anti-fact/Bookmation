/**
 * 利用者から見えるルート、ヘッダー、フォーカス、スクロール、通知の連携を
 * 差し替え可能なストアと実行環境で確認します。
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { AppProviders, type AppRuntime } from "./AppProviders"
import { ExtensionApp } from "./ExtensionApp"
import {
  type HashRoute,
  type HashRouteStore,
  type KnownHashRoute
} from "./hash-route"

// ブラウザ履歴を使わず、テストに必要なpush・replace・backだけを再現します。
function createRouteStore(initialRoute: HashRoute) {
  let route = initialRoute
  let historyIndex = 0
  const routeHistory: HashRoute[] = [initialRoute]
  const listeners = new Set<() => void>()

  const emit = (nextRoute: HashRoute) => {
    route = nextRoute
    listeners.forEach((listener) => listener())
  }

  const store: HashRouteStore = {
    back: vi.fn(() => {
      if (historyIndex === 0) return
      historyIndex -= 1
      emit(routeHistory[historyIndex])
    }),
    getSnapshot: () => route,
    navigate: vi.fn((nextRoute: KnownHashRoute, options = {}) => {
      if (options.replace) {
        routeHistory[historyIndex] = nextRoute
      } else {
        routeHistory.splice(historyIndex + 1)
        routeHistory.push(nextRoute)
        historyIndex += 1
      }
      emit(nextRoute)
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }

  return { emit, store }
}

// 実際には移動せず、スクロール位置の保存と復元だけを観測するテスト用実装です。
function createRuntime() {
  let scrollY = 0
  const restore = vi.fn()
  const runtime: AppRuntime = {
    getScrollY: () => scrollY,
    kind: "web-preview",
    observeIntersection: vi.fn(() => vi.fn()),
    scrollTo: vi.fn(),
    setManualScrollRestoration: vi.fn(() => restore),
    subscribeScroll: vi.fn(() => vi.fn())
  }

  return {
    runtime,
    setScrollY: (nextScrollY: number) => {
      scrollY = nextScrollY
    }
  }
}

function renderApp(
  initialRoute: HashRoute,
  appProps: React.ComponentProps<typeof ExtensionApp> = {}
) {
  const routes = createRouteStore(initialRoute)
  const runtime = createRuntime()

  render(
    <React.StrictMode>
      <AppProviders routeStore={routes.store} runtime={runtime.runtime}>
        <ExtensionApp {...appProps} />
      </AppProviders>
    </React.StrictMode>
  )

  return { ...routes, ...runtime }
}

describe("ExtensionApp", () => {
  it("opens URL bookmark creation from a plus icon instead of an inline home form", () => {
    renderApp({ kind: "home" })

    expect(
      screen.queryByRole("form", { name: "ブックマーク追加フォーム" })
    ).toBeNull()
    expect(screen.queryByText("URL を保存")).toBeNull()

    const addButton = screen.getByRole("button", {
      name: "ブックマークを追加"
    })
    expect(addButton.className).toContain("rounded-bm-pill")
    expect(addButton.querySelector("svg")?.classList.contains("size-6")).toBe(
      true
    )

    fireEvent.click(addButton)

    expect(
      screen.getByRole("dialog", { name: "ブックマークを追加" })
    ).not.toBeNull()
    expect(
      screen.getByRole("form", { name: "ブックマーク追加フォーム" })
    ).not.toBeNull()
  })

  it("opens the shared edit dialog from each bookmark edit button", async () => {
    const item = {
      categories: [{ id: "category-development", name: "開発" }],
      faviconSrc: "data:image/png;base64,AA==",
      id: "bookmark-edit",
      revision: 3,
      savedAt: 1_000,
      siteName: "example.com",
      tags: [
        {
          id: "tag-react",
          name: "React",
          parentCategoryId: "category-development",
          parentCategoryName: "開発",
          revision: 2
        }
      ],
      thumbnailSrc: "data:image/png;base64,AA==",
      title: "編集対象",
      url: "https://example.com/edit"
    }
    const bookmarkListPort = {
      getViewMode: vi.fn().mockResolvedValue("GRID" as const),
      loadPage: vi.fn(async ({ requestId }: { requestId: string }) => ({
        items: [item],
        nextCursor: null,
        requestId,
        totalCount: 1
      })),
      setViewMode: vi.fn().mockResolvedValue(undefined)
    }
    renderApp({ kind: "home" }, { bookmarkListPort })

    fireEvent.click(
      await screen.findByRole("button", { name: "編集対象を編集" })
    )

    expect(
      screen.getByRole("dialog", { name: "ブックマークを編集" })
    ).not.toBeNull()
    expect(
      (screen.getByRole("textbox", { name: "タイトル" }) as HTMLInputElement)
        .value
    ).toBe("編集対象")
    expect(
      screen.getByRole("button", { name: "タグ「React」を解除" })
    ).not.toBeNull()
  })

  it("changes the shared shell through typed navigation and focuses its heading", () => {
    const { store } = renderApp({ kind: "home" })

    const homeHeading = screen.getByRole("heading", {
      name: "最近追加したブックマーク"
    })
    expect(document.activeElement).not.toBe(homeHeading)
    expect(
      screen.getByRole("banner", { name: "アプリケーションヘッダー" }).dataset
        .variant
    ).toBe("default")
    expect(
      screen
        .getByRole("button", { name: "カテゴリ・タグ一覧を開く" })
        .querySelector("img")?.className
    ).toContain("size-[1.125rem]")
    expect(
      screen.queryByRole("button", { name: "カテゴリ・タグ一覧" })
    ).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }))

    expect(store.navigate).toHaveBeenCalledWith({
      kind: "settings",
      section: "general"
    })
    const settingsHeading = screen.getByRole("heading", {
      level: 1,
      name: "一般設定"
    })
    expect(document.activeElement).toBe(settingsHeading)
    const settingsIntro = settingsHeading.parentElement
    expect(settingsIntro?.className).toContain("-ml-4")
    expect(settingsIntro?.className).toContain("pl-8")
    expect(settingsIntro?.className).toContain("sm:-ml-8")
    expect(settingsIntro?.className).toContain("sm:pl-10")
    expect(settingsIntro?.className).toContain("lg:-ml-[4.5rem]")
    expect(settingsIntro?.className).toContain("lg:pl-14")
    expect(settingsIntro?.className).toContain(
      "min-[1440px]:ml-[calc(-4.5rem-(100vw-90rem)/2)]"
    )
    const generalLink = screen.getByRole("link", { name: "一般" })
    expect(generalLink.getAttribute("href")).toBe("#/settings/general")
    expect(generalLink.getAttribute("aria-current")).toBe("page")
    expect(generalLink.className).toContain("font-bold")
    expect(generalLink.className).toContain("text-bm-paper")
    expect(generalLink.className).toContain("pl-8")
    expect(generalLink.className).toContain("text-base")
    expect(generalLink.className).toContain("sm:pl-10")
    expect(generalLink.className).toContain("lg:pl-14")
    expect(generalLink.className).toContain("lg:text-xl")
    expect(generalLink.className).toContain("focus-visible:ring-bm-paper")
    expect(generalLink.className).toContain("group")
    const settingsNavigation = screen.getByRole("navigation", {
      name: "設定メニュー"
    })
    const settingsLayout = settingsNavigation.parentElement
    expect(settingsLayout?.className).toContain(
      "grid-cols-[clamp(7rem,28vw,13rem)_0.125rem_minmax(0,1fr)]"
    )
    expect(settingsLayout?.className).not.toContain("md:grid-cols")
    const settingsMenu = settingsNavigation.querySelector("ul")
    expect(settingsMenu?.className).toContain("flex-col")
    expect(settingsMenu?.className).not.toContain("flex-wrap")
    expect(settingsNavigation.className).toContain("-ml-4")
    expect(settingsNavigation.className).toContain("lg:-ml-[4.5rem]")
    const [currentHoverHighlight, selectionHighlight] =
      generalLink.querySelectorAll('span[aria-hidden="true"]')
    const sharedBackgroundClasses = [
      "absolute",
      "inset-y-0",
      "-right-2",
      "w-screen",
      "sm:-right-4",
      "lg:-right-6"
    ]
    for (const className of sharedBackgroundClasses) {
      expect(currentHoverHighlight?.className).toContain(className)
      expect(selectionHighlight?.className).toContain(className)
    }
    expect(currentHoverHighlight?.className).toContain("bg-transparent")
    expect(currentHoverHighlight?.className).toContain(
      "group-hover:bg-bm-accent"
    )
    expect(selectionHighlight?.className).toContain("-right-2")
    expect(selectionHighlight?.className).toContain("w-screen")
    expect(selectionHighlight?.className).toContain("bg-bm-ink")
    expect(selectionHighlight?.className).toContain("lg:-right-6")
    expect(selectionHighlight?.className).not.toContain(
      "group-hover:bg-bm-accent"
    )
    expect(selectionHighlight?.className).not.toContain("w-0.5")
    expect(selectionHighlight?.className).not.toContain("left-0")
    const archiveLink = screen.getByRole("link", { name: "アーカイブ" })
    const hoverHighlight = archiveLink.querySelector('span[aria-hidden="true"]')
    for (const className of sharedBackgroundClasses) {
      expect(hoverHighlight?.className).toContain(className)
    }
    expect(hoverHighlight?.className).toContain("bg-transparent")
    expect(hoverHighlight?.className).toContain("group-hover:bg-bm-accent")
    expect(hoverHighlight?.className).not.toContain("group-hover:bg-bm-ink")
    expect(hoverHighlight?.className).not.toContain("bg-bm-ink")
    expect(generalLink.querySelector("span.relative")?.className).toContain(
      "gap-3"
    )
    for (const sectionName of ["一般", "アーカイブ", "共有"]) {
      const settingsIcon = screen
        .getByRole("link", { name: sectionName })
        .querySelector("svg")
      expect(settingsIcon?.getAttribute("aria-hidden")).toBe("true")
      expect(settingsIcon?.getAttribute("class")).toContain("size-4")
      expect(settingsIcon?.getAttribute("class")).toContain("shrink-0")
    }
    expect(screen.queryByRole("button", { name: "一般" })).toBeNull()
    expect(
      screen.getByRole("banner", { name: "アプリケーションヘッダー" }).dataset
        .variant
    ).toBe("settings")
    const settingsSeparator = screen.getByRole("separator", {
      name: "設定メニューと設定内容の区切り"
    })
    expect(settingsSeparator.getAttribute("aria-orientation")).toBe("vertical")
    expect(settingsSeparator.className).toContain("block")
    expect(settingsSeparator.className).not.toContain("hidden")
    expect(settingsSeparator.className).toContain("bg-bm-muted")
    const settingsContent = screen.getByRole("region", {
      name: "一般設定の内容"
    })
    expect(settingsContent.className).toContain("min-w-0")
    expect(settingsContent.className).toContain("overflow-x-auto")
    expect(settingsContent.className).toContain("p-3")
    expect(settingsContent.className).toContain("sm:p-5")
    expect(settingsContent.className).toContain("lg:p-8")
    expect(
      screen.queryByRole("region", { name: "Prompt API スパイク設定" })
    ).toBeNull()
  })

  it("renders all header variants from one AppHeader component", () => {
    const { emit } = renderApp({ kind: "labels" })

    expect(
      screen.getByRole("banner", { name: "アプリケーションヘッダー" }).dataset
        .variant
    ).toBe("labels")
    expect(screen.queryByRole("button", { name: "AI検索を開く" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "新規作成メニュー" })
    ).not.toBeNull()
    expect(
      screen.getByRole("button", { name: "管理モードを切り替える" })
    ).not.toBeNull()

    act(() => emit({ kind: "settings", section: "archive" }))
    expect(
      screen.getByRole("banner", { name: "アプリケーションヘッダー" }).dataset
        .variant
    ).toBe("settings")

    act(() => emit({ kind: "welcome" }))
    expect(
      screen.queryByRole("banner", { name: "アプリケーションヘッダー" })
    ).toBeNull()
    expect(
      screen.getByRole("heading", { name: "Bookmationへようこそ" })
    ).not.toBeNull()
  })

  it("opens the same AI assistant from bookmark and labels screens", () => {
    const { emit } = renderApp(
      { kind: "home" },
      {
        aiAssistantPort: {
          ask: vi.fn()
        }
      }
    )

    fireEvent.click(
      screen.getByRole("button", { name: "AIアシスタントを開く" })
    )
    expect(
      screen.getByRole("dialog", { name: "AIアシスタント" })
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "AIアシスタントを閉じる" })
    )
    act(() => emit({ kind: "labels" }))
    expect(
      screen.getByRole("button", { name: "AIアシスタントを開く" })
    ).not.toBeNull()
  })

  it("renders the canonical Figma welcome layout and starts from its action", async () => {
    const { store } = renderApp({ kind: "welcome" })

    const main = screen.getByRole("main")
    expect(main.className).toContain("min-h-dvh")
    expect(main.className).toContain("items-center")
    expect(main.className).toContain("justify-center")
    expect(screen.queryByText("Welcome")).toBeNull()

    const logo = screen.getByRole("img", { name: "Bookmation" })
    expect(logo.getAttribute("width")).toBe("400")
    expect(logo.className).toContain("max-w-[25rem]")
    expect(
      screen.getByText(
        "Bookmationはブックマークを簡単に整理できる拡張機能です。"
      )
    ).not.toBeNull()
    expect(
      screen.getByText(
        "かんたんな初期設定を終わらせて、さっそくはじめましょう。"
      )
    ).not.toBeNull()

    const startButton = screen.getByRole("button", {
      name: "ここからはじめる"
    })
    expect(startButton.className).toContain("max-w-[26.75rem]")
    expect(startButton.className).toContain("!rounded-none")

    fireEvent.click(startButton)
    await waitFor(() =>
      expect(store.navigate).toHaveBeenCalledWith({
        kind: "onboarding",
        step: "categories"
      })
    )
  })

  it("shows the category onboarding step and returns home once it is saved", async () => {
    const complete = vi.fn(async () => ({
      categorySelection: {},
      currentStepId: null,
      initializedBy: "INSTALL" as const,
      schemaVersion: 1 as const,
      status: "COMPLETED" as const,
      updatedAt: 2
    }))
    const { store } = renderApp(
      { kind: "onboarding", step: "categories" },
      {
        onboardingPort: {
          complete,
          load: vi.fn(async () => null),
          loadWithMeta: vi.fn(async () => null),
          saveSelection: vi.fn(),
          skip: vi.fn(),
          start: vi.fn()
        }
      }
    )

    expect(
      screen.queryByRole("banner", { name: "アプリケーションヘッダー" })
    ).toBeNull()
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "あなたにあったカテゴリを選ぶ"
      })
    ).not.toBeNull()
    expect(screen.getByRole("button", { name: /授業・講義/ })).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "設定を保存" }))
    await waitFor(() => expect(complete).toHaveBeenCalledWith({}))
    expect(store.navigate).toHaveBeenCalledWith({ kind: "home" })
  })

  it("resumes an unfinished category step when home opens", async () => {
    const { store } = renderApp(
      { kind: "home" },
      {
        onboardingPort: {
          complete: vi.fn(),
          load: vi.fn(async () => ({
            categorySelection: { "study.lecture": ["授業ページ"] },
            currentStepId: "categories",
            initializedBy: "INSTALL" as const,
            schemaVersion: 1 as const,
            status: "IN_PROGRESS" as const,
            updatedAt: 1
          })),
          loadWithMeta: vi.fn(async () => ({
            catalogMismatch: false,
            state: {
              categorySelection: { "study.lecture": ["授業ページ"] },
              currentStepId: "categories",
              initializedBy: "INSTALL" as const,
              schemaVersion: 1 as const,
              status: "IN_PROGRESS" as const,
              updatedAt: 1
            }
          })),
          saveSelection: vi.fn(),
          skip: vi.fn(),
          start: vi.fn()
        }
      }
    )

    await waitFor(() =>
      expect(store.navigate).toHaveBeenCalledWith(
        { kind: "onboarding", step: "categories" },
        { replace: true }
      )
    )
  })

  it("restores saved native-document scroll on browser back navigation", () => {
    const { runtime, setScrollY, store } = renderApp({ kind: "home" })

    setScrollY(640)
    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }))
    expect(runtime.scrollTo).toHaveBeenLastCalledWith(0)

    setScrollY(32)
    fireEvent.click(screen.getByRole("button", { name: "設定を閉じる" }))
    expect(store.back).toHaveBeenCalledOnce()
    expect(
      screen.getByRole("heading", { name: "最近追加したブックマーク" })
    ).not.toBeNull()
    expect(runtime.scrollTo).toHaveBeenLastCalledWith(640)
  })

  it("replaces settings sections so close returns to the origin route", () => {
    const { store } = renderApp({ kind: "home" })

    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }))
    fireEvent.click(screen.getByRole("link", { name: "アーカイブ" }))
    expect(store.navigate).toHaveBeenLastCalledWith(
      { kind: "settings", section: "archive" },
      { replace: true }
    )

    fireEvent.click(screen.getByRole("button", { name: "設定を閉じる" }))
    expect(
      screen.getByRole("heading", { name: "最近追加したブックマーク" })
    ).not.toBeNull()
  })

  it("uses a replace-home fallback when a closeable route was opened directly", () => {
    const { store } = renderApp({ kind: "labels" })

    fireEvent.click(
      screen.getByRole("button", { name: "カテゴリ・タグ一覧を閉じる" })
    )
    expect(store.navigate).toHaveBeenCalledWith(
      { kind: "home" },
      { replace: true }
    )
  })

  it("keeps malformed URLs visible until the user chooses recovery", () => {
    const { store } = renderApp({
      attemptedHash: "#/bookmarks?category=one&category=two",
      kind: "not-found",
      reason: "invalid-query"
    })

    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" })
    ).not.toBeNull()
    expect(store.navigate).not.toHaveBeenCalled()

    const homeButton = screen.getByRole("button", { name: "ホームへ移動" })
    expect(homeButton.parentElement?.className).toContain("justify-start")
    expect(homeButton.parentElement?.className).not.toContain("justify-end")
    expect(homeButton.className).toContain("bg-bm-paper")
    expect(homeButton.className).toContain("text-bm-ink")
    expect(homeButton.className).toContain("hover:bg-bm-ink")
    expect(homeButton.className).toContain("hover:text-bm-paper")
    expect(homeButton.className).toContain("active:bg-bm-ink")
    expect(homeButton.className).toContain("active:text-bm-paper")

    fireEvent.click(homeButton)
    expect(store.navigate).toHaveBeenCalledWith({ kind: "home" })
  })

  it("opens the category and tag list from the telescope button", () => {
    const { store } = renderApp({ kind: "home" })

    fireEvent.click(
      screen.getByRole("button", { name: "カテゴリ・タグ一覧を開く" })
    )
    expect(store.navigate).toHaveBeenCalledWith({ kind: "labels" })
  })

  it("returns home when the last bookmark filter is removed", () => {
    const { store } = renderApp({
      filter: { id: "tag-typescript", kind: "tag" },
      kind: "bookmarks"
    })

    fireEvent.click(
      screen.getByRole("button", {
        name: "「tag-typescript」の絞り込みを解除"
      })
    )
    expect(store.navigate).toHaveBeenCalledWith({ kind: "home" })
    expect(
      screen.getByRole("heading", { name: "最近追加したブックマーク" })
    ).not.toBeNull()
  })

  it("opens keyword search results from the shared search box", () => {
    const { store } = renderApp({ kind: "home" })

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "ブックマーク、カテゴリ、タグを検索"
      }),
      { target: { value: "TypeScript" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "検索する" }))

    expect(store.navigate).toHaveBeenCalledWith({
      kind: "search",
      query: "TypeScript"
    })
  })
})
