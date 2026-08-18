import { render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { ComponentSheet } from "./ComponentSheet"

describe("ComponentSheet", () => {
  it("renders the UI-01 production primitives in the Web preview", () => {
    render(<ComponentSheet />)

    expect(screen.getByText(/Test preview/i)).not.toBeNull()
    expect(
      screen.getByRole("heading", { name: "Bookmation component-sheet" })
    ).not.toBeNull()

    for (const heading of ["Button", "Dialog", "Switch", "Slider", "Select"]) {
      expect(screen.getByRole("heading", { name: heading })).not.toBeNull()
    }

    expect(
      screen.getByRole("button", { name: "編集Dialogを開く" })
    ).not.toBeNull()
    expect(
      screen.getByRole("switch", { name: "右クリックメニューから保存" })
    ).not.toBeNull()
    expect(
      screen.getByRole("slider", { name: "AIタグの細分化" })
    ).not.toBeNull()
    expect(
      screen.getByRole("combobox", { name: "訪問の集計期間" })
    ).not.toBeNull()
  })
})
