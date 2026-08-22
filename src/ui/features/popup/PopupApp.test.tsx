import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { EXTENSION_COMMANDS } from "~/extension/commands"

import { PopupApp } from "./PopupApp"
import type { PopupPort, PopupSaveResult } from "./popup-port"

function createPort(overrides: Partial<PopupPort> = {}): PopupPort {
  return {
    getShortcuts: vi.fn().mockResolvedValue({
      [EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME]: "Ctrl+Shift+H",
      [EXTENSION_COMMANDS.SAVE_CURRENT_PAGE]: "Ctrl+Shift+S"
    }),
    openHome: vi.fn().mockResolvedValue(undefined),
    openShortcutSettings: vi.fn().mockResolvedValue(undefined),
    saveCurrentPage: vi.fn().mockResolvedValue({ status: "saved" }),
    ...overrides
  }
}

function deferredSave() {
  let resolve!: (value: PopupSaveResult) => void
  const promise = new Promise<PopupSaveResult>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe("PopupApp", () => {
  it("loads both shortcuts without saving merely because the popup opened", async () => {
    const port = createPort()
    render(<PopupApp port={port} />)

    expect(port.saveCurrentPage).not.toHaveBeenCalled()
    const logo = screen.getByRole("img", { name: "Bookmation" })
    expect(logo.className).toContain("mx-auto")
    expect(logo.className).toContain("block")
    expect(
      screen.getByText("ポップアップを開いただけでは保存されません。")
    ).not.toBeNull()
    const saveShortcut = await screen.findByText("Ctrl+Shift+S")
    const homeShortcut = screen.getByText("Ctrl+Shift+H")
    expect(saveShortcut.className).toContain("self-end")
    expect(homeShortcut.className).toContain("self-end")
    expect(port.getShortcuts).toHaveBeenCalledTimes(1)

    const actions = screen.getAllByRole("button")
    expect(actions[0]?.textContent).toContain("このページをブックマーク")
    expect(actions[1]?.textContent).toContain("Bookmation ホームを開く")
    expect(actions[2]?.textContent).toContain("割り当てを変更")
  })

  it("keeps the popup state visible while saving and after success", async () => {
    const user = userEvent.setup()
    const pending = deferredSave()
    const port = createPort({
      saveCurrentPage: vi.fn(() => pending.promise)
    })
    render(<PopupApp port={port} />)

    const saveButton = screen.getByRole("button", {
      name: /このページをブックマーク/
    })
    await user.click(saveButton)

    expect(saveButton.getAttribute("aria-busy")).toBe("true")
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole("status").textContent).toContain(
      "このページを保存しています"
    )

    pending.resolve({ status: "saved" })
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "このページを保存しました。"
      )
    })
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)
  })

  it("distinguishes duplicate and failed saves", async () => {
    const duplicatePort = createPort({
      saveCurrentPage: vi.fn().mockResolvedValue({ status: "duplicate" })
    })
    const { unmount } = render(<PopupApp port={duplicatePort} />)

    fireEvent.click(
      screen.getByRole("button", { name: /このページをブックマーク/ })
    )
    expect(
      await screen.findByText("このページはすでに保存されています。")
    ).not.toBeNull()

    unmount()
    const failedPort = createPort({
      saveCurrentPage: vi.fn().mockRejectedValue(new Error("offline"))
    })
    render(<PopupApp port={failedPort} />)
    fireEvent.click(
      screen.getByRole("button", { name: /このページをブックマーク/ })
    )

    expect((await screen.findByRole("alert")).textContent).toContain(
      "このページを保存できませんでした"
    )
  })

  it("opens home and Chrome shortcut settings through the Port", async () => {
    const user = userEvent.setup()
    const port = createPort()
    render(<PopupApp port={port} />)

    await user.click(
      screen.getByRole("button", { name: /Bookmation ホームを開く/ })
    )
    await user.click(screen.getByRole("button", { name: "割り当てを変更" }))

    expect(port.openHome).toHaveBeenCalledTimes(1)
    expect(port.openShortcutSettings).toHaveBeenCalledTimes(1)
  })

  it("shows unassigned keys and shortcut lookup failure without hiding actions", async () => {
    const port = createPort({
      getShortcuts: vi.fn().mockRejectedValue(new Error("unavailable"))
    })
    render(<PopupApp port={port} />)

    expect((await screen.findByRole("alert")).textContent).toContain(
      "ショートカットを取得できませんでした"
    )
    expect(screen.getAllByText("未割り当て")).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: /このページをブックマーク/ })
    ).not.toBeNull()
    expect(
      screen.getByRole("button", { name: /Bookmation ホームを開く/ })
    ).not.toBeNull()
  })
})
