// 警告ダイアログの明示確認と、閉じた後のフォーカス復帰を確認します。
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { Button } from "./button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger
} from "./alert-dialog"

function TestAlertDialog({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>削除確認を開く</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>カテゴリを削除しますか？</AlertDialogTitle>
        <AlertDialogDescription>
          この操作は取り消せません。
        </AlertDialogDescription>
        <AlertDialogCancel asChild>
          <Button>キャンセル</Button>
        </AlertDialogCancel>
        <AlertDialogAction asChild>
          <Button onClick={onConfirm} tone="danger">
            削除する
          </Button>
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  )
}

describe("AlertDialog", () => {
  it("requires an explicit action and restores focus after cancellation", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<TestAlertDialog onConfirm={onConfirm} />)

    const trigger = screen.getByRole("button", { name: "削除確認を開く" })
    await user.click(trigger)

    expect(
      screen.getByRole("alertdialog", { name: "カテゴリを削除しますか？" })
    ).not.toBeNull()
    expect(screen.getByText("この操作は取り消せません。")).not.toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "キャンセル" }))

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
      expect(document.activeElement).toBe(trigger)
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("runs the destructive action only after confirmation", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<TestAlertDialog onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: "削除確認を開く" }))
    await user.click(screen.getByRole("button", { name: "削除する" }))

    expect(onConfirm).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  })
})
