import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { Button } from "./button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from "./dialog"

function TestDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>編集を開く</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>ブックマークを編集</DialogTitle>
        <DialogDescription>共通Dialogの動作確認です。</DialogDescription>
        <DialogClose asChild>
          <Button>キャンセル</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

describe("Dialog", () => {
  it("opens accessibly, closes with Escape, and restores trigger focus", async () => {
    const user = userEvent.setup()
    render(<TestDialog />)

    const trigger = screen.getByRole("button", { name: "編集を開く" })
    await user.click(trigger)

    expect(
      screen.getByRole("dialog", { name: "ブックマークを編集" })
    ).not.toBeNull()
    expect(screen.getByText("共通Dialogの動作確認です。")).not.toBeNull()
    expect(document.activeElement).not.toBe(trigger)

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(document.activeElement).toBe(trigger)
    })
  })

  it("closes from the visible close control", async () => {
    const user = userEvent.setup()
    render(<TestDialog />)

    await user.click(screen.getByRole("button", { name: "編集を開く" }))
    await user.click(screen.getByRole("button", { name: "閉じる" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("keeps forward and reverse Tab navigation inside the open dialog", async () => {
    const user = userEvent.setup()
    render(<TestDialog />)

    await user.click(screen.getByRole("button", { name: "編集を開く" }))
    const dialog = screen.getByRole("dialog", { name: "ブックマークを編集" })
    const controls = within(dialog).getAllByRole("button")

    controls.at(-1)?.focus()
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)

    controls[0].focus()
    await user.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})
