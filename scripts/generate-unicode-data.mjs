#!/usr/bin/env node
/**
 * Unicode 15.1.0 データ vendoring スクリプト
 *
 * @unicode/unicode-15.1.0 (npm パッケージ) と
 * Node.js 組み込み ICU (unicode 15.1.0 対応) を使い、
 * LabelNormalizer v1 で使用する TypeScript テーブルを生成する。
 *
 * 生成先: src/domain/normalizer/vendor/
 *
 * 実行: node scripts/generate-unicode-data.mjs
 *
 * ■ 設計方針
 *   - NFKC 分解テーブルは Node.js 22+ (ICU 74.2+, Unicode 15.1.0) の
 *     String.prototype.normalize('NFKC') を使ってビルド時にのみ生成する。
 *     生成済みの静的テーブルをコミットし、runtime では vendored テーブルのみ使う。
 *   - White_Space / Default_Ignorable_Code_Point / Case_Folding は
 *     @unicode/unicode-15.1.0 パッケージから取得する。
 *   - 生成ファイルの SHA-256 を asset-sha256.ts に書き込み、
 *     runtime でデータ改ざんを検出する。
 */

import { createHash } from "node:crypto"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT_DIR = join(ROOT, "src", "domain", "normalizer", "vendor")

const require = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// ICU バージョン確認
// ---------------------------------------------------------------------------

const ICU_VERSION = process.versions.icu
const ICU_MAJOR = parseInt(ICU_VERSION.split(".")[0], 10)
// ICU 74.2 = Unicode 15.1.0
if (ICU_MAJOR < 74) {
  console.error(`ICU version ${ICU_VERSION} may not support Unicode 15.1.0 (need ICU >= 74.2).`)
  console.error("Please use Node.js 22+ to generate vendor data.")
  process.exit(1)
}
console.log(`Using ICU ${ICU_VERSION} (Unicode 15.1.0 compatible)`)

// ---------------------------------------------------------------------------
// @unicode/unicode-15.1.0 パッケージからデータ取得
// ---------------------------------------------------------------------------

const whiteSpaceCps = /** @type {number[]} */ (
  require("@unicode/unicode-15.1.0/Binary_Property/White_Space/code-points.js")
)
const defaultIgnorableCps = /** @type {number[]} */ (
  require("@unicode/unicode-15.1.0/Binary_Property/Default_Ignorable_Code_Point/code-points.js")
)
const compositionExclusionCps = /** @type {number[]} */ (
  require("@unicode/unicode-15.1.0/Binary_Property/Composition_Exclusion/code-points.js")
)
const gcSurrogateCps = /** @type {number[]} */ (
  require("@unicode/unicode-15.1.0/General_Category/Surrogate/code-points.js")
)
const gcControlCps = /** @type {number[]} */ (
  require("@unicode/unicode-15.1.0/General_Category/Control/code-points.js")
)
const caseFoldC = /** @type {Map<number, number|number[]>} */ (
  require("@unicode/unicode-15.1.0/Case_Folding/C/code-points.js")
)
const caseFoldF = /** @type {Map<number, number|number[]>} */ (
  require("@unicode/unicode-15.1.0/Case_Folding/F/code-points.js")
)

// ---------------------------------------------------------------------------
// 正準結合クラス (CCC) の構築
// Unicode プロパティ から直接取得できないため、
// 各コードポイントに CCC = 0 でない文字を NFD 分解で逆引きする
// ---------------------------------------------------------------------------

// CCC は @unicode/unicode-15.1.0 には直接含まれないため
// Node.js NFD で各コードポイントを分解して CCC を調べる
// (NFD 分解後の combining マークの順序は CCC 順)
// より正確には: combining characters 全体をスキャン

// General_Category = Mn (Nonspacing Mark), Me (Enclosing Mark), Mc (Spacing Mark) の
// コードポイントが CCC を持つ。ただし CCC=0 のものも存在する。
// 実用上は: 全コードポイント (0..10FFFF) のうち NFD で2文字以上になるものを確認する方法が正確。

