/**
 * 3種類のヘッダーの表示差、キーボード順、操作枠、読み上げ名を確認します。
 */
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

  it("matches the Figma labels header and exposes its create/manage/close actions", async () => {
    const user = userEvent.setup()
    const callbacks = {
      category: vi.fn(),
      close: vi.fn(),
      manage: vi.fn(),
      tag: vi.fn()
    }

    render(
      <AppHeader
        onClose={callbacks.close}
        onCreateCategoryClick={callbacks.category}
        onCreateTagClick={callbacks.tag}
        onManageClick={callbacks.manage}
        variant="labels"
      />
    )

    const header = screen.getByRole("banner")
    expect(header.className).toContain("bg-bm-accent")
    const headerRow = header.firstElementChild
    expect(headerRow?.className).toContain("lg:flex-nowrap")
    expect(headerRow?.className).toContain("lg:justify-start")
    expect(headerRow?.className).toContain("lg:gap-[3rem]")
    expect(headerRow?.className).not.toContain("md:flex-nowrap")
    const searchButton = screen.getByRole("button", { name: "検索を開く" })
    expect(searchButton.className).toContain("h-[3.125rem]")
    expect(searchButton.className).toContain("rounded-bm-pill")
    expect(searchButton.className).toContain("border-2")
    expect(searchButton.parentElement?.className).not.toContain(
      "min-[1400px]:ml-[12.625rem]"
    )
    expect(screen.getByText("ブックマーク、カテゴリ、タグを検索")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "AI検索を開く" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "新規作成メニュー" }))
    await user.click(screen.getByRole("menuitem", { name: "Category" }))
    expect(callbacks.category).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "新規作成メニュー" }))
    await user.click(screen.getByRole("menuitem", { name: "Tag" }))
    expect(callbacks.tag).toHaveBeenCalledTimes(1)

    const manageButton = screen.getByRole("button", {
      name: "管理モードを切り替える"
    })
    expect(manageButton.getAttribute("aria-pressed")).toBe("false")
    expect(manageButton.getAttribute("data-state")).toBe("off")
    expect(manageButton.className).toContain("data-[state=on]:bg-bm-ink")
    expect(manageButton.className).toContain("[&[data-state=on]_img]:invert")
    expect(manageButton.className).toContain(
      "data-[state=on]:hover:bg-bm-paper"
    )
    expect(manageButton.className).toContain(
      "data-[state=on]:hover:text-bm-ink"
    )
    expect(manageButton.className).toContain(
      "[&[data-state=on]:hover_img]:invert-0"
    )

    await user.click(manageButton)
    expect(callbacks.manage).toHaveBeenCalledTimes(1)
    expect(manageButton.getAttribute("aria-pressed")).toBe("true")
    expect(manageButton.getAttribute("data-state")).toBe("on")

    await user.click(manageButton)
    expect(callbacks.manage).toHaveBeenCalledTimes(2)
    expect(manageButton.getAttribute("aria-pressed")).toBe("false")
    expect(manageButton.getAttribute("data-state")).toBe("off")

    await user.click(
      screen.getByRole("button", { name: "カテゴリ・タグ一覧を閉じる" })
    )
    expect(callbacks.close).toHaveBeenCalledTimes(1)
  })

  it("renders the settings title and close control without a search entry", () => {
    render(<AppHeader variant="settings" />)

    expect(screen.getByText("設定")).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "設定" })).toBeNull()
    const separator = screen.getByRole("separator")
    expect(separator.getAttribute("aria-orientation")).toBe("vertical")
    expect(separator.className).toContain("bg-bm-muted")
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
