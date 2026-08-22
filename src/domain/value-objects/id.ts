/**
 * ID 値オブジェクト
 * UUID v4 形式の非空文字列を期待する。
 */
import { DomainError, DomainErrorCode } from "../errors"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 文字列が有効な ID かを検証する。
 * 現実装では UUID v4 形式を要求する。
 */
export function validateId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DomainError(DomainErrorCode.INVALID_ID, `Invalid ID: ${String(value)}`)
  }
  if (!UUID_RE.test(value)) {
    throw new DomainError(DomainErrorCode.INVALID_ID, `ID must be UUID format: ${value}`)
  }
}

/** 文字列が有効な ID かを真偽値で返す */
export function isValidId(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false
  return UUID_RE.test(value)
}
