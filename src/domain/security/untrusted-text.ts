import { DomainError, DomainErrorCode } from "../errors"

/** Bookmark タイトルの最大 codepoint 数。 */
export const MAX_BOOKMARK_TITLE_LENGTH = 500

/** message payload JSON の最大ネスト深さ。 */
export const MAX_MESSAGE_JSON_DEPTH = 8

const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

/**
 * 未信頼の Bookmark タイトルを検証し、trim 済み文字列を返す。
 * 空文字は拒否する（呼び出し側で fallback を渡す）。
 */
export function validateBookmarkTitle(title: string): string {
  const trimmed = title.trim()
  if (trimmed.length === 0) {
    throw new DomainError(DomainErrorCode.BOOKMARK_TITLE_EMPTY, "Bookmark title is empty")
  }
  if ([...trimmed].length > MAX_BOOKMARK_TITLE_LENGTH) {
    throw new DomainError(
      DomainErrorCode.BOOKMARK_TITLE_TOO_LONG,
      `Bookmark title exceeds ${MAX_BOOKMARK_TITLE_LENGTH} codepoints`,
    )
  }
  if (FORBIDDEN_CONTROL.test(trimmed)) {
    throw new DomainError(
      DomainErrorCode.BOOKMARK_TITLE_REJECTED_CHARACTER,
      "Bookmark title contains forbidden control characters",
    )
  }
  return trimmed
}

/** 利用者入力または fallback から保存用タイトルを決定する。 */
export function resolveBookmarkTitle(inputTitle: string, fallback: string): string {
  const trimmed = inputTitle.trim()
  return validateBookmarkTitle(trimmed.length > 0 ? trimmed : fallback)
}