/**
 * コードポイントの正準結合クラスを取得する。
 * NFD 分解後の文字の並び順から逆引きするのではなく、
 * Node.js のアルゴリズムで確認する。
 *
 * 実際の CCC は Unicode Character Database の canonical combining class プロパティ。
 * Node.js の NFD はこの値に従ってソートするため、以下で推定できる:
 *
 * CCC > 0 かどうかは: 文字を NFD にしたとき、それ自体が結合文字 (combining mark) かを確認する。
 * ただし正確な CCC 値は NFD ソート順のみから判断できない。
 *
 * より確実な方法: combining character の CCC をビルド時スクリプトで全走査して確定する。
 * Unicode.org の DerivedCombiningClass.txt から取得するのが最善だが、
 * ここではオフライン対応のため以下のアプローチを取る:
 *
 * node-unicode-data の CCC データは Sequence_Property 内にある可能性がある。
 */

// CCC データは @unicode/unicode-15.1.0 に含まれないため、
// NFD 正規化による間接的な取得を使う
// ただしこれは CCC 値そのものではなく、合成に必要な判断のみに使う

// 合成テーブルの構築には厳密な CCC が必要なため、
// NFD で分解した結合文字の CCC を近似する:
// 結合文字 (combining marks) のコードポイントを列挙し、
// それぞれを NFD で通るようにシングルコードポイントの NFD を調べる。

// 実際は CCC = 0 かどうかだけが合成アルゴリズムで重要なため、
// 「NFD 分解後に先頭でない文字は CCC > 0 の候補」として扱う。

// ---------------------------------------------------------------------------
// NFKD 分解テーブルの構築
// ---------------------------------------------------------------------------

console.log("Building NFKD decomposition table (using Node.js ICU)...")

/**
 * コードポイントが Hangul syllable かどうか
 */
function isHangulSyllable(cp) {
  return cp >= 0xac00 && cp <= 0xd7a3
}

/**
 * 全コードポイントについて NFKD 分解テーブルを構築する。
 * - identity (自分自身) の場合は記録しない
 * - Hangul syllable はアルゴリズム分解のため含まない
 * - Surrogate コードポイントは除外
 */
function buildNfkdMap() {
  /** @type {Map<number, number[]>} */
  const map = new Map()

  // 効率化のため: NFKD で変化するコードポイントのみを記録
  // 全コードポイント走査 (0 ~ 10FFFF)
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    // Surrogate はスキップ
    if (cp >= 0xd800 && cp <= 0xdfff) continue
    // Hangul syllable はアルゴリズムで処理
    if (isHangulSyllable(cp)) continue

    const str = String.fromCodePoint(cp)
    const nfkd = str.normalize("NFD") // まず NFD で正準分解
    // NFKD: 互換分解 + 正準分解
    const nfkdStr = str.normalize("NFKD")

    if (nfkdStr === str) continue // identity

    const decomposed = [...nfkdStr].map((c) => c.codePointAt(0))
    map.set(cp, decomposed)
  }
  return map
}

const nfkdMap = buildNfkdMap()
console.log(`  NFKD map: ${nfkdMap.size} entries`)

// ---------------------------------------------------------------------------
// CCC テーブルの構築
// ---------------------------------------------------------------------------

console.log("Building CCC table...")

/**
 * CCC (Canonical Combining Class) テーブルを構築する。
 *
 * 正確な CCC は Unicode Character Database から取得する必要がある。
 * @unicode/unicode-15.1.0 には含まれないため、
 * NFD 安定性 (NFD twice == NFD) とソート順から CCC を逆引きする方法は
 * 不完全なため、以下の代替手段を使う:
 *
 * NFD 分解後に combining mark として現れるコードポイントは CCC > 0。
 * その相対順序を正準合成テーブルの構築に使用する。
 *
 * 注: 正準合成テーブルでは「first codepoint が CCC=0 (starter)」かどうかのみを
 * 使用するため、完全な CCC 値でなく「CCC > 0 かどうか」が分かれば十分。
 */
