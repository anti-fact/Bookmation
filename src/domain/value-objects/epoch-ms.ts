/**
 * EpochMs 値オブジェクト
 * UTC Epoch milliseconds: 有限整数・非負値のみ許可。
 */
import { DomainError, DomainErrorCode } from "../errors"

/** EpochMs が有効かを検証する */
export function validateEpochMs(value: unknown): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new DomainError(
      DomainErrorCode.INVALID_EPOCH_MS,
      `EpochMs must be a non-negative finite integer: ${String(value)}`,
    )
  }
}

/** EpochMs が有効かを真偽値で返す */
export function isValidEpochMs(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  )
}
