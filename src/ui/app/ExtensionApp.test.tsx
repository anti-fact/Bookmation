/**
 * 利用者から見えるルート、ヘッダー、フォーカス、スクロール、通知の連携を
 * 差し替え可能なストアと実行環境で確認します。
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
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
    scrollTo: vi.fn(),
    setManualScrollRestoration: vi.fn(() => restore)
  }

  return {
    runtime,
    setScrollY: (nextScrollY: number) => {
      scrollY = nextScrollY
    }
  }
}

function renderApp(initialRoute: HashRoute) {
  const routes = createRouteStore(initialRoute)
  const runtime = createRuntime()

  render(
    <React.StrictMode>
      <AppProviders routeStore={routes.store} runtime={runtime.runtime}>
        <ExtensionApp />
      </AppProviders>
    </React.StrictMode>
  )

  return { ...routes, ...runtime }
}

describe("ExtensionApp", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }))

    expect(store.navigate).toHaveBeenCalledWith({
      kind: "settings",
      section: "general"
    })
    const settingsHeading = screen.getByRole("heading", {
      level: 1,
      name: "一般設定",
    })
    expect(document.activeElement).toBe(settingsHeading)
    expect(
      screen.getByRole("banner", { name: "アプリケーションヘッダー" }).dataset
        .variant
    ).toBe("settings")
  })

  it("renders all header variants from one AppHeader component", () => {
    const { emit } = renderApp({ kind: "labels" })

    expect(
      screen.getByRole("banner", { name: "アプリケーションヘッダー" }).dataset
        .variant
    ).toBe("labels")
    expect(screen.getByRole("button", { name: "AI検索を開く" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "新規作成" })).not.toBeNull()

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
    fireEvent.click(screen.getByRole("button", { name: "アーカイブ" }))
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
      attemptedHash: "#/bookmarks?category=one&tag=two",
      kind: "not-found",
      reason: "invalid-query"
    })

    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" })
    ).not.toBeNull()
    expect(store.navigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "ホームへ移動" }))
    expect(store.navigate).toHaveBeenCalledWith({ kind: "home" })
  })

  it("announces unavailable feature slots without changing route", () => {
    const { store } = renderApp({ kind: "home" })

    fireEvent.click(screen.getByRole("button", { name: "AI検索を開く" }))
    expect(screen.getByRole("status").textContent).toContain(
      "AI検索は現在準備中です"
    )
    expect(store.navigate).not.toHaveBeenCalled()
  })
})
