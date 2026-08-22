/**
 * Cursor 値オブジェクト
 *
 * IndexedDB の無限スクロール用カーソル値。
 * JSON round-trip 可能な文字列・有限整数・またはそれらの配列のみ許可。
 * Date・ArrayBuffer・NaN・Infinity・undefined・入れ子配列は保存しない。
 */
import { DomainError, DomainErrorCode } from "../errors"

/** カーソルとして有効な単一値の型 */
export type CursorScalar = string | number

/** カーソル値の型 — スカラーまたは深さ1のスカラー配列 */
export type CursorValue = CursorScalar | CursorScalar[]

/**
 * カーソル値が有効かを検証する。
 * - string / 有限整数 → OK
 * - 深さ1の (string | 有限整数)[] → OK
 * - それ以外 → INVALID_CURSOR
 */
export function validateCursorValue(value: unknown): asserts value is CursorValue {
  if (isValidCursorScalar(value)) return

  if (Array.isArray(value)) {
    for (const item of value as unknown[]) {
      if (!isValidCursorScalar(item)) {
        throw new DomainError(
          DomainErrorCode.INVALID_CURSOR,
          `Cursor array element must be a string or finite integer: ${String(item)}`,
        )
      }
    }
    return
  }

  throw new DomainError(
    DomainErrorCode.INVALID_CURSOR,
    `Cursor must be a string, finite integer, or array thereof: ${String(value)}`,
  )
}

function isValidCursorScalar(value: unknown): value is CursorScalar {
  if (typeof value === "string") return true
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isInteger(value)
  }
  return false
}

/** カーソル値が有効かを真偽値で返す */
export function isValidCursorValue(value: unknown): value is CursorValue {
  try {
    validateCursorValue(value)
    return true
  } catch {
    return false
  }
}
