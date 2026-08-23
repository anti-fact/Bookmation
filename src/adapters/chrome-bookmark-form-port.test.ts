import { describe, expect, it, vi } from "vitest"

import { BookmarkFormPortError } from "~/ui/features/bookmarks/bookmark-form-port"

import { createChromeBookmarkFormPort } from "./chrome-bookmark-form-port"

function success(message: unknown, data: Record<string, unknown>) {
  const request = message as { requestId: string }
  return { data, ok: true, requestId: request.requestId }
}

describe("ChromeBookmarkFormPort", () => {
  it("queries at most eight tag candidates with their parent category", async () => {
    const sendMessage = vi.fn(async (message: unknown) =>
      success(message, {
        items: [
          {
            id: "tag-reading",
            kind: "TAG",
            name: "reading",
            parentCategoryId: "category-books",
            parentCategoryName: "本",
            revision: 2,
            usageCount: 4
          }
        ]
      })
    )
    const port = createChromeBookmarkFormPort({ sendMessage })

    await expect(port.searchTags("read")).resolves.toEqual([
      {
        id: "tag-reading",
        name: "reading",
        parentCategoryId: "category-books",
        parentCategoryName: "本",
        revision: 2
      }
    ])
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "list-label-candidates",
        payload: { keyword: "read", kind: "TAG", limit: 8 },
        schemaVersion: 1,
        source: "dashboard"
      })
    )
  })

  it("keeps caller request IDs for idempotent create and save operations", async () => {
    const sendMessage = vi.fn(async (message: unknown) => {
      const request = message as {
        action: string
        requestId: string
      }
      if (request.action === "create-category") {
        return success(message, {
          categoryId: "category-new",
          name: "資料",
          revision: 1
        })
      }
      return success(message, { duplicate: false })
    })
    const port = createChromeBookmarkFormPort({ sendMessage })

    await port.createCategory({ name: "資料", requestId: "category-request" })
    await port.saveBookmark({
      requestId: "bookmark-request",
      tagIds: ["tag-one"],
      title: "",
      url: "https://example.com"
    })

    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "create-category",
        payload: { name: "資料" },
        requestId: "category-request"
      })
    )
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "save-bookmark-by-url",
        payload: {
          tagIds: ["tag-one"],
          url: "https://example.com"
        },
        requestId: "bookmark-request"
      })
    )
  })

  it("preserves safe domain error codes from the application boundary", async () => {
    const sendMessage = vi.fn(async (message: unknown) => {
      const request = message as { requestId: string }
      return {
        error: { code: "DUPLICATE_NORMALIZED_NAME" },
        ok: false,
        requestId: request.requestId
      }
    })
    const port = createChromeBookmarkFormPort({ sendMessage })

    const error = await port
      .createCategory({ name: "重複", requestId: "duplicate-request" })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(BookmarkFormPortError)
    expect((error as BookmarkFormPortError).code).toBe(
      "DUPLICATE_NORMALIZED_NAME"
    )
  })
})
