import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BookmarkAddForm } from "./BookmarkAddForm"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("BookmarkAddForm", () => {
  it("saves an explicitly entered URL through the dashboard message", async () => {
    const user = userEvent.setup()
    const sendMessage = vi.fn().mockResolvedValue({
      data: { duplicate: false, status: "saved" },
      ok: true,
      requestId: "bookmark-add-test"
    })
    vi.stubGlobal("chrome", {
      runtime: {
        lastError: undefined,
        sendMessage
      }
    })
    const onSaved = vi.fn()

    render(<BookmarkAddForm onSaved={onSaved} />)
    await user.type(
      screen.getByRole("textbox", { name: "URL" }),
      "https://example.com/article"
    )
    await user.type(
      screen.getByRole("textbox", { name: "タイトル（任意）" }),
      "記事タイトル"
    )
    await user.click(screen.getByRole("button", { name: "保存する" }))

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "save-bookmark-by-url",
        payload: {
          title: "記事タイトル",
          url: "https://example.com/article"
        },
        schemaVersion: 1,
        source: "dashboard"
      })
    )
    expect(onSaved).toHaveBeenCalledWith({ duplicate: false })
  })
})
