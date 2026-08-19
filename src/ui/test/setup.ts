// Vitest の各 UI テストが同じ簡易ブラウザー環境で動くように準備するファイルです。
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  // 前のテストで描画した DOM を片付け、テスト同士が影響しないようにします。
  cleanup()
})

// jsdom にないブラウザー API を最小限だけ補い、Radix の内部処理を実行可能にします。
class TestResizeObserver implements ResizeObserver {
  disconnect = vi.fn()
  observe = vi.fn()
  unobserve = vi.fn()
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: TestResizeObserver
})

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  }))
})

// 以下はスクロールや Pointer Capture を使う UI 部品向けのテスト用代替実装です。
Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: vi.fn()
})

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: vi.fn(() => false)
})

Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: vi.fn()
})

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn()
})

Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: vi.fn()
})
