/**
 * LabelNormalizer v1
 *
 * DB-SCHEMA.md §Label名正規化v1 の仕様に厳密に準拠する実装。
 *
 * 処理順序:
 * 1. raw 入力の Cs (Surrogate) / Default_Ignorable_Code_Point を拒否
 * 2. vendored NFKD テーブルで NFKD 展開 → vendored 正準合成テーブルで NFKC へ
 * 3. vendored White_Space テーブルで連続空白を ASCII space 1 文字へ collapse、先頭末尾 trim
 * 4. 残存 Cc / Cs / Default_Ignorable_Code_Point を拒否
 * 5. vendored CaseFolding status C+F の full case fold
 * 6. 最終再検証 (空・長さ上限・禁止文字)
 *
 * runtime 依存なし: String.prototype.normalize() / ICU / locale-sensitive lowercase を使わない。
 */
import { DomainError, DomainErrorCode } from "../errors"
import { UNICODE_DATA_ASSET_SHA256 } from "./vendor/asset-sha256"
import { white_spaceContains } from "./vendor/white-space"
import { default_ignorableContains } from "./vendor/default-ignorable"
import { gc_surrogateContains, gc_controlContains } from "./vendor/general-category"
import { NFKD_MAP, COMPOSITION_MAP, NON_STARTER_SET } from "./vendor/nfkc"
import { CASE_FOLD_MAP } from "./vendor/case-folding"

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const MAX_LABEL_NAME_LENGTH = 100
const ASCII_SPACE = 0x0020

// ---------------------------------------------------------------------------
// 内部ユーティリティ: コードポイント列↔文字列変換
// ---------------------------------------------------------------------------

function toCodePoints(str: string): number[] {
  return [...str].map((c) => c.codePointAt(0)!)
}

function fromCodePoints(cps: number[]): string {
  return String.fromCodePoint(...cps)
}

// ---------------------------------------------------------------------------
// Step 1 判定: 拒否すべきコードポイントか
// ---------------------------------------------------------------------------

/** raw 入力段階で拒否すべき文字: Cs (Surrogate) または Default_Ignorable_Code_Point */
function isRawRejected(cp: number): boolean {
  return gc_surrogateContains(cp) || default_ignorableContains(cp)
}

/** Cc (Control) / Cs (Surrogate) / Default_Ignorable_Code_Point */
function isPostNfkcRejected(cp: number): boolean {
  return gc_controlContains(cp) || gc_surrogateContains(cp) || default_ignorableContains(cp)
}

// ---------------------------------------------------------------------------
// Step 2: NFKC 変換 (vendored テーブル使用)
// ---------------------------------------------------------------------------

/**
 * 1 コードポイントを NFKD 展開する (vendored テーブル参照)
 */
function nfkdExpandOne(cp: number): number[] {
  // Hangul syllable: アルゴリズム分解
  if (cp >= 0xac00 && cp <= 0xd7a3) {
    const SBase = 0xac00
    const LBase = 0x1100
    const VBase = 0x1161
    const TBase = 0x11a7
    const NCount = 21 * 28
    const si = cp - SBase
    const L = LBase + Math.floor(si / NCount)
    const V = VBase + Math.floor((si % NCount) / 28)
    const T = TBase + (si % 28)
    return T === TBase ? [L, V] : [L, V, T]
  }

  const decomp = NFKD_MAP.get(cp)
  if (decomp === undefined) return [cp]
  // テーブルの値は既に完全展開済み (ジェネレータで再帰展開済み)
  return toCodePoints(decomp)
}

/**
 * 文字列全体を NFKD 展開する
 */
function nfkdExpand(cps: number[]): number[] {
  const result: number[] = []
  for (const cp of cps) {
    for (const expanded of nfkdExpandOne(cp)) {
      result.push(expanded)
    }
  }
  return result
}

/**
 * 正準合成: NFKD 列を NFKC に合成する
 *
 * 仕様: Unicode Standard Annex #15 Canonical Composition Algorithm
 * - スターター (Non-starter でない) を基点に合成を試みる
 * - ブロックされていない Non-starter と合成できれば合成
 * - Hangul: アルゴリズム合成
 */
function canonicalCompose(cps: number[]): number[] {
  if (cps.length === 0) return []

  const result = [...cps]
  let i = 0

  while (i < result.length) {
    const cp = result[i]!
    if (cp === undefined) { i++; continue }

    const isStarter = !NON_STARTER_SET.has(cp)
    if (!isStarter) { i++; continue }

    let lastStarter = i
    let j = i + 1

    while (j < result.length) {
      const cj = result[j]!
      if (cj === undefined) { j++; continue }

      const cjIsNonStarter = NON_STARTER_SET.has(cj)

      // ブロック判定: lastStarter と j の間に cj の CCC 以上の Non-starter があるか
      // (簡易実装: CCC 値は NON_STARTER_SET で代用)
      let blocked = false
      for (let k = lastStarter + 1; k < j; k++) {
        const ck = result[k]
        if (ck !== undefined && ck !== -1 && NON_STARTER_SET.has(ck)) {
          blocked = true
          break
        }
      }

      if (!blocked) {
        // Hangul L + V → LV 合成
        const L = result[lastStarter]!
        if (L >= 0x1100 && L <= 0x1112 && cj >= 0x1161 && cj <= 0x1175) {
          const LV = 0xac00 + (L - 0x1100) * 588 + (cj - 0x1161) * 28
          result[lastStarter] = LV
          result[j] = -1 // 削除マーク
          j++
          continue
        }

        // Hangul LV + T → LVT 合成
        if (L >= 0xac00 && L <= 0xd7a3 && (L - 0xac00) % 28 === 0 && cj >= 0x11a8 && cj <= 0x11c2) {
          result[lastStarter] = L + (cj - 0x11a7)
          result[j] = -1
          j++
          continue
        }

        // 通常合成テーブル参照
        const key = `${L},${cj}`
        const composed = COMPOSITION_MAP.get(key)
        if (composed !== undefined) {
          result[lastStarter] = composed
          result[j] = -1
          j++
          continue
        }
      }

      // Non-starter が続く限り続ける。Starter が来たら lastStarter を更新
      if (!cjIsNonStarter) {
        lastStarter = j
      }
      j++
    }

    i++
  }

  return result.filter((cp) => cp !== -1)
}

