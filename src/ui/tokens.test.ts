import { describe, expect, it } from "vitest"

import { designTokens } from "./tokens"

describe("designTokens", () => {
  it("matches the design sheet palette extracted on 2026-08-16", () => {
    expect(designTokens.color.surface).toBe("#1E1E1E")
    expect(designTokens.color.ink).toBe("#EAEAEA")
    expect(designTokens.color.accent).toBe("#B9D4EA")
    expect(designTokens.color.danger).toBe("#C33232")
  })

  it("keeps card radius and min width as CSS-friendly numbers", () => {
    expect(designTokens.radius.card).toBe(14.5)
    expect(designTokens.layout.cardMinWidthRem).toBe(16)
  })
})
