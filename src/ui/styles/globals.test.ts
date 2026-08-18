import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("global motion preference", () => {
  it("keeps content present while reducing animation and transition duration", () => {
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
