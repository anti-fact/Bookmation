import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { expect, it, vi } from "vitest"
import { SearchResultsPage } from "./SearchResultsPage"
import type { SearchPort, SearchResult } from "./search-port"

it("renders labels above bookmarks and navigates from a label", async () => {
  const user = userEvent.setup()
  const onLabelSelect = vi.fn()
  const port: SearchPort = {
    suggest: vi.fn(),
    search: vi.fn(
      async (): Promise<SearchResult> => ({
        source: "LEXICAL_FALLBACK",
        labels: [
          {
            id: "tag",
            kind: "TAG",
            name: "TypeScript",
            parentCategoryId: "dev",
            revision: 1
          }
        ],
        bookmarks: [
          {
            id: "bookmark",
            normalizedUrl: "https://example.com/",
            revision: 1,
            title: "Example"
          }
        ]
      })
    )
  }
  render(
    <SearchResultsPage onLabelSelect={onLabelSelect} port={port} query="Type" />
  )
  const headings = await screen.findAllByRole("heading")
  expect(headings.map((heading) => heading.textContent)).toEqual([
    "カテゴリ・タグ",
    "ブックマーク"
  ])
  await user.click(screen.getByRole("button", { name: "#TypeScript" }))
  expect(onLabelSelect).toHaveBeenCalledWith({ id: "tag", kind: "tag" })
})

it("renders separate empty messages for labels and bookmarks", async () => {
  const port: SearchPort = {
    suggest: vi.fn(),
    search: vi.fn(
      async (): Promise<SearchResult> => ({
        bookmarks: [],
        labels: [],
        source: "LEXICAL_FALLBACK"
      })
    )
  }
  render(
    <SearchResultsPage onLabelSelect={vi.fn()} port={port} query="missing" />
  )

  expect(
    await screen.findByText("該当するカテゴリ・タグはありません")
  ).not.toBeNull()
  expect(screen.getByText("該当するブックマークはありません")).not.toBeNull()
})

it("announces a search failure", async () => {
  const port: SearchPort = {
    suggest: vi.fn(),
    search: vi.fn(async () => {
      throw new Error("offline")
    })
  }
  render(<SearchResultsPage onLabelSelect={vi.fn()} port={port} query="Type" />)

  expect(await screen.findByRole("alert")).not.toBeNull()
})
