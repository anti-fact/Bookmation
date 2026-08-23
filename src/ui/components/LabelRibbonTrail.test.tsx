import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { LabelRibbonTrail } from "./LabelRibbonTrail"

describe("LabelRibbonTrail", () => {
  it("renders removable category and tag chevrons with a centered hover action", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(
      <LabelRibbonTrail
        items={[
          { id: "category", label: "開発" },
          { id: "tag", label: "サブタグ" }
        ]}
        onRemove={onRemove}
      />
    )

    const trail = screen.getByRole("list", { name: "現在の絞り込み" })
    const segments = within(trail).getAllByRole("listitem")

    expect(segments).toHaveLength(2)
    expect(segments[0]?.textContent).toBe("#開発")
    expect(segments[1]?.textContent).toBe("#サブタグ")
    expect(segments[0]?.style.clipPath).toContain("calc(100% - 29px)")
    expect(segments[0]?.className).toContain("text-2xl")
    expect(segments[0]?.className).toContain("sm:text-3xl")
    expect(segments[0]?.className).not.toContain("text-4xl")
    expect(segments[0]?.className).toContain("hover:bg-bm-ink")
    expect(segments[0]?.className).toContain("hover:text-bm-paper")
    expect(segments[0]?.className).toContain("focus-within:bg-bm-ink")
    expect(segments[0]?.className).toContain("focus-within:text-bm-paper")
    expect(segments[1]?.className).toContain("-ml-[15px]")
    expect(segments[1]?.style.zIndex).toBe("2")
    const categoryRemove = within(segments[0]!).getByRole("button", {
      name: "「開発」の絞り込みを解除"
    })
    expect(categoryRemove.className).toContain("left-1/2")
    expect(categoryRemove.className).toContain("top-1/2")
    expect(categoryRemove.className).toContain("opacity-0")
    expect(categoryRemove.className).toContain("group-hover:opacity-100")

    await user.click(categoryRemove)
    expect(onRemove).toHaveBeenCalledWith("category")
  })

  it("keeps a non-filter trail non-interactive", () => {
    render(<LabelRibbonTrail items={[{ id: "recent", label: "最近追加" }]} />)

    expect(screen.queryByRole("button")).toBeNull()
  })
})
