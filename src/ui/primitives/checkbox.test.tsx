// Checkbox のラベル操作、キーボード操作、中間状態、無効状態を確認するテストです。
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { Checkbox } from "./checkbox"

function ControlledCheckbox({
  onChange = vi.fn()
}: {
  onChange?: (value: boolean) => void
}) {
  const [checked, setChecked] = React.useState(false)

  return (
    <label htmlFor="tag-portal">
      <Checkbox
        checked={checked}
        id="tag-portal"
        onCheckedChange={(nextChecked) => {
          setChecked(nextChecked === true)
          onChange(nextChecked === true)
        }}
      />
      ポータル
    </label>
  )
}

describe("Checkbox", () => {
  it("toggles once from its label and once from the keyboard", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledCheckbox onChange={onChange} />)

    const control = screen.getByRole("checkbox", { name: "ポータル" })
    expect(control.getAttribute("aria-checked")).toBe("false")

    await user.click(screen.getByText("ポータル"))

    expect(control.getAttribute("aria-checked")).toBe("true")
    expect(onChange).toHaveBeenCalledTimes(1)

    control.focus()
    await user.keyboard(" ")

    expect(control.getAttribute("aria-checked")).toBe("false")
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("shows a mixed state for a partly selected group", () => {
    render(<Checkbox aria-label="すべてのタグ" checked="indeterminate" />)

    expect(
      screen
        .getByRole("checkbox", { name: "すべてのタグ" })
        .getAttribute("aria-checked")
    ).toBe("mixed")
  })

  it("stays quiet while disabled", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Checkbox
        aria-label="すべてのタグ"
        checked={false}
        disabled
        onCheckedChange={onChange}
      />
    )

    await user.click(screen.getByRole("checkbox", { name: "すべてのタグ" }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
