/**
 * @generated このファイルは scripts/generate-unicode-data.mjs によって自動生成されます。
 * 手動で編集しないでください。
 * Unicode version: 15.1.0 / ICU: 78.3
 * 再生成: node scripts/generate-unicode-data.mjs
 */
/* eslint-disable */
// @ts-nocheck

/**
 * WHITE_SPACE: [startCodepoint, length] のランレングス圧縮ペア配列
 * containsCodepoint(cp) で判定してください
 */
export const WHITE_SPACE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x9, 5],
  [0x20, 1],
  [0x85, 1],
  [0xA0, 1],
  [0x1680, 1],
  [0x2000, 11],
  [0x2028, 2],
  [0x202F, 1],
  [0x205F, 1],
  [0x3000, 1],
] as const

/** コードポイントが WHITE_SPACE に含まれるか判定する */
export function white_spaceContains(cp: number): boolean {
  let lo = 0
  let hi = WHITE_SPACE_RANGES.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const [start, len] = WHITE_SPACE_RANGES[mid]!
    if (cp < start) {
      hi = mid - 1
    } else if (cp >= start + len) {
      lo = mid + 1
    } else {
      return true
    }
  }
  return false
}
