// Button の属性引き継ぎ、無効化、asChild 合成が壊れていないか確認するテストです。
import { fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { Button } from "./button"

describe("Button", () => {
  it("renders a solid button with a white resting state", () => {
    render(<Button variant="solid">保存する</Button>)

    const classNames = screen
      .getByRole("button", { name: "保存する" })
      .className.split(" ")
    expect(classNames).toContain("bg-bm-paper")
    expect(classNames).toContain("text-bm-ink")
    expect(classNames).not.toContain("bg-bm-ink")
    expect(classNames).not.toContain("text-bm-paper")
    expect(classNames).toContain("hover:bg-bm-ink")
    expect(classNames).toContain("hover:text-bm-paper")
  })

  it("uses the shared red danger color for solid delete actions", () => {
    render(
      <Button tone="danger" variant="solid">
        削除する
      </Button>
    )

    const classNames = screen
      .getByRole("button", { name: "削除する" })
      .className.split(" ")
    expect(classNames).toContain("border-bm-danger")
    expect(classNames).toContain("bg-bm-danger")
    expect(classNames).toContain("text-bm-paper")
  })

  it("defaults to type button and forwards props, className, ref, and click", () => {
    const onClick = vi.fn()
    const ref = React.createRef<HTMLButtonElement>()

    render(
      <Button
        className="consumer-class"
        data-purpose="save"
        onClick={onClick}
        ref={ref}
      >
        保存する
      </Button>
    )

    const button = screen.getByRole("button", { name: "保存する" })
    expect(button.getAttribute("type")).toBe("button")
    expect(button.className).toContain("consumer-class")
    expect(button.className).toContain("hover:bg-bm-ink")
    expect(button.className).toContain("hover:text-bm-paper")
    expect(button.className).not.toContain("hover:bg-bm-accent")
    expect(button.getAttribute("data-purpose")).toBe("save")
    expect(ref.current).toBe(button)

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("does not invoke the consumer handler while disabled or loading", () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <Button disabled onClick={onClick}>
        無効
      </Button>
    )

    fireEvent.click(screen.getByRole("button", { name: "無効" }))
    expect(onClick).not.toHaveBeenCalled()

    rerender(
      <Button loading onClick={onClick}>
        保存中
      </Button>
    )
    const loadingButton = screen.getByRole("button", { name: "保存中" })
    expect(loadingButton.getAttribute("aria-busy")).toBe("true")
    fireEvent.click(loadingButton)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("uses the child anchor without losing consumer props or its forwarded ref", () => {
    // asChild では button を増やさず、リンク自体が装飾と ref を受け取ることが重要です。
    const ref = React.createRef<HTMLButtonElement>()

    render(
      <Button asChild data-purpose="sheet-link" ref={ref}>
        <a className="consumer-link" href="#target">
          対象へ移動
        </a>
      </Button>
    )

    const link = screen.getByRole("link", { name: "対象へ移動" })
    expect(link.getAttribute("href")).toBe("#target")
    expect(link.getAttribute("data-purpose")).toBe("sheet-link")
    expect(link.className).toContain("consumer-link")
    expect(ref.current).toBe(link)
    expect(link.querySelector("button")).toBeNull()
  })

  it("removes a disabled asChild link from tab order and blocks navigation", () => {
    // disabled 属性を持てないリンクでも、キーボード移動とクリックの両方を止めます。
    const onClick = vi.fn()
    render(
      <Button asChild disabled onClick={onClick}>
        <a href="#blocked">移動できないリンク</a>
      </Button>
    )

    const link = screen.getByRole("link", { name: "移動できないリンク" })
    expect(link.getAttribute("aria-disabled")).toBe("true")
    expect(link.getAttribute("tabindex")).toBe("-1")
    expect(link.className).toContain("aria-disabled:opacity-45")

    const clickResult = fireEvent.click(link)
    expect(clickResult).toBe(false)
    expect(onClick).not.toHaveBeenCalled()
  })
})
