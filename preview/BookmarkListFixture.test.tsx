import { render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { BookmarkListFixture } from "./BookmarkListFixture"

describe("BookmarkListFixture", () => {
  it("renders the production UI-04 page with a named fixture catalog", async () => {
    window.history.replaceState(
      null,
      "",
      "/?view=bookmarks&fixture=single#/home"
    )
    render(<BookmarkListFixture />)

    expect(
      await screen.findByText("Bookmation UI-04 サンプル 1")
    ).not.toBeNull()
    expect(screen.getByText("fixture: single")).not.toBeNull()
    expect(
      screen.getByRole("navigation", { name: "Bookmark list fixture切替" })
    ).not.toBeNull()
  })

  it("exposes the empty state without replacing production components", async () => {
    window.history.replaceState(
      null,
      "",
      "/?view=bookmarks&fixture=empty#/home"
    )
    render(<BookmarkListFixture />)

    expect(
      await screen.findByText("ブックマークはまだありません")
    ).not.toBeNull()
  })
})
