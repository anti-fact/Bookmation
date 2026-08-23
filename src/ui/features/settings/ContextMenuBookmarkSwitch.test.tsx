import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import type { GeneralSettingsPort, GeneralSettingsSnapshot } from "./general-settings-port"
import { ContextMenuBookmarkSwitch } from "./ContextMenuBookmarkSwitch"

const defaultSnapshot: GeneralSettingsSnapshot = {
  contextMenuBookmarkEnabled: true,
  frequentVisitReminderEnabled: false,
  frequentVisitWindow: null,
  frequentVisitDayThreshold: null,
}

function createPort(
  overrides: Partial<GeneralSettingsPort> = {}
): GeneralSettingsPort {
  return {
    getSnapshot: vi.fn().mockResolvedValue(defaultSnapshot),
    setContextMenuBookmarkEnabled: vi
      .fn()
      .mockResolvedValue({ ...defaultSnapshot, contextMenuBookmarkEnabled: false }),
    updateReminderSettings: vi.fn().mockResolvedValue(defaultSnapshot),
    ...overrides
  }
}

describe("ContextMenuBookmarkSwitch", () => {
  it("loads the snapshot and shows the effective enabled state", async () => {
    const port = createPort({
      getSnapshot: vi
        .fn()
        .mockResolvedValue({ ...defaultSnapshot, contextMenuBookmarkEnabled: true })
    })
    render(<ContextMenuBookmarkSwitch port={port} />)

    const control = await screen.findByRole("switch", {
      name: "右クリックメニューから保存"
    })
    expect(control.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText(/状態: 有効/)).not.toBeNull()
  })

  it("updates only after a successful toggle and announces the result", async () => {
    const user = userEvent.setup()
    const setEnabled = vi
      .fn()
      .mockResolvedValue({ ...defaultSnapshot, contextMenuBookmarkEnabled: false })
    const port = createPort({
      getSnapshot: vi
        .fn()
        .mockResolvedValue({ ...defaultSnapshot, contextMenuBookmarkEnabled: true }),
      setContextMenuBookmarkEnabled: setEnabled
    })
    render(<ContextMenuBookmarkSwitch port={port} />)

    const control = await screen.findByRole("switch", {
      name: "右クリックメニューから保存"
    })
    await user.click(control)

    await waitFor(() => {
      expect(setEnabled).toHaveBeenCalledWith(false)
    })
    expect(control.getAttribute("aria-checked")).toBe("false")
    expect(screen.getByText(/状態: 無効/)).not.toBeNull()
    expect(screen.getByRole("status").textContent).toContain(
      "無効にしました"
    )
  })

  it("keeps the previous value and shows an error when save fails", async () => {
    const user = userEvent.setup()
    const port = createPort({
      getSnapshot: vi
        .fn()
        .mockResolvedValue({ ...defaultSnapshot, contextMenuBookmarkEnabled: true }),
      setContextMenuBookmarkEnabled: vi
        .fn()
        .mockRejectedValue(new Error("設定の保存に失敗しました。もう一度お試しください。"))
    })
    render(<ContextMenuBookmarkSwitch port={port} />)

    const control = await screen.findByRole("switch", {
      name: "右クリックメニューから保存"
    })
    await user.click(control)

    await waitFor(() => {
      expect(screen.getByRole("alert")).not.toBeNull()
    })
    expect(control.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText(/状態: 有効/)).not.toBeNull()
  })
})
