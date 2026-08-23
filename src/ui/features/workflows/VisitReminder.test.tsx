import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { VisitReminder } from "./VisitReminder"

describe("VisitReminder", () => {
  it("suppresses only the candidate URL when no is selected with the checkbox", async () => {
    const user = userEvent.setup()
    const dismiss = vi.fn().mockResolvedValue(undefined)
    render(
      <VisitReminder
        port={{
          dismiss,
          loadCandidate: vi.fn().mockResolvedValue({
            id: "candidate-1",
            title: "React",
            url: "https://react.dev/",
            visitedDayCount: 5,
            windowLabel: "直近1週間"
          }),
          save: vi.fn()
        }}
      />
    )

    expect(
      await screen.findByRole("dialog", {
        name: "このページをブックマークしますか？"
      })
    ).not.toBeNull()
    await user.click(
      screen.getByRole("checkbox", { name: "次回から表示しない" })
    )
    await user.click(screen.getByRole("button", { name: "いいえ" }))

    await waitFor(() =>
      expect(dismiss).toHaveBeenCalledWith("candidate-1", true)
    )
    expect(
      screen.queryByRole("dialog", {
        name: "このページをブックマークしますか？"
      })
    ).toBeNull()
  })

  it("keeps the dialog open until bookmark saving succeeds", async () => {
    const user = userEvent.setup()
    render(
      <VisitReminder
        port={{
          dismiss: vi.fn(),
          loadCandidate: vi.fn().mockResolvedValue({
            id: "candidate-2",
            title: "TypeScript",
            url: "https://www.typescriptlang.org/",
            visitedDayCount: 10,
            windowLabel: "直近1ヶ月"
          }),
          save: vi.fn().mockRejectedValue(new Error("保存できませんでした。"))
        }}
      />
    )

    await user.click(
      await screen.findByRole("button", { name: "はい、保存する" })
    )
    expect((await screen.findByRole("alert")).textContent).toContain(
      "保存できません"
    )
    expect(
      screen.getByRole("dialog", { name: "このページをブックマークしますか？" })
    ).not.toBeNull()
  })
})
