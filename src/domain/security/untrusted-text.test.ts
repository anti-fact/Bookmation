import { describe, expect, it } from "vitest"

import { DomainError, DomainErrorCode } from "../errors"
import {
  MAX_BOOKMARK_TITLE_LENGTH,
  resolveBookmarkTitle,
  validateBookmarkTitle,
} from "./untrusted-text"

describe("validateBookmarkTitle", () => {
  it("accepts a normal title", () => {
    expect(validateBookmarkTitle("  Example  ")).toBe("Example")
  })

  it("rejects empty titles", () => {
    expect(() => validateBookmarkTitle("   ")).toThrow(DomainError)
    try {
      validateBookmarkTitle("")
    } catch (error) {
      expect(error).toMatchObject({ code: DomainErrorCode.BOOKMARK_TITLE_EMPTY })
    }
  })

  it("rejects titles that exceed the codepoint limit", () => {
    const longTitle = "a".repeat(MAX_BOOKMARK_TITLE_LENGTH + 1)
    expect(() => validateBookmarkTitle(longTitle)).toThrow(DomainError)
  })

  it("rejects control characters", () => {
    expect(() => validateBookmarkTitle("bad\u0000title")).toThrow(DomainError)
  })
})

describe("resolveBookmarkTitle", () => {
  it("uses fallback when input is blank", () => {
    expect(resolveBookmarkTitle("  ", "example.com")).toBe("example.com")
  })
})
