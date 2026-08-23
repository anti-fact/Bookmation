/**
 * canonical JSON v1（AI_GUIDE）
 * 事前検証済み JsonValue のみ。Object.keys().sort() の UTF-16 昇順。
 */
import { isJsonValue, type JsonValue } from "~/domain"

export function assertJsonValue(value: unknown): asserts value is JsonValue {
  if (!isJsonValue(value)) {
    throw new Error("canonical JSON v1 requires a validated JsonValue")
  }
}

/** JsonValue を canonical JSON v1 文字列へ直列化する */
export function canonicalizeJsonValue(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJsonValue(item)).join(",")}]`
  }
  const keys = Object.keys(value).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJsonValue(value[key]!)}`)
    .join(",")}}`
}

/** unknown を JsonValue 検証してから canonicalize */
export function canonicalizeUnknown(value: unknown): string {
  assertJsonValue(value)
  return canonicalizeJsonValue(value)
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength
}