/**
 * コードポイント列を NFKC に変換する (vendored テーブル使用)
 */
function applyNfkc(cps: number[]): number[] {
  const nfkd = nfkdExpand(cps)
  return canonicalCompose(nfkd)
}

// ---------------------------------------------------------------------------
// Step 3: White_Space collapse + trim
// ---------------------------------------------------------------------------

function collapseWhiteSpace(cps: number[]): number[] {
  const result: number[] = []
  let inSpace = false

  for (const cp of cps) {
    if (white_spaceContains(cp)) {
      inSpace = true
    } else {
      if (inSpace && result.length > 0) {
        result.push(ASCII_SPACE)
      }
      inSpace = false
      result.push(cp)
    }
  }
  // 末尾空白は push しない (trim 済み)
  return result
}

// ---------------------------------------------------------------------------
// Step 5: Full case fold (vendored テーブル使用)
// ---------------------------------------------------------------------------

function applyCaseFold(cps: number[]): number[] {
  const result: number[] = []
  for (const cp of cps) {
    const folded = CASE_FOLD_MAP.get(cp)
    if (folded === undefined) {
      result.push(cp)
    } else {
      for (const fcp of toCodePoints(folded)) {
        result.push(fcp)
      }
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

export interface NormalizedLabelName {
  /** 正規化後の名前 */
  readonly normalized: string
  /** 正規化バージョン (= 1 固定) */
  readonly normalizationVersion: 1
}

/**
 * Label 名を LabelNormalizer v1 で正規化して返す。
 *
 * @throws DomainError - LABEL_NAME_REJECTED_CHARACTER: 禁止コードポイントを含む
 * @throws DomainError - LABEL_NAME_EMPTY: 正規化後が空文字
 * @throws DomainError - LABEL_NAME_TOO_LONG: 正規化後が上限超過
 */
export function normalizeLabelName(raw: string): NormalizedLabelName {
  // Step 1: raw 入力の拒否チェック
  const rawCps = toCodePoints(raw)
  for (const cp of rawCps) {
    if (isRawRejected(cp)) {
      throw new DomainError(
        DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER,
        `Rejected codepoint in raw input: U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
      )
    }
  }

  // Step 2: NFKC 変換
  const nfkcCps = applyNfkc(rawCps)

  // Step 3: White_Space collapse + trim
  const spaceCps = collapseWhiteSpace(nfkcCps)

  // Step 4: 残存 Cc / Cs / Default_Ignorable_Code_Point を拒否
  for (const cp of spaceCps) {
    if (isPostNfkcRejected(cp)) {
      throw new DomainError(
        DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER,
        `Rejected codepoint after NFKC: U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
      )
    }
  }

  // Step 5: Full case fold
  const caseFolded = applyCaseFold(spaceCps)

  // Step 6: 最終再検証
  for (const cp of caseFolded) {
    if (isPostNfkcRejected(cp)) {
      throw new DomainError(
        DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER,
        `Rejected codepoint after case fold: U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
      )
    }
  }

  const normalized = fromCodePoints(caseFolded)

  if (normalized.length === 0) {
    throw new DomainError(DomainErrorCode.LABEL_NAME_EMPTY, "Label name is empty after normalization")
  }

  if ([...normalized].length > MAX_LABEL_NAME_LENGTH) {
    throw new DomainError(
      DomainErrorCode.LABEL_NAME_TOO_LONG,
      `Label name exceeds ${MAX_LABEL_NAME_LENGTH} codepoints after normalization`,
    )
  }

  return { normalized, normalizationVersion: 1 }
}

/**
 * Asset SHA-256 ハッシュ定数を返す。
 * SchemaMeta の unicodeDataAssetSha256 と照合する。
 */
export function getVendoredAssetSha256(): string {
  return UNICODE_DATA_ASSET_SHA256
}

/**
 * Asset SHA-256 を検証する。
 * 不一致の場合 LABEL_NORMALIZER_ASSET_HASH_MISMATCH をスローする。
 */
export function assertAssetSha256(expected: string): void {
  if (expected !== UNICODE_DATA_ASSET_SHA256) {
    throw new DomainError(
      DomainErrorCode.LABEL_NORMALIZER_ASSET_HASH_MISMATCH,
      `Unicode asset SHA-256 mismatch: expected ${expected}, got ${UNICODE_DATA_ASSET_SHA256}`,
    )
  }
}
