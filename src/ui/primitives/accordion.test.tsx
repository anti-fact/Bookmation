// Accordion の開閉、複数同時展開、見出しの階層を確認するテストです。
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it } from "vitest"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "./accordion"

function TwoItemAccordion() {
  return (
    <Accordion type="multiple">
      <AccordionItem value="lecture">
        <AccordionTrigger>授業・講義</AccordionTrigger>
        <AccordionContent>
          <p>授業ページ</p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="learning">
        <AccordionTrigger>学習</AccordionTrigger>
        <AccordionContent>
          <p>チュートリアル</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

describe("Accordion", () => {
  it("keeps content hidden until its trigger is used", async () => {
    const user = userEvent.setup()
    render(<TwoItemAccordion />)

    const trigger = screen.getByRole("button", { name: "授業・講義" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("授業ページ")).toBeNull()

    await user.click(trigger)

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("授業ページ")).not.toBeNull()
  })

  it("allows several items to stay open at the same time", async () => {
    const user = userEvent.setup()
    render(<TwoItemAccordion />)

    await user.click(screen.getByRole("button", { name: "授業・講義" }))
    await user.click(screen.getByRole("button", { name: "学習" }))

    expect(screen.getByText("授業ページ")).not.toBeNull()
    expect(screen.getByText("チュートリアル")).not.toBeNull()
  })

  it("wraps each trigger in a heading so screen readers can list the sections", () => {
    render(<TwoItemAccordion />)

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)
    ).toEqual(["授業・講義", "学習"])
  })
})
