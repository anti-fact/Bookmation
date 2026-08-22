/**
 * URL 値オブジェクト
 *
 * - P0 では http: / https: のみ許可 (CONSTRAINTS.md §76)
 * - 最大長 2048 文字
 * - URL() コンストラクタで構文検証後、正規化形式を返す
 */
import { DomainError, DomainErrorCode } from "../errors"

const ALLOWED_SCHEMES = new Set(["http:", "https:"])
const MAX_URL_LENGTH = 2048

export interface NormalizedUrl {
  /** 入力そのまま保存する元 URL */
  readonly raw: string
  /** URL() で正規化した形式 */
  readonly normalized: string
  /** 正規化バージョン番号 */
  readonly normalizationVersion: 1
}

/**
 * URL を検証し、正規化した結果を返す。
 * - 許可スキーム以外 → UNSAFE_URL_SCHEME
 * - 長さ超過 → URL_TOO_LONG
 * - 構文エラー → INVALID_URL
 */
export function validateAndNormalizeUrl(raw: string): NormalizedUrl {
  if (raw.length > MAX_URL_LENGTH) {
    throw new DomainError(DomainErrorCode.URL_TOO_LONG, `URL exceeds ${MAX_URL_LENGTH} chars`)
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new DomainError(DomainErrorCode.INVALID_URL, `Cannot parse URL: ${raw}`)
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new DomainError(
      DomainErrorCode.UNSAFE_URL_SCHEME,
      `URL scheme "${parsed.protocol}" is not allowed`,
    )
  }

  return {
    raw,
    normalized: parsed.href,
    normalizationVersion: 1,
  }
}

/** URL が許可スキームを持つか真偽値で返す */
export function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return ALLOWED_SCHEMES.has(parsed.protocol) && raw.length <= MAX_URL_LENGTH
  } catch {
    return false
  }
}
