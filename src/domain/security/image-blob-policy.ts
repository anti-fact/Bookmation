/** 保存時 HTML fetch の上限（page-metadata と共有）。 */
export const MAX_HTML_FETCH_BYTES = 512_000

/** サムネイル（og:image）の最大バイト数。 */
export const MAX_THUMBNAIL_BYTES = 512_000

/** favicon の最大バイト数。 */
export const MAX_FAVICON_BYTES = 256_000

/** 画像の最大幅・高さ（px）。超過時は Blob 化しない。 */
export const MAX_IMAGE_WIDTH = 4_096
export const MAX_IMAGE_HEIGHT = 4_096

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

const ALLOWED_IMAGE_MIME = new Set<string>(ALLOWED_IMAGE_MIME_TYPES)

export function isAllowedImageMimeType(mimeType: string): mimeType is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME.has(mimeType)
}

/** 同梱ロゴ（Plasmo manifest 配下）。 */
export const BUNDLED_FALLBACK_LOGO_PATH = "assets/icon.png"
