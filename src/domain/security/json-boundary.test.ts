import { describe, expect, it } from "vitest"

import { jsonValueWithinBounds } from "./json-boundary"

describe("jsonValueWithinBounds", () => {
  it("accepts shallow JSON values", () => {
    expect(jsonValueWithinBounds({ ok: true, items: [1, "x"] }, 8)).toBe(true)
  })

  it("rejects dangerous object keys", () => {
    expect(jsonValueWithinBounds({ constructor: { polluted: true } }, 8)).toBe(false)
  })

  it("rejects payloads deeper than the limit", () => {
    let value: Record<string, unknown> = { leaf: 1 }
    for (let index = 0; index < 10; index += 1) {
      value = { nested: value }
    }
    expect(jsonValueWithinBounds(value, 8)).toBe(false)
  })
})
