/**
 * @generated このファイルは scripts/generate-unicode-data.mjs によって自動生成されます。
 * 手動で編集しないでください。
 * Unicode version: 15.1.0 / ICU: 78.3
 * 再生成: node scripts/generate-unicode-data.mjs
 */
/* eslint-disable */
// @ts-nocheck

// General Category: Cs (Surrogate)

/**
 * GC_SURROGATE: [startCodepoint, length] のランレングス圧縮ペア配列
 * containsCodepoint(cp) で判定してください
 */
export const GC_SURROGATE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0xD800, 2048],
] as const

/** コードポイントが GC_SURROGATE に含まれるか判定する */
export function gc_surrogateContains(cp: number): boolean {
  let lo = 0
  let hi = GC_SURROGATE_RANGES.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const [start, len] = GC_SURROGATE_RANGES[mid]!
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


// General Category: Cc (Control)

/**
 * GC_CONTROL: [startCodepoint, length] のランレングス圧縮ペア配列
 * containsCodepoint(cp) で判定してください
 */
export const GC_CONTROL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0, 32],
  [0x7F, 33],
] as const

/** コードポイントが GC_CONTROL に含まれるか判定する */
export function gc_controlContains(cp: number): boolean {
  let lo = 0
  let hi = GC_CONTROL_RANGES.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const [start, len] = GC_CONTROL_RANGES[mid]!
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