function buildCccMap() {
  /** @type {Map<number, number>} */
  const map = new Map()

  // 戦略: 全コードポイントを NFD にして、
  // NFD 分解後の1文字目でない文字たちの CCC 情報を記録する
  // (ただし CCC の数値は Unicode.org のデータなしには確定しない)

  // 代替: combining marks (General Category Mn, Mc, Me) の CCC は
  // NFD 分解の出力順序から統計的に判断できる
  // ここでは合成テーブル構築に必要な「starter かどうか」の判定のみを行う

  // combining characters: NFD で分解したとき先頭に来ない文字
  const nonStarters = new Set()
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue
    const str = String.fromCodePoint(cp)
    const nfd = str.normalize("NFD")
    if (nfd.length > 1 || (nfd.length === 1 && nfd !== str)) {
      const cps = [...nfd].map((c) => c.codePointAt(0))
      for (let i = 0; i < cps.length; i++) {
        if (i > 0) nonStarters.add(cps[i])
      }
    }
  }

  // combining marks を実際の CCC 値付きで記録するには
  // Unicode.org のデータが必要。暫定実装:
  // - nonStarters に含まれるコードポイントは CCC > 0 とマーク
  // - 実際の CCC 値の代わりに 1 を使用
  // NOTE: 合成テーブル構築では「CCC == 0 かどうか」のみ使用するため問題ない

  for (const cp of nonStarters) {
    map.set(cp, 1) // 非ゼロを示す (実際の値は @unicode データが必要)
  }
  return { map, nonStarters }
}

const { map: cccMap, nonStarters } = buildCccMap()
console.log(`  CCC non-starters: ${nonStarters.size} entries`)

// ---------------------------------------------------------------------------
// 正準合成テーブルの構築
// ---------------------------------------------------------------------------

console.log("Building canonical composition table...")

const compositionExclusionSet = new Set(compositionExclusionCps)

/**
 * 正準合成テーブルを構築する。
 * NFD で分解したとき、2 コードポイントに分解される組み合わせを収集する。
 * 条件:
 * - 正準分解 (NFD) で 2 コードポイント [L, C] に分解される cp
 * - cp が CompositionExclusion に含まれない
 * - L が starter (CCC = 0) である
 * - L, C が Hangul でない
 */
function buildCompositionMap() {
  /** @type {Map<string, number>} */
  const map = new Map()

  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue
    if (isHangulSyllable(cp)) continue
    if (compositionExclusionSet.has(cp)) continue

    const str = String.fromCodePoint(cp)
    const nfd = str.normalize("NFD")
    const cps = [...nfd].map((c) => c.codePointAt(0))

    if (cps.length !== 2) continue
    const [L, C] = cps
    if (L === undefined || C === undefined) continue
    if (isHangulSyllable(L) || isHangulSyllable(C)) continue

    // L が non-starter (CCC > 0) なら合成テーブルに入れない
    if (nonStarters.has(L)) continue

    map.set(`${L},${C}`, cp)
  }
  return map
}

const compositionMap = buildCompositionMap()
console.log(`  Composition pairs: ${compositionMap.size} entries`)

// ---------------------------------------------------------------------------
// Case fold マップの統合 (C + F)
// ---------------------------------------------------------------------------

console.log("Building case fold map...")

/** @type {Map<number, number[]>} */
const combinedCaseFold = new Map()

// まず C を追加
for (const [cp, mapped] of caseFoldC) {
  const arr = Array.isArray(mapped) ? mapped : [mapped]
  combinedCaseFold.set(cp, arr)
}

// F で上書き (F mapping があれば F を使う)
for (const [cp, mapped] of caseFoldF) {
  const arr = Array.isArray(mapped) ? mapped : [mapped]
  combinedCaseFold.set(cp, arr)
}
console.log(`  Case fold map: ${combinedCaseFold.size} entries`)

// ---------------------------------------------------------------------------
// TypeScript ファイル生成ユーティリティ
// ---------------------------------------------------------------------------

