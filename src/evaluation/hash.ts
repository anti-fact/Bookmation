/**
 * SHA-256 lowercase hex helpers for evaluation artifacts.
 */
import { canonicalizeUnknown } from "./canonical-json"

export async function sha256HexOfString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function sha256HexOfCanonicalJson(value: unknown): Promise<string> {
  return sha256HexOfString(canonicalizeUnknown(value))
}

const SHA256_HEX = /^[0-9a-f]{64}$/

export function isSha256LowerHex(value: string): boolean {
  return SHA256_HEX.test(value)
}
