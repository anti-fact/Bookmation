// TypeScript 側のデザイントークンが Figma 由来の基準値と層順を保つか確認します。
import { describe, expect, it } from "vitest"

import { designTokens } from "./tokens"

describe("designTokens", () => {
  it("matches the semantic palette extracted from the current Figma sheets", () => {
    expect(designTokens.color.paper).toBe("#FFFFFF")
    expect(designTokens.color.ink).toBe("#1E1E1E")
    expect(designTokens.color.accent).toBe("#B9D4EA")
    expect(designTokens.color.panel).toBe("#161616")
    expect(designTokens.color.onPanel).toBe("#EAEAEA")
    expect(designTokens.color.placeholder).toBe("rgb(122 122 122 / 60%)")
    expect(designTokens.color.mutedText).toBe("#505050")
    expect(designTokens.color.danger).toBe("#C33232")
    expect(designTokens.color.error).toBe("#FF383C")
  })

  it("keeps observed control geometry as CSS-friendly numbers", () => {
    // 単位なしの数値なら、利用側で px など必要な単位へ変換できます。
    expect(designTokens.radius.dialog).toBe(14)
    expect(designTokens.radius.pill).toBe(24)
    expect(designTokens.layout.controlHeight).toBe(48)
    expect(designTokens.layout.sliderWidth).toBe(140)
    expect(designTokens.layout.popoverZIndex).toBeGreaterThan(
      designTokens.layout.dialogZIndex
    )
    expect(designTokens.layout.toastZIndex).toBeGreaterThan(
      designTokens.layout.popoverZIndex
    )
  })
})
