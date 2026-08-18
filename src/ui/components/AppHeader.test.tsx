import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { AppHeader } from "./AppHeader"

describe("AppHeader", () => {
  it("renders the default header in logical keyboard focus order", async () => {
    const user = userEvent.setup()
    const callbacks = {
      ai: vi.fn(),
      home: vi.fn(),
      search: vi.fn(),
      settings: vi.fn()
    }

    render(
      <AppHeader
        onAiSearchClick={callbacks.ai}
        onLogoClick={callbacks.home}
        onSearchClick={callbacks.search}
        onSettingsClick={callbacks.settings}
        variant="default"
      />
    )

    expect(screen.getByRole("banner").getAttribute("data-variant")).toBe(
      "default"
    )

    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "ホームへ移動" })
    )
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "検索を開く" })
    )
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "AI検索を開く" })
    )
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "設定を開く" })
    )

    await user.click(screen.getByRole("button", { name: "AI検索を開く" }))
    await user.click(screen.getByRole("button", { name: "設定を開く" }))
    expect(callbacks.ai).toHaveBeenCalledTimes(1)
    expect(callbacks.settings).toHaveBeenCalledTimes(1)
  })

  it("uses the accent labels variant and preserves new/manage/close slots", async () => {
    const user = userEvent.setup()
    const onAiSearchClick = vi.fn()
    const onClose = vi.fn()

    render(
      <AppHeader
        manageAction={<button type="button">管理</button>}
        newAction={<button type="button">新規作成</button>}
        onAiSearchClick={onAiSearchClick}
        onClose={onClose}
        variant="labels"
      />
    )

    const header = screen.getByRole("banner")
    expect(header.className).toContain("bg-bm-accent")
    const headerRow = header.firstElementChild
    expect(headerRow?.className).toContain("lg:flex-nowrap")
    expect(headerRow?.className).not.toContain("md:flex-nowrap")
    expect(screen.getByRole("button", { name: "検索を開く" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "AI検索を開く" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "新規作成" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "管理" })).toBeTruthy()

    await user.click(
      screen.getByRole("button", { name: "カテゴリ・タグ一覧を閉じる" })
    )
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "AI検索を開く" }))
    expect(onAiSearchClick).toHaveBeenCalledTimes(1)
  })

  it("renders the settings title and close control without a search entry", () => {
    render(<AppHeader variant="settings" />)

    expect(screen.getByText("設定")).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "設定" })).toBeNull()
    expect(screen.getByRole("button", { name: "設定を閉じる" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "検索を開く" })).toBeNull()
  })

  it("uses an accessible wordmark fallback when no image source is supplied", () => {
    render(<AppHeader variant="default" />)

    expect(screen.getByText("Bookmation")).toBeTruthy()
    expect(screen.getByRole("banner").className).toContain("w-full")
    expect(screen.getByRole("banner").firstElementChild?.className).toContain(
      "md:flex-nowrap"
    )
  })
})
