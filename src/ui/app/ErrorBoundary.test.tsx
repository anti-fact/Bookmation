import { fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { AppErrorBoundary } from "./ErrorBoundary"

function BrokenView(): React.ReactNode {
  throw new Error("fixture failure")
}

describe("AppErrorBoundary", () => {
  it("keeps a recoverable page visible after a render failure", () => {
    const onReset = vi.fn()
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <AppErrorBoundary onReset={onReset}>
        <BrokenView />
      </AppErrorBoundary>
    )

    expect(
      screen.getByRole("heading", { name: "画面を表示できませんでした" })
    ).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }))
    expect(onReset).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })
})
