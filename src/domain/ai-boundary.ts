/**
 * AI 出力検証境界（旧 schema）
 *
 * @deprecated policy v2 では `classification-result.ts` の
 * `validateClassificationModelResult` を使う。本モジュールは移行中の互換用。
 */
import type { Id } from "./types"
import { DomainError, DomainErrorCode } from "./errors"

// ---------------------------------------------------------------------------
// AI 出力型定義 (外形スキーマ)
// ---------------------------------------------------------------------------

/** AI が返すタグ提案の外形 */
export interface AiTagSuggestion {
  readonly labelId: Id | null
  readonly labelName: string
  readonly confidence: number
  /** 既存タグへの割当か、新規作成提案か */
  readonly isNew: boolean
}

/** AI 分類結果の外形 */
export interface AiClassificationResult {
  readonly bookmarkId: Id
  readonly suggestions: ReadonlyArray<AiTagSuggestion>
}

// ---------------------------------------------------------------------------
// 外形スキーマ検証
// ---------------------------------------------------------------------------

/**
 * AI 出力を `AiClassificationResult` として安全に解析する。
 * 構造が不正な場合は AI_OUTPUT_DIRECT_CAST_FORBIDDEN をスローする。
 *
 * AI が返した unknown をそのまま Domain 型へキャストすることを禁止し、
 * 必ずこの関数を通す。
 */
export function parseAiClassificationResult(
  raw: unknown,
): AiClassificationResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DomainError(
      DomainErrorCode.AI_OUTPUT_DIRECT_CAST_FORBIDDEN,
      `AI output must be an object, got: ${typeof raw}`,
    )
  }

  const r = raw as Record<string, unknown>

  if (typeof r["bookmarkId"] !== "string" || r["bookmarkId"].length === 0) {
    throw new DomainError(
      DomainErrorCode.AI_OUTPUT_DIRECT_CAST_FORBIDDEN,
      `AI output missing valid bookmarkId`,
    )
  }

  if (!Array.isArray(r["suggestions"])) {
    throw new DomainError(
      DomainErrorCode.AI_OUTPUT_DIRECT_CAST_FORBIDDEN,
      `AI output suggestions must be an array`,
    )
  }

  const suggestions: AiTagSuggestion[] = []
  for (const item of r["suggestions"] as unknown[]) {
    suggestions.push(parseAiTagSuggestion(item))
  }

  return {
    bookmarkId: r["bookmarkId"] as Id,
    suggestions,
  }
}

function parseAiTagSuggestion(raw: unknown): AiTagSuggestion {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DomainError(
      DomainErrorCode.AI_OUTPUT_DIRECT_CAST_FORBIDDEN,
      `AI suggestion must be an object`,
    )
  }

  const r = raw as Record<string, unknown>

  const labelId =
    typeof r["labelId"] === "string" && r["labelId"].length > 0
      ? (r["labelId"] as Id)
      : null

  if (typeof r["labelName"] !== "string" || r["labelName"].length === 0) {
    throw new DomainError(
      DomainErrorCode.AI_OUTPUT_DIRECT_CAST_FORBIDDEN,
      `AI suggestion missing labelName`,
    )
  }

  if (typeof r["confidence"] !== "number" || r["confidence"] < 0 || r["confidence"] > 1) {
    throw new DomainError(
      DomainErrorCode.AI_OUTPUT_DIRECT_CAST_FORBIDDEN,
      `AI suggestion confidence must be 0-1, got: ${String(r["confidence"])}`,
    )
  }

  const isNew = typeof r["isNew"] === "boolean" ? r["isNew"] : labelId === null

  return {
    labelId,
    labelName: r["labelName"] as string,
    confidence: r["confidence"] as number,
    isNew,
  }
}

// ---------------------------------------------------------------------------
// 業務ルール検証
// ---------------------------------------------------------------------------

/**
 * AI が CATEGORY を作成しようとしていないかを確認する。
 * AI は TAG の提案のみ行い、CATEGORY の作成は禁止。
 *
 * (このチェックは AI が返した候補をアプリ層で使う際に呼ぶ)
 */
export function assertAiDoesNotCreateCategory(
  suggestions: ReadonlyArray<AiTagSuggestion>,
  categoryIds: ReadonlySet<Id>,
): void {
  for (const s of suggestions) {
    if (s.labelId !== null && categoryIds.has(s.labelId)) {
      throw new DomainError(
        DomainErrorCode.AI_CATEGORY_CREATION_FORBIDDEN,
        `AI suggested a CATEGORY id (${s.labelId}) as a TAG, which is forbidden`,
      )
    }
  }
}

/**
 * AI が提案した labelId がセッション候補の Tag ID に含まれるかを確認する。
 * 候補に含まれない ID は拒否する。
 */
export function assertAiLabelIdsInCandidates(
  suggestions: ReadonlyArray<AiTagSuggestion>,
  candidateTagIds: ReadonlySet<Id>,
): void {
  for (const s of suggestions) {
    if (s.labelId !== null && !candidateTagIds.has(s.labelId)) {
      throw new DomainError(
        DomainErrorCode.AI_LABEL_ID_NOT_IN_CANDIDATES,
        `AI suggested labelId (${s.labelId}) not in candidate set`,
      )
    }
  }
}
