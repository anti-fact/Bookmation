/**
 * URL 値オブジェクト単体テスト
 */
import { describe, it, expect } from "vitest"
import { validateAndNormalizeUrl, isAllowedUrl } from "~/domain/value-objects/url"
import { DomainErrorCode } from "~/domain/errors"

describe("validateAndNormalizeUrl", () => {
  it("https URL → 正常に正規化", () => {
    const result = validateAndNormalizeUrl("https://example.com/path?q=1")
    expect(result.raw).toBe("https://example.com/path?q=1")
    expect(result.normalized).toContain("https://example.com")
    expect(result.normalizationVersion).toBe(1)
  })

  it("http URL → 許可", () => {
    expect(() => validateAndNormalizeUrl("http://example.com")).not.toThrow()
  })

  it("ftp URL → UNSAFE_URL_SCHEME", () => {
    expect(() => validateAndNormalizeUrl("ftp://example.com")).toThrow(
      DomainErrorCode.UNSAFE_URL_SCHEME,
    )
  })

  it("file URL → UNSAFE_URL_SCHEME", () => {
    expect(() => validateAndNormalizeUrl("file:///etc/hosts")).toThrow(
      DomainErrorCode.UNSAFE_URL_SCHEME,
    )
  })

  it("javascript スキーム → UNSAFE_URL_SCHEME", () => {
    expect(() => validateAndNormalizeUrl("javascript:alert(1)")).toThrow(
      DomainErrorCode.UNSAFE_URL_SCHEME,
    )
  })

  it("2048 文字を超える URL → URL_TOO_LONG", () => {
    const longUrl = "https://example.com/" + "a".repeat(2030)
    expect(() => validateAndNormalizeUrl(longUrl)).toThrow(DomainErrorCode.URL_TOO_LONG)
  })

  it("2048 文字ちょうど → OK (ギリギリ)", () => {
    const url = "https://example.com/" + "a".repeat(2028)
    expect(url.length).toBe(2048)
    expect(() => validateAndNormalizeUrl(url)).not.toThrow()
  })

  it("不正な URL → INVALID_URL", () => {
    expect(() => validateAndNormalizeUrl("not a url at all")).toThrow(
      DomainErrorCode.INVALID_URL,
    )
  })
})

describe("isAllowedUrl", () => {
  it("https → true", () => {
    expect(isAllowedUrl("https://example.com")).toBe(true)
  })

  it("http → true", () => {
    expect(isAllowedUrl("http://example.com")).toBe(true)
  })

  it("ftp → false", () => {
    expect(isAllowedUrl("ftp://example.com")).toBe(false)
  })

  it("不正 URL → false", () => {
    expect(isAllowedUrl("not a url")).toBe(false)
  })
})
