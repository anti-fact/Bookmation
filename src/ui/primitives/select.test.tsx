// Select の選択結果、無効状態、キーボードでの開閉とフォーカス復帰を確認します。
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { Select } from "./select"

const options = [
  { label: "1週間", value: "LAST_7_DAYS" },
  { label: "1ヶ月", value: "LAST_30_DAYS" },
  { disabled: true, label: "未対応", value: "CUSTOM" }
]

function ControlledSelect({
  onChange = vi.fn()
}: {
  onChange?: (value: string) => void
}) {
  // 実際の設定画面と同じく、親コンポーネントが現在値を持つ使い方を再現します。
  const [value, setValue] = React.useState("")

  return (
    <Select
      label="訪問の集計期間"
      onValueChange={(nextValue) => {
        setValue(nextValue)
        onChange(nextValue)
      }}
      options={options}
      placeholder="期間を選択"
      value={value}
    />
  )
}

describe("Select", () => {
  it("opens accessibly and selects an enabled option", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledSelect onChange={onChange} />)

    const trigger = screen.getByRole("combobox", { name: "訪問の集計期間" })
    expect(trigger.textContent).toContain("期間を選択")

    await user.click(trigger)
    const option = await screen.findByRole("option", { name: "1ヶ月" })
    await user.click(option)

    expect(onChange).toHaveBeenLastCalledWith("LAST_30_DAYS")
    expect(trigger.textContent).toContain("1ヶ月")
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it("does not open when disabled", async () => {
    const user = userEvent.setup()
    render(
      <Select
        defaultValue="LAST_7_DAYS"
        disabled
        label="無効な期間"
        options={options}
      />
    )

    const trigger = screen.getByRole("combobox", { name: "無効な期間" })
    await user.click(trigger)
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("opens and closes by keyboard and restores trigger focus", async () => {
    // マウスなしでも開閉でき、閉じた後の操作位置が保たれることを確認します。
    const user = userEvent.setup()
    render(<ControlledSelect />)

    const trigger = screen.getByRole("combobox", { name: "訪問の集計期間" })
    trigger.focus()
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("listbox")).not.toBeNull()

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).toBeNull()
      expect(document.activeElement).toBe(trigger)
    })
  })
})
