/**
 * 注入したルートストアと実行環境が子へ届き、ブラウザ設定も元へ戻せることを
 * 確認するテストです。
 */
import { render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import {
  AppProviders,
  type AppRuntime,
  createBrowserAppRuntime,
  useAppRuntime,
  useHashRouteStore
} from "./AppProviders"
import { type HashRoute, type HashRouteStore } from "./hash-route"

function RuntimeKind() {
  const runtime = useAppRuntime()
  const routeStore = useHashRouteStore()
  return (
    <span>
      {runtime.kind}:{routeStore.getSnapshot().kind}
    </span>
  )
}

describe("AppProviders", () => {
  it("injects a preview runtime without feature-specific globals", () => {
    const runtime: AppRuntime = {
      getScrollY: vi.fn(() => 0),
      kind: "web-preview",
      scrollTo: vi.fn(),
      setManualScrollRestoration: vi.fn(() => vi.fn())
    }
    const routeStore: HashRouteStore = {
      back: vi.fn(),
      getSnapshot: vi.fn((): HashRoute => ({ kind: "home" })),
      navigate: vi.fn(),
      subscribe: vi.fn(() => vi.fn())
    }

    render(
      <AppProviders routeStore={routeStore} runtime={runtime}>
        <RuntimeKind />
      </AppProviders>
    )

    expect(screen.getByText("web-preview:home")).not.toBeNull()
  })

  it("wraps browser scroll restoration without feature APIs", () => {
    const runtime = createBrowserAppRuntime(window)
    const previous = window.history.scrollRestoration

    const restore = runtime.setManualScrollRestoration()
    expect(window.history.scrollRestoration).toBe("manual")
    restore()
    expect(window.history.scrollRestoration).toBe(previous)
  })
})
