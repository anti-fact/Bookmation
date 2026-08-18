import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { Slider } from "./slider"

function ControlledSlider() {
  const [value, setValue] = React.useState(2)

  return (
    <Slider
      formatValue={(currentValue) => `細分化度${currentValue}`}
      label="AIタグの細分化"
      max={4}
      min={0}
      onValueChange={setValue}
      step={1}
      value={value}
    />
  )
}

describe("Slider", () => {
  it("exposes its range and changes by keyboard without exceeding bounds", async () => {
    const user = userEvent.setup()
    render(<ControlledSlider />)

    const slider = screen.getByRole("slider", { name: "AIタグの細分化" })
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("4")
    expect(slider.getAttribute("aria-valuenow")).toBe("2")
    expect(slider.getAttribute("aria-valuetext")).toBe("細分化度2")

    slider.focus()
    await user.keyboard("{ArrowRight}{End}{ArrowRight}")

    expect(slider.getAttribute("aria-valuenow")).toBe("4")
    expect(slider.getAttribute("aria-valuetext")).toBe("細分化度4")
  })

  it("does not change while disabled", async () => {
    const user = userEvent.setup()
    render(
      <Slider defaultValue={2} disabled label="無効な細分化" max={4} min={0} />
    )

    const slider = screen.getByRole("slider", { name: "無効な細分化" })
    slider.focus()
    await user.keyboard("{ArrowRight}")
    expect(slider.getAttribute("aria-valuenow")).toBe("2")
  })
})
