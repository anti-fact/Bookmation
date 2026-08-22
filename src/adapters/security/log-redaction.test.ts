import { describe, expect, it, vi } from "vitest"

import { DomainError, DomainErrorCode } from "~/domain"

import { redactSensitiveText, safeLogError } from "./log-redaction"

describe("redactSensitiveText", () => {
  it("redacts http and https URLs", () => {
    expect(
      redactSensitiveText("failed for https://secret.example/path and http://x.test"),
    ).toBe("failed for [redacted] and [redacted]")
  })
})

describe("safeLogError", () => {
  it("logs domain errors with safe messages only", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    safeLogError(
      "Save request rejected",
      new DomainError(DomainErrorCode.UNSAFE_URL_SCHEME),
    )

    expect(spy).toHaveBeenCalledWith(
      "[Bookmation] Save request rejected:",
      DomainErrorCode.UNSAFE_URL_SCHEME,
      "保存できるURLはhttpまたはhttpsのみです",
    )
    spy.mockRestore()
  })

  it("redacts URLs in generic error messages", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    safeLogError("Metadata fetch", new Error("fetch failed: https://example.com/icon.png"))

    expect(spy).toHaveBeenCalledWith(
      "[Bookmation] Metadata fetch:",
      "fetch failed: [redacted]",
    )
    spy.mockRestore()
  })
})
