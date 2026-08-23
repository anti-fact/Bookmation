import { describe, expect, it, vi } from "vitest"

import { createChromeSearchPort } from "./chrome-search-port"

function success(message: unknown, data: Record<string, unknown>) {
  const request = message as { requestId: string }
  return { data, ok: true, requestId: request.requestId }
}

describe("createChromeSearchPort", () => {
  it("maps suggestion and full-search responses through the dashboard message boundary", async () => {
    const sendMessage = vi.fn(async (message: unknown) => {
      const request = message as { payload: { mode: string } }
      if (request.payload.mode === "SUGGEST") {
        return success(message, {
          items: [
            {
              displayText: "TypeScript",
              entityId: "tag-typescript",
              entityRevision: 2,
              entityType: "LABEL",
              labelKind: "TAG",
              parentCategoryId: "category-development"
            }
          ]
        })
      }
      return success(message, {
        bookmarks: [
          {
            id: "bookmark-handbook",
            normalizedUrl: "https://www.typescriptlang.org/docs/handbook/",
            revision: 3,
            title: "TypeScript Handbook"
          }
        ],
        labels: [],
        source: "LEXICAL_FALLBACK"
      })
    })
    const port = createChromeSearchPort(sendMessage)

    await expect(port.suggest("Type")).resolves.toEqual([
      {
        displayText: "TypeScript",
        entityId: "tag-typescript",
        entityRevision: 2,
        entityType: "LABEL",
        labelKind: "TAG",
        parentCategoryId: "category-development"
      }
    ])
    await expect(port.search("Type")).resolves.toEqual({
      bookmarks: [
        {
          id: "bookmark-handbook",
          normalizedUrl: "https://www.typescriptlang.org/docs/handbook/",
          revision: 3,
          title: "TypeScript Handbook"
        }
      ],
      labels: [],
      source: "LEXICAL_FALLBACK"
    })
    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "search-library",
        payload: { keyword: "Type", mode: "SUGGEST" },
        schemaVersion: 1,
        source: "dashboard"
      })
    )
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "search-library",
        payload: { keyword: "Type", mode: "SEARCH" }
      })
    )
  })

  it("rejects a response with a mismatched request ID", async () => {
    const port = createChromeSearchPort(
      vi.fn(async () => ({ data: {}, ok: true, requestId: "stale" }))
    )

    await expect(port.search("Type")).rejects.toThrow("SEARCH_FAILED")
  })
})
