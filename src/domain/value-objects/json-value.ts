/**
 * JsonValue 値オブジェクト
 *
 * JSON として安全にシリアライズできる値のみ許可。
 * 以下を拒否する:
 *   - undefined
 *   - Function
 *   - BigInt
 *   - Symbol
 *   - 非有限数 (NaN, Infinity, -Infinity)
 *   - 循環参照
 */
import { DomainError, DomainErrorCode } from "../errors"
import type { JsonValue } from "../types"

/**
 * 値が JsonValue として安全かを検証する。
 * 循環参照を検出するため visited Set を使う。
 */
export function validateJsonValue(
  value: unknown,
  visited: Set<object> = new Set(),
): asserts value is JsonValue {
  if (value === null) return
  if (value === undefined) {
    throw new DomainError(DomainErrorCode.INVALID_JSON_VALUE, "undefined is not a valid JSON value")
  }

  const type = typeof value
  if (type === "boolean" || type === "string") return

  if (type === "number") {
    if (!Number.isFinite(value as number)) {
      throw new DomainError(
        DomainErrorCode.INVALID_JSON_VALUE,
        `Non-finite number is not a valid JSON value: ${String(value)}`,
      )
    }
    return
  }

  if (type === "bigint" || type === "symbol" || type === "function") {
    throw new DomainError(
      DomainErrorCode.INVALID_JSON_VALUE,
      `${type} is not a valid JSON value`,
    )
  }

  if (typeof value === "object") {
    if (visited.has(value as object)) {
      throw new DomainError(
        DomainErrorCode.INVALID_JSON_VALUE,
        "Circular reference is not a valid JSON value",
      )
    }
    visited.add(value as object)

    if (Array.isArray(value)) {
      for (const item of value as unknown[]) {
        validateJsonValue(item, visited)
      }
    } else {
      for (const v of Object.values(value as Record<string, unknown>)) {
        validateJsonValue(v, visited)
      }
    }
    return
  }

  throw new DomainError(DomainErrorCode.INVALID_JSON_VALUE, `Unknown type: ${type}`)
}

/** 値が JsonValue かを真偽値で返す */
export function isJsonValue(value: unknown): value is JsonValue {
  try {
    validateJsonValue(value)
    return true
  } catch {
    return false
  }
}
