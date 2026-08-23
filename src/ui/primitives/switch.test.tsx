// Switch のラベル操作、キーボード操作、無効・保存待ち状態を確認するテストです。
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { Switch } from "./switch"

function ControlledSwitch({
  onChange = vi.fn()
}: {
  onChange?: (value: boolean) => void
}) {
  // 親が checked を持つ controlled な使い方をテスト用に再現します。
  const [checked, setChecked] = React.useState(false)

  return (
    <Switch
      checked={checked}
      label="右クリックメニューから保存"
      onCheckedChange={(nextChecked) => {
        setChecked(nextChecked)
        onChange(nextChecked)
      }}
    />
  )
}

describe("Switch", () => {
  it("toggles from its label and reports the real checked state", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledSwitch onChange={onChange} />)

    const control = screen.getByRole("switch", {
      name: "右クリックメニューから保存"
    })
    expect(control.getAttribute("aria-checked")).toBe("false")
    expect(control.className).toContain("h-6")
    expect(control.className).toContain("w-11")
    expect(control.firstElementChild?.className).toContain("size-5")
    expect(control.parentElement?.className).toContain("gap-3")
    expect(control.previousElementSibling?.textContent).toBe(
      "右クリックメニューから保存"
    )

    await user.click(screen.getByText("右クリックメニューから保存"))

    expect(control.getAttribute("aria-checked")).toBe("true")
    expect(onChange).toHaveBeenLastCalledWith(true)

    control.focus()
    await user.keyboard(" ")
    expect(control.getAttribute("aria-checked")).toBe("false")
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it("does not change while disabled or pending", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <Switch disabled label="無効な設定" onCheckedChange={onChange} />
    )

    await user.click(screen.getByRole("switch", { name: "無効な設定" }))
    expect(onChange).not.toHaveBeenCalled()

    rerender(<Switch label="保存処理中" onCheckedChange={onChange} pending />)
    await user.click(screen.getByRole("switch", { name: "保存処理中" }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
