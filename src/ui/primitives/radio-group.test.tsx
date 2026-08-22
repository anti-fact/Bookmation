import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { RadioGroup, RadioGroupItem } from "./radio-group"

describe("RadioGroup", () => {
  it("keeps one value selected and supports arrow-key changes", async () => {
    const onValueChange = vi.fn()

    function Harness() {
      const [value, setValue] = React.useState("GRID")
      return (
        <RadioGroup
          aria-label="表示形式"
          onValueChange={(nextValue) => {
            onValueChange(nextValue)
            setValue(nextValue)
          }}
          value={value}
        >
          <RadioGroupItem aria-label="グリッド表示" value="GRID" />
          <RadioGroupItem aria-label="リスト表示" value="LIST" />
        </RadioGroup>
      )
    }

    render(<Harness />)

    const grid = screen.getByRole("radio", { name: "グリッド表示" })
    const list = screen.getByRole("radio", { name: "リスト表示" })
    expect(grid.getAttribute("aria-checked")).toBe("true")

    grid.focus()
    fireEvent.keyDown(grid, { key: "ArrowRight" })

    await waitFor(() => {
      expect(list.getAttribute("aria-checked")).toBe("true")
    })
    expect(onValueChange).toHaveBeenCalledWith("LIST")
  })
})
