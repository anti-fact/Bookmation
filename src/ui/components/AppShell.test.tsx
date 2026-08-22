/**
 * 単一のスクロール面、フォーカス可能な見出し、背景色の切り替えを確認します。
 */
import { render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { AppShell } from "./AppShell"

describe("AppShell", () => {
  it("renders one native-scroll page with a focusable heading", () => {
    render(
      <AppShell
        description="最近追加した項目です"
        header={<div data-testid="header">header</div>}
        heading="最近追加したブックマーク"
      >
        <p>content</p>
      </AppShell>
    )

    const heading = screen.getByRole("heading", {
      name: "最近追加したブックマーク"
    })

    expect(heading.getAttribute("tabindex")).toBe("-1")
    expect(heading.className).toContain("scroll-mt-64")
    expect(heading.className).toContain("lg:scroll-mt-32")
    expect(screen.getByRole("main").id).toBe("main-content")
    expect(screen.getByTestId("header")).not.toBeNull()
    expect(screen.getByText("content")).not.toBeNull()
  })

  it("supports the accent labels surface without a nested scroll region", () => {
    const { container } = render(
      <AppShell heading="カテゴリ・タグ一覧" tone="accent" />
    )

    expect(container.firstElementChild?.className).toContain("min-h-dvh")
    expect(container.firstElementChild?.className).toContain("bg-bm-accent")
    expect(screen.getByRole("main").getAttribute("role")).toBeNull()
  })
})
