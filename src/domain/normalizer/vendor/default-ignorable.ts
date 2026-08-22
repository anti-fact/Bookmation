/**
 * @generated このファイルは scripts/generate-unicode-data.mjs によって自動生成されます。
 * 手動で編集しないでください。
 * Unicode version: 15.1.0 / ICU: 78.3
 * 再生成: node scripts/generate-unicode-data.mjs
 */
/* eslint-disable */
// @ts-nocheck

/**
 * DEFAULT_IGNORABLE: [startCodepoint, length] のランレングス圧縮ペア配列
 * containsCodepoint(cp) で判定してください
 */
export const DEFAULT_IGNORABLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0xAD, 1],
  [0x34F, 1],
  [0x61C, 1],
  [0x115F, 2],
  [0x17B4, 2],
  [0x180B, 5],
  [0x200B, 5],
  [0x202A, 5],
  [0x2060, 16],
  [0x3164, 1],
  [0xFE00, 16],
  [0xFEFF, 1],
  [0xFFA0, 1],
  [0xFFF0, 9],
  [0x1BCA0, 4],
  [0x1D173, 8],
  [0xE0000, 4096],
] as const

/** コードポイントが DEFAULT_IGNORABLE に含まれるか判定する */
export function default_ignorableContains(cp: number): boolean {
  let lo = 0
  let hi = DEFAULT_IGNORABLE_RANGES.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const [start, len] = DEFAULT_IGNORABLE_RANGES[mid]!
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
