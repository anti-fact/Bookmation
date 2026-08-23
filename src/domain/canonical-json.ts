/**
 * canonical JSON v1（AI_GUIDE）— Domain / evaluation / Prompt API 共有
 */
import type { JsonValue } from "./types"
import { isJsonValue } from "./value-objects"
import { DomainError, DomainErrorCode } from "./errors"

export function assertJsonValue(value: unknown): asserts value is JsonValue {
  if (!isJsonValue(value)) {
    throw new DomainError(
      DomainErrorCode.INVALID_JSON_VALUE,
      "canonical JSON v1 requires a validated JsonValue",
    )
  }
}

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

export function canonicalizeUnknown(value: unknown): string {
  assertJsonValue(value)
  return canonicalizeJsonValue(value)
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength
}
