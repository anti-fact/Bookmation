/**
 * Revision 値オブジェクト
 * 非負整数のみ許可。論理削除では +1 する。
 */
import { DomainError, DomainErrorCode } from "../errors"

/** revision が有効かを検証する */
export function validateRevision(value: unknown): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new DomainError(
      DomainErrorCode.INVALID_REVISION,
      `Revision must be a non-negative integer: ${String(value)}`,
    )
  }
}

/** revision が有効かを真偽値で返す */
export function isValidRevision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  )
}

/** 現在の revision から次の revision を返す */
export function nextRevision(current: number): number {
  validateRevision(current)
  return current + 1
}
