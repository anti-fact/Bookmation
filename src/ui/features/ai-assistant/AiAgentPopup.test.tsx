import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { AiAgentPopup } from "./AiAgentPopup"
import type { AiAssistantPort, AiAssistantResponse } from "./ai-assistant-port"

describe("AiAgentPopup", () => {
  it("keeps search results in the panel with labels above bookmarks", async () => {
    const user = userEvent.setup()
    const onLabelSelect = vi.fn()
    const phases: string[] = []
    const port: AiAssistantPort = {
      ask: vi.fn(async (_input, options): Promise<AiAssistantResponse> => {
        options?.onProgress?.("streaming")
        phases.push("streaming")
        return {
          aiAvailable: true,
          answerText: "2件の候補が見つかりました。",
          candidates: [
            {
              entityType: "LABEL",
              id: "tag-react",
              kind: "TAG",
              name: "React",
              parentCategoryId: "category-development",
              revision: 1
            },
            {
              entityType: "BOOKMARK",
              id: "bookmark-react",
              normalizedUrl: "https://react.dev/",
              revision: 1,
              title: "React"
            }
          ],
          intent: "SEARCH_LIBRARY",
          query: "React"
        }
      })
    }
    render(
      <AiAgentPopup
        onLabelSelect={onLabelSelect}
        onSearch={vi.fn()}
        port={port}
      />
    )
    const trigger = screen.getByRole("button", {
      name: "AIアシスタントを開く"
    })
    expect(trigger.textContent).toBe("")
    expect(trigger.className).toContain("size-[3.125rem]")
    await user.click(trigger)
    const dialog = screen.getByRole("dialog", { name: "AIアシスタント" })
    await user.type(
      within(dialog).getByRole("textbox", { name: "質問または検索内容" }),
      "Reactの資料を探して"
    )
    await user.click(within(dialog).getByRole("button", { name: "送信" }))

    expect(
      await within(dialog).findByText("2件の候補が見つかりました。")
    ).not.toBeNull()
    expect(
      within(dialog)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["AIアシスタント", "カテゴリ・タグ", "ブックマーク"])
    expect(phases).toEqual(["streaming"])
    await user.click(within(dialog).getByRole("button", { name: "#React" }))
    expect(onLabelSelect).toHaveBeenCalledWith({ id: "tag-react", kind: "tag" })
  })

  it("distinguishes an unavailable AI fallback from an empty result", async () => {
    const user = userEvent.setup()
    const port: AiAssistantPort = {
      ask: vi.fn(
        async (): Promise<AiAssistantResponse> => ({
          aiAvailable: false,
          answerText: "候補は見つかりませんでした。",
          candidates: [],
          intent: "SEARCH_LIBRARY",
          query: "missing"
        })
      )
    }
    render(
      <AiAgentPopup onLabelSelect={vi.fn()} onSearch={vi.fn()} port={port} />
    )
    await user.click(
      screen.getByRole("button", { name: "AIアシスタントを開く" })
    )
    await user.type(screen.getByRole("textbox"), "missing")
    await user.click(screen.getByRole("button", { name: "送信" }))

    expect(
      await screen.findByText("候補は見つかりませんでした。")
    ).not.toBeNull()
    expect(
      screen.getByText(
        "AIを利用できないため、字句検索または静的ヘルプで回答しています。"
      )
    ).not.toBeNull()
  })

  it("retries failures, resets the conversation, and restores trigger focus", async () => {
    const user = userEvent.setup()
    const ask = vi
      .fn<AiAssistantPort["ask"]>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        aiAvailable: false,
        answerText: "静的ヘルプです。",
        candidates: [],
        intent: "PRODUCT_HELP",
        query: null
      })
    render(
      <AiAgentPopup onLabelSelect={vi.fn()} onSearch={vi.fn()} port={{ ask }} />
    )
    const trigger = screen.getByRole("button", { name: "AIアシスタントを開く" })
    await user.click(trigger)
    await user.type(screen.getByRole("textbox"), "共有の使い方")
    await user.click(screen.getByRole("button", { name: "送信" }))
    await user.click(await screen.findByRole("button", { name: "再試行" }))
    expect(await screen.findByText("静的ヘルプです。")).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "リセット" }))
    expect(screen.queryByText("静的ヘルプです。")).toBeNull()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(document.activeElement).toBe(trigger)
  })
})
