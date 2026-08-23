// IconButton の読み上げ名、ツールチップ、ref の受け渡しを確認するテストです。
import { render, screen } from "@testing-library/react"
import { GearIcon } from "@radix-ui/react-icons"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { IconButton } from "./icon-button"

describe("IconButton", () => {
  it("requires a visible Japanese accessible name while hiding the glyph", () => {
    // アイコンそのものではなく label が支援技術からのボタン名になります。
    render(
      <IconButton data-purpose="settings" label="設定を開く">
        <GearIcon />
      </IconButton>
    )

    const button = screen.getByRole("button", { name: "設定を開く" })
    expect(button.getAttribute("type")).toBe("button")
    expect(button.getAttribute("data-purpose")).toBe("settings")
    expect(button.className).toContain("hover:bg-bm-ink")
    expect(button.className).toContain("hover:text-bm-paper")
    expect(button.className).toContain("[&:hover_img]:invert")
    expect(button.querySelector("span")?.getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  it("exposes the tooltip on focus and forwards the button ref", async () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(
      <IconButton label="AI検索を開く" ref={ref} tooltip="AI検索">
        <span>AI</span>
      </IconButton>
    )

    const button = screen.getByRole("button", { name: "AI検索を開く" })
    button.focus()

    expect(ref.current).toBe(button)
    expect((await screen.findByRole("tooltip")).textContent).toContain("AI検索")
  })

  it("can omit a tooltip without removing the accessible name", () => {
    render(
      <IconButton label="閉じる" tooltip={false}>
        ×
      </IconButton>
    )

    expect(screen.getByRole("button", { name: "閉じる" })).toBeTruthy()
    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
