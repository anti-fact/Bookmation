import { act, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PopupFixture } from "./PopupFixture"

describe("PopupFixture", () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, "", "/")
  })

  it("renders assigned shortcuts with the production popup view", () => {
    window.history.replaceState(null, "", "/?view=popup&fixture=assigned")
    render(<PopupFixture />)

    expect(screen.getByText("fixture: assigned")).not.toBeNull()
    expect(screen.getByText("Ctrl+Shift+S")).not.toBeNull()
    expect(screen.getByText("Ctrl+Shift+H")).not.toBeNull()
  })

  it("moves the interactive error fixture through saving to failure", () => {
    vi.useFakeTimers()
    window.history.replaceState(null, "", "/?view=popup&fixture=error")
    render(<PopupFixture />)

    fireEvent.click(
      screen.getByRole("button", { name: /このページをブックマーク/ })
    )
    expect(screen.getByRole("status").textContent).toContain("保存しています")

    act(() => vi.advanceTimersByTime(350))
    expect(screen.getByRole("alert").textContent).toContain(
      "保存できませんでした"
    )
  })
})
