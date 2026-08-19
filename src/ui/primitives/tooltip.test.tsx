// Tooltip がキーボードとポインターのどちらでも表示されることを確認します。
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it } from "vitest"

import { Tooltip } from "./tooltip"

describe("Tooltip", () => {
  it("shows its content when the trigger receives keyboard focus", async () => {
    render(
      <Tooltip content="設定を開く" delayDuration={0}>
        <button type="button">設定</button>
      </Tooltip>
    )

    screen.getByRole("button", { name: "設定" }).focus()

    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "設定を開く"
    )
  })

  it("shows its content for pointer interaction", async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="検索を開く" delayDuration={0}>
        <button type="button">検索</button>
      </Tooltip>
    )

    const trigger = screen.getByRole("button", { name: "検索" })
    await user.hover(trigger)
    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "検索を開く"
    )
  })
})
