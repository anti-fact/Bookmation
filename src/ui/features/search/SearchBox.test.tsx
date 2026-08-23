import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { SearchBox } from "./SearchBox"
import type { SearchPort, SearchSuggestion } from "./search-port"

const suggestion = (id: string): SearchSuggestion => ({
  displayText: `候補${id}`,
  entityId: id,
  entityRevision: 1,
  entityType: "LABEL",
  labelKind: "TAG",
  parentCategoryId: "category"
})

describe("SearchBox", () => {
  it("caps suggestions at eight and selects by keyboard while focus stays in the input", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const port: SearchPort = {
      search: vi.fn(),
      suggest: vi.fn(async () =>
        Array.from({ length: 9 }, (_, index) => suggestion(String(index)))
      )
    }
    render(<SearchBox onSelect={onSelect} onSubmit={vi.fn()} port={port} />)
    const input = screen.getByRole("combobox")
    await user.type(input, "候補")
    expect(await screen.findAllByRole("option")).toHaveLength(8)
    await user.keyboard("{ArrowDown}{Enter}")
    expect(onSelect).toHaveBeenCalledWith(suggestion("0"))
    expect(document.activeElement).toBe(input)
  })

  it("groups labels above bookmarks while preserving each group order", async () => {
    const bookmark: SearchSuggestion = {
      ...suggestion("bookmark"),
      entityType: "BOOKMARK",
      labelKind: null,
      parentCategoryId: null
    }
    const port: SearchPort = {
      search: vi.fn(),
      suggest: vi.fn(async () => [bookmark, suggestion("label")])
    }
    render(<SearchBox onSelect={vi.fn()} onSubmit={vi.fn()} port={port} />)
    await userEvent.type(screen.getByRole("combobox"), "候補")

    expect(
      (await screen.findAllByRole("option")).map((item) => item.textContent)
    ).toEqual(["候補labelタグ", "候補bookmarkブックマーク"])
  })

  it("does not query during IME composition and submits after composition", async () => {
    const onSubmit = vi.fn()
    const port: SearchPort = { search: vi.fn(), suggest: vi.fn(async () => []) }
    render(<SearchBox onSelect={vi.fn()} onSubmit={onSubmit} port={port} />)
    const input = screen.getByRole("combobox")
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: "日本" } })
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    expect(port.suggest).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input, { data: "日本" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSubmit).toHaveBeenCalledWith("日本")
    await waitFor(() => expect(port.suggest).toHaveBeenCalledWith("日本"))
  })

  it("restores the input when browser history changes the route query", () => {
    const port: SearchPort = { search: vi.fn(), suggest: vi.fn(async () => []) }
    const { rerender } = render(
      <SearchBox
        initialQuery="first"
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        port={port}
      />
    )
    rerender(
      <SearchBox
        initialQuery="previous"
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        port={port}
      />
    )
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe(
      "previous"
    )
  })

  it("discards a stale response", async () => {
    const resolvers: Array<(items: SearchSuggestion[]) => void> = []
    const port: SearchPort = {
      search: vi.fn(),
      suggest: vi.fn(
        () =>
          new Promise<SearchSuggestion[]>((resolve) => resolvers.push(resolve))
      )
    }
    render(<SearchBox onSelect={vi.fn()} onSubmit={vi.fn()} port={port} />)
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "old" } })
    await waitFor(() => expect(port.suggest).toHaveBeenCalledTimes(1))
    fireEvent.change(input, { target: { value: "new" } })
    await waitFor(() => expect(port.suggest).toHaveBeenCalledTimes(2))
    resolvers[1]?.([suggestion("new")])
    await screen.findByText("候補new")
    resolvers[0]?.([suggestion("old")])
    await waitFor(() => expect(screen.queryByText("候補old")).toBeNull())
  })
})
