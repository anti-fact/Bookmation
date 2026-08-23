import { describe, expect, it, vi } from "vitest"

import { createBrowserAiAssistantPort } from "./browser-ai-assistant-port"

function success(message: unknown, data: Record<string, unknown>) {
  const request = message as { requestId: string }
  return { data, ok: true, requestId: request.requestId }
}

describe("createBrowserAiAssistantPort", () => {
  it("falls back to lexical search and keeps labels before bookmarks", async () => {
    const sendMessage = vi.fn(async (message: unknown) =>
      success(message, {
        bookmarks: [
          {
            id: "bookmark-react",
            normalizedUrl: "https://react.dev/",
            revision: 1,
            title: "React"
          }
        ],
        labels: [
          {
            id: "tag-react",
            kind: "TAG",
            name: "React",
            parentCategoryId: "category-development",
            revision: 1
          }
        ]
      })
    )
    const port = createBrowserAiAssistantPort({
      languageModel: {
        availability: vi.fn(async () => "unavailable" as const),
        create: vi.fn()
      },
      sendMessage
    })

    await expect(port.ask("Reactの資料を探して")).resolves.toMatchObject({
      aiAvailable: false,
      candidates: [
        { entityType: "LABEL", id: "tag-react" },
        { entityType: "BOOKMARK", id: "bookmark-react" }
      ],
      intent: "SEARCH_LIBRARY",
      query: "React"
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "search-library",
        payload: { keyword: "React", mode: "SEARCH" },
        source: "dashboard"
      })
    )
  })

  it("uses a grounded model response for product help without issuing mutations", async () => {
    const destroy = vi.fn()
    const prompt = vi.fn(async () =>
      JSON.stringify({
        answerText: "未実装: 共有機能は現在開発中です。",
        intent: "PRODUCT_HELP",
        query: ""
      })
    )
    const sendMessage = vi.fn()
    const port = createBrowserAiAssistantPort({
      languageModel: {
        availability: vi.fn(async () => "available" as const),
        create: vi.fn(async () => ({ destroy, prompt }))
      },
      sendMessage
    })

    await expect(port.ask("共有機能の使い方")).resolves.toEqual({
      aiAvailable: true,
      answerText:
        "未実装: QR、CSV、Google Driveによる共有とインポートは現在開発中です。",
      candidates: [],
      intent: "PRODUCT_HELP",
      query: null
    })
    expect(sendMessage).not.toHaveBeenCalled()
    expect(prompt).toHaveBeenCalledWith(
      expect.stringContaining("Capability Catalog v1"),
      expect.objectContaining({ responseConstraint: expect.any(Object) })
    )
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it("uses static help when the model output is invalid", async () => {
    const port = createBrowserAiAssistantPort({
      languageModel: {
        availability: vi.fn(async () => "available" as const),
        create: vi.fn(async () => ({
          destroy: vi.fn(),
          prompt: vi.fn(async () => "not-json")
        }))
      },
      sendMessage: vi.fn()
    })

    const response = await port.ask("アーカイブの使い方")
    expect(response.aiAvailable).toBe(false)
    expect(response.intent).toBe("PRODUCT_HELP")
    expect(response.answerText).toContain("未実装")
    expect(response.answerText).toContain("アーカイブ")
  })
})