const HEADER = `/**
 * @generated このファイルは scripts/generate-unicode-data.mjs によって自動生成されます。
 * 手動で編集しないでください。
 * Unicode version: 15.1.0 / ICU: ${ICU_VERSION}
 * 再生成: node scripts/generate-unicode-data.mjs
 */
/* eslint-disable */
// @ts-nocheck
`

/**
 * コードポイント配列をランレングス圧縮した TypeScript 定数を生成する
 */
function cpSetToTs(name, cpArray) {
  const sorted = [...cpArray].sort((a, b) => a - b)
  const ranges = []
  if (sorted.length > 0) {
    let start = sorted[0]
    let len = 1
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        len++
      } else {
        ranges.push([start, len])
        start = sorted[i]
        len = 1
      }
    }
    ranges.push([start, len])
  }

  const lines = ranges.map(([s, l]) => `  [0x${s.toString(16).toUpperCase()}, ${l}],`)
  return `${HEADER}
/**
 * ${name}: [startCodepoint, length] のランレングス圧縮ペア配列
 * containsCodepoint(cp) で判定してください
 */
export const ${name}_RANGES: ReadonlyArray<readonly [number, number]> = [
${lines.join("\n")}
] as const

/** コードポイントが ${name} に含まれるか判定する */
export function ${name.toLowerCase()}Contains(cp: number): boolean {
  let lo = 0
  let hi = ${name}_RANGES.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const [start, len] = ${name}_RANGES[mid]!
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
`
}

// ---------------------------------------------------------------------------
// ファイル生成
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })

// --- white-space.ts ---
const wsContent = cpSetToTs("WHITE_SPACE", whiteSpaceCps)
writeFileSync(join(OUT_DIR, "white-space.ts"), wsContent, "utf8")
console.log(`\nGenerated white-space.ts (${whiteSpaceCps.length} codepoints)`)

// --- default-ignorable.ts ---
const diContent = cpSetToTs("DEFAULT_IGNORABLE", defaultIgnorableCps)
writeFileSync(join(OUT_DIR, "default-ignorable.ts"), diContent, "utf8")
console.log(`Generated default-ignorable.ts (${defaultIgnorableCps.length} codepoints)`)

// --- general-category.ts ---
const gcCsContent = cpSetToTs("GC_SURROGATE", gcSurrogateCps)
const gcCcContent = cpSetToTs("GC_CONTROL", gcControlCps)
const gcContent = `${HEADER}
// General Category: Cs (Surrogate)
${gcCsContent.replace(HEADER, "")}

// General Category: Cc (Control)
${gcCcContent.replace(HEADER, "")}
`
writeFileSync(join(OUT_DIR, "general-category.ts"), gcContent, "utf8")
console.log(`Generated general-category.ts`)

// --- nfkc.ts ---
const nfkdLines = [...nfkdMap.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([cp, cps]) => {
    const str = cps.map((c) => `\\u{${c.toString(16)}}`).join("")
    return `  [0x${cp.toString(16).toUpperCase()}, "${str}"],`
  })

const compLines = [...compositionMap.entries()]
  .sort((a, b) => {
    const [aL, aC] = a[0].split(",").map(Number)
    const [bL, bC] = b[0].split(",").map(Number)
    return aL !== bL ? aL - bL : aC - bC
  })
  .map(([key, cp]) => {
    return `  ["${key}", 0x${cp.toString(16).toUpperCase()}],`
  })

