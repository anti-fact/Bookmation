import { render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { AppShellFixture } from "./AppShellFixture"

describe("AppShellFixture", () => {
  it("renders the production UI-02 app through injected Web runtime services", () => {
    window.history.replaceState(null, "", "/?view=app-shell#/home")

    render(<AppShellFixture />)

    expect(screen.getByText(/Test preview \/ UI-02/i)).not.toBeNull()
    expect(
      screen.getByRole("heading", { name: "最近追加したブックマーク" })
    ).not.toBeNull()
    expect(
      screen.getByRole("banner", { name: "アプリケーションヘッダー" })
    ).not.toBeNull()
    expect(
      screen.getByRole("navigation", { name: "App Shell fixture切替" })
    ).not.toBeNull()
  })
})
