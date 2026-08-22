import { describe, expect, it } from "vitest"

import { readImageDimensions, validateImageBytes } from "./validated-image-blob"

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

describe("validateImageBytes", () => {
  it("accepts a small PNG and returns dimensions and hash", async () => {
    const buffer = decodeBase64(MINIMAL_PNG_BASE64)
    const validated = await validateImageBytes(buffer, "image/png", 512_000)

    expect(validated).not.toBeNull()
    expect(validated?.width).toBe(1)
    expect(validated?.height).toBe(1)
    expect(validated?.contentHash).toHaveLength(64)
  })

  it("rejects unsupported MIME types", async () => {
    const buffer = decodeBase64(MINIMAL_PNG_BASE64)
    expect(await validateImageBytes(buffer, "text/plain", 512_000)).toBeNull()
  })

  it("rejects oversized buffers", async () => {
    const buffer = decodeBase64(MINIMAL_PNG_BASE64)
    expect(await validateImageBytes(buffer, "image/png", 8)).toBeNull()
  })
})

describe("readImageDimensions", () => {
  it("reads PNG IHDR dimensions", () => {
    const bytes = new Uint8Array(decodeBase64(MINIMAL_PNG_BASE64))
    expect(readImageDimensions(bytes, "image/png")).toEqual({ width: 1, height: 1 })
  })
})