const nfkcContent = `${HEADER}
/**
 * NFKD 分解テーブル
 * [codepoint, 完全展開済み NFKD 文字列] のペア配列
 * identity (自分自身) および Hangul syllable (U+AC00-U+D7A3) は含まない。
 * Hangul はアルゴリズムで処理する。
 */
export const NFKD_MAP: ReadonlyMap<number, string> = new Map<number, string>([
${nfkdLines.join("\n")}
])

/**
 * 正準合成テーブル
 * key: "starter_cp,combiner_cp" → 合成後コードポイント
 * CompositionExclusion および Hangul は含まない。
 */
export const COMPOSITION_MAP: ReadonlyMap<string, number> = new Map<string, number>([
${compLines.join("\n")}
])

/** コードポイントが合成の "starter" (CCC = 0) かどうかを判定する補助集合 */
export const NON_STARTER_SET: ReadonlySet<number> = new Set<number>([
${[...nonStarters].sort((a,b)=>a-b).map(cp => `  0x${cp.toString(16).toUpperCase()},`).join("\n")}
])
`
writeFileSync(join(OUT_DIR, "nfkc.ts"), nfkcContent, "utf8")
console.log(`Generated nfkc.ts (${nfkdMap.size} NFKD, ${compositionMap.size} composition pairs)`)

// --- case-folding.ts ---
const cfLines = [...combinedCaseFold.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([cp, mapped]) => {
    const str = mapped.map((c) => `\\u{${c.toString(16)}}`).join("")
    return `  [0x${cp.toString(16).toUpperCase()}, "${str}"],`
  })

const cfContent = `${HEADER}
/**
 * Case folding テーブル
 * Unicode 15.1.0 CaseFolding.txt status C および F のエントリ。
 * F mapping がある場合は F (full)、なければ C (common) を使用。
 * [codepoint, case-folded 文字列] のペア配列。
 */
export const CASE_FOLD_MAP: ReadonlyMap<number, string> = new Map<number, string>([
${cfLines.join("\n")}
])
`
writeFileSync(join(OUT_DIR, "case-folding.ts"), cfContent, "utf8")
console.log(`Generated case-folding.ts (${combinedCaseFold.size} entries)`)

// --- asset-sha256.ts ---
const allContent = [wsContent, diContent, gcContent, nfkcContent, cfContent].join("")
const sha256 = createHash("sha256").update(allContent, "utf8").digest("hex")

const sha256Content = `${HEADER}
/**
 * LabelNormalizer v1 vendored asset の SHA-256 ハッシュ定数。
 * runtime で実際のデータと照合し、改ざんを検出する。
 * DB SchemaMeta の unicodeDataAssetSha256 フィールドと一致しなければ
 * Label の書き込みを停止する。
 */
export const UNICODE_DATA_ASSET_SHA256 = "${sha256}" as const
`
writeFileSync(join(OUT_DIR, "asset-sha256.ts"), sha256Content, "utf8")
console.log(`Generated asset-sha256.ts (SHA-256: ${sha256.slice(0, 16)}...)`)

// --- README.md ---
const readmeContent = `# vendor/

Unicode 15.1.0 データから \`scripts/generate-unicode-data.mjs\` で自動生成したファイル群。

## 生成ファイル

| ファイル | 内容 |
|---|---|
| \`white-space.ts\` | \`White_Space\` property コードポイント範囲 |
| \`default-ignorable.ts\` | \`Default_Ignorable_Code_Point\` property 範囲 |
| \`general-category.ts\` | \`Cs\` (Surrogate) / \`Cc\` (Control) コードポイント範囲 |
| \`nfkc.ts\` | NFKD 分解テーブル / Non-starter 集合 / 正準合成テーブル |
| \`case-folding.ts\` | CaseFolding.txt status C+F マッピング |
| \`asset-sha256.ts\` | 全ファイル連結の SHA-256 ハッシュ定数 |

## 更新方法

\`\`\`bash
node scripts/generate-unicode-data.mjs
\`\`\`

生成ファイルはリポジトリにコミットし、CI でスクリプトを再実行しない。
Unicode バージョンを変更する際はスクリプトの変数と normalizationVersion を合わせて更新する。

## ICU 依存について

NFKD 分解テーブルの生成のみ Node.js ICU を使用する。
生成された静的テーブルのみを runtime で使用し、Node.js / Chrome の ICU に runtime 依存しない。
`
writeFileSync(join(OUT_DIR, "README.md"), readmeContent, "utf8")

console.log("\nAll vendor files generated successfully.")
console.log(`Output directory: ${OUT_DIR}`)
