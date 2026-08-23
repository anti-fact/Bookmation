import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GeminiNanoSettings } from "./GeminiNanoSettings"

describe("GeminiNanoSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows that Gemini Nano is unavailable when Prompt API is missing", async () => {
    render(<GeminiNanoSettings />)

    expect(
      await screen.findByText("この環境ではGemini Nanoを利用できません。")
    ).not.toBeNull()
    expect(
      screen.queryByRole("button", { name: "モデルをダウンロード" })
    ).toBeNull()
  })

  it("downloads the model from an explicit user action and reports progress", async () => {
    const user = userEvent.setup()
    let reportProgress:
      | ((event: Event & { loaded?: number }) => void)
      | undefined
    let finishDownload: ((session: { destroy: () => void }) => void) | undefined
    const destroy = vi.fn()
    const availability = vi.fn(async () => "downloadable" as const)
    const create = vi.fn(
      (options: {
        monitor?: (monitor: {
          addEventListener: (
            type: "downloadprogress",
            listener: (event: Event & { loaded?: number }) => void
          ) => void
        }) => void
      }) =>
        new Promise<{ destroy: () => void }>((resolve) => {
          finishDownload = resolve
          options.monitor?.({
            addEventListener: (_type, listener) => {
              reportProgress = listener
            }
          })
        })
    )
    vi.stubGlobal("LanguageModel", { availability, create })

    render(<GeminiNanoSettings />)

    await user.click(
      await screen.findByRole("button", { name: "モデルをダウンロード" })
    )
    expect(create).toHaveBeenCalledTimes(1)

    act(() => {
      reportProgress?.({ loaded: 0.42 } as Event & { loaded: number })
    })
    expect(screen.getByText("42%")).not.toBeNull()
    expect(
      screen.getByRole("progressbar", { name: "ダウンロード進捗" })
    ).not.toBeNull()

    act(() => {
      finishDownload?.({ destroy })
    })
    await waitFor(() =>
      expect(
        screen.getByText("準備済みです。AI仕分けを利用できます。")
      ).not.toBeNull()
    )
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
