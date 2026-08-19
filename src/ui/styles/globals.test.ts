// 動きを減らす設定でも、内容を消さずアニメーションだけを短縮することを確認します。
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("global motion preference", () => {
  it("keeps content present while reducing animation and transition duration", () => {
    // CSS を文字列として検査し、ブラウザー環境に依存せず安全規則を固定します。
    const css = readFileSync(
      resolve(process.cwd(), "src/ui/styles/globals.css"),
      "utf8"
    )

    expect(css).toContain("@media (prefers-reduced-motion: reduce)")
    expect(css).toContain("animation-duration: 0.01ms !important")
    expect(css).toContain("transition-duration: 0.01ms !important")
    expect(css).not.toMatch(/display:\s*none/)
    expect(css).not.toMatch(/visibility:\s*hidden/)
  })
})
