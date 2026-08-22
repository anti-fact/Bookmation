import { BUNDLED_FALLBACK_LOGO_PATH } from "~/domain/security"

declare const chrome: { runtime?: { getURL(path: string): string } } | undefined

/** 一覧・popup で使う同梱ロゴ URL。外部 https を返さない。 */
export function getBundledFallbackLogoUrl(): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(BUNDLED_FALLBACK_LOGO_PATH)
  }

  return new URL("../../../assets/icon.png", import.meta.url).href
}
