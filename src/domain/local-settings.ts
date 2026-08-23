/**
 * LocalSettings Domain エンティティ
 *
 * DB-SCHEMA.md §local_settings の型定義と migration ヘルパー。
 *
 * Migration 規則 (DB-SCHEMA.md §Migration方針):
 * - 旧 `frequentVisitThreshold` (回数) は日数へ暗黙変換しない
 *   → frequentVisitWindow=null, frequentVisitDayThreshold=null,
 *     frequentVisitReminderEnabled=false に縮退して再設定要求
 * - `archiveAfterDays` 欠損/不正 → 30
 * - `autoArchiveEnabled` 欠損 → false
 * - `contextMenuBookmarkEnabled` 欠損 → true、boolean 以外 → false (縮退)
 * - `aiGranularity` は新規設定で2。不正値 → 0 (縮退)
 */
import type { FrequentVisitWindow } from "./types"
import { DomainError, DomainErrorCode } from "./errors"

// ---------------------------------------------------------------------------
// LocalSettings 型定義
// ---------------------------------------------------------------------------

export interface LocalSettings {
  readonly schemaVersion: number

  // --- 頻繁訪問リマインダー ---
  /** リマインダーを有効にするか */
  readonly frequentVisitReminderEnabled: boolean
  /** 集計する訪問期間 */
  readonly frequentVisitWindow: FrequentVisitWindow | null
  /**
   * 指定期間内の訪問日数が閾値以上で通知。
   * 単位は日数 (回数ではない)。
   */
  readonly frequentVisitDayThreshold: number | null

  // --- アーカイブ ---
  /** 自動アーカイブを有効にするか */
  readonly autoArchiveEnabled: boolean
  /**
   * 最終訪問から何日後にアーカイブするか。
   * デフォルト: 30、欠損 migration 既定: 30。正整数のみ有効。
   */
  readonly archiveAfterDays: number

  // --- コンテキストメニュー ---
  /**
   * コンテキストメニューにブックマーク保存を表示するか。
   * 欠損 migration 既定: true。boolean 以外は false に縮退。
   */
  readonly contextMenuBookmarkEnabled: boolean

  // --- AI 分類 ---
  /**
   * AI 分類の細分化度。0〜4 のみ有効。
   * 0: 新規タグ作成なし (既存タグ自動付与あり)
   * 1〜4: 最大新規タグ数が増える
   */
  readonly aiGranularity: 0 | 1 | 2 | 3 | 4
}

// ---------------------------------------------------------------------------
// デフォルト値
// ---------------------------------------------------------------------------

export const DEFAULT_LOCAL_SETTINGS: Readonly<LocalSettings> = {
  schemaVersion: 1,
  frequentVisitReminderEnabled: false,
  frequentVisitWindow: null,
  frequentVisitDayThreshold: null,
  autoArchiveEnabled: false,
  archiveAfterDays: 30,
  contextMenuBookmarkEnabled: true,
  aiGranularity: 2,
}

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

const VALID_GRANULARITY = new Set([0, 1, 2, 3, 4])
const VALID_VISIT_WINDOWS = new Set<FrequentVisitWindow>(["LAST_7_DAYS", "LAST_30_DAYS", "LAST_365_DAYS"])
const MAX_VISIT_DAYS_BY_WINDOW: Record<FrequentVisitWindow, number> = {
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
  LAST_365_DAYS: 365,
}

/**
 * LocalSettings の不変条件を検証する。
 */
export function assertLocalSettingsValid(settings: LocalSettings): void {
  // aiGranularity
  if (!VALID_GRANULARITY.has(settings.aiGranularity)) {
    throw new DomainError(
      DomainErrorCode.SETTINGS_AI_GRANULARITY_OUT_OF_RANGE,
      `aiGranularity must be 0-4, got: ${settings.aiGranularity}`,
    )
  }

  // archiveAfterDays
  if (
    !Number.isInteger(settings.archiveAfterDays) ||
    settings.archiveAfterDays < 1
  ) {
    throw new DomainError(
      DomainErrorCode.SETTINGS_ARCHIVE_AFTER_DAYS_INVALID,
      `archiveAfterDays must be a positive integer, got: ${settings.archiveAfterDays}`,
    )
  }

  // frequentVisitWindow
  if (
    settings.frequentVisitWindow !== null &&
    !VALID_VISIT_WINDOWS.has(settings.frequentVisitWindow)
  ) {
    throw new DomainError(
      DomainErrorCode.SETTINGS_FREQUENT_VISIT_WINDOW_INVALID,
      `frequentVisitWindow must be one of LAST_7_DAYS|LAST_30_DAYS|LAST_365_DAYS or null`,
    )
  }

  // frequentVisitDayThreshold
  if (settings.frequentVisitWindow !== null) {
    const maxDays = MAX_VISIT_DAYS_BY_WINDOW[settings.frequentVisitWindow]
    if (settings.frequentVisitDayThreshold !== null) {
      if (
        !Number.isInteger(settings.frequentVisitDayThreshold) ||
        settings.frequentVisitDayThreshold < 1 ||
        settings.frequentVisitDayThreshold > maxDays
      ) {
        throw new DomainError(
          DomainErrorCode.SETTINGS_FREQUENT_VISIT_DAY_THRESHOLD_INVALID,
          `frequentVisitDayThreshold must be 1-${maxDays} for window=${settings.frequentVisitWindow}, got: ${settings.frequentVisitDayThreshold}`,
        )
      }
    }
  } else if (settings.frequentVisitDayThreshold !== null) {
    throw new DomainError(
      DomainErrorCode.SETTINGS_FREQUENT_VISIT_DAY_THRESHOLD_INVALID,
      "frequentVisitDayThreshold must be null when frequentVisitWindow is null",
    )
  }
}
// ---------------------------------------------------------------------------
// Migration ヘルパー
// ---------------------------------------------------------------------------

/**
 * DB から読み込んだ未知の settings オブジェクトを LocalSettings に安全に変換する。
 *
 * 旧フォーマットや欠損フィールドを安全な既定値へ縮退させる。
 * unknown 入力を domain 型に変換する唯一の正規経路。
 */
export function migrateLocalSettings(raw: unknown): LocalSettings {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_LOCAL_SETTINGS }
  }

  const r = raw as Record<string, unknown>

  // aiGranularity: 0|1|2|3|4 のみ。不正値 → 0
  const aiGranularityRaw = r["aiGranularity"]
  const aiGranularity: 0 | 1 | 2 | 3 | 4 =
    aiGranularityRaw === undefined
      ? 2
      : VALID_GRANULARITY.has(aiGranularityRaw as number)
        ? (aiGranularityRaw as 0 | 1 | 2 | 3 | 4)
        : 0

  // archiveAfterDays: 欠損/不正 → 30
  const archiveDaysRaw = r["archiveAfterDays"]
  const archiveAfterDays: number =
    Number.isInteger(archiveDaysRaw) && (archiveDaysRaw as number) >= 1
      ? (archiveDaysRaw as number)
      : 30

  // autoArchiveEnabled: 欠損 → false
  const autoArchiveEnabled =
    typeof r["autoArchiveEnabled"] === "boolean" ? r["autoArchiveEnabled"] : false

  // contextMenuBookmarkEnabled: 欠損 → true、boolean 以外 → false (縮退)
  const contextMenuBookmarkEnabled =
    r["contextMenuBookmarkEnabled"] === undefined
      ? true
      : typeof r["contextMenuBookmarkEnabled"] === "boolean"
        ? r["contextMenuBookmarkEnabled"]
        : false

  // frequentVisitReminderEnabled
  const frequentVisitReminderEnabled =
    typeof r["frequentVisitReminderEnabled"] === "boolean"
      ? r["frequentVisitReminderEnabled"]
      : false

  // frequentVisitWindow: null または VALID_VISIT_WINDOWS のみ
  const visitWindowRaw = r["frequentVisitWindow"]
  const frequentVisitWindow: FrequentVisitWindow | null =
    typeof visitWindowRaw === "string" && VALID_VISIT_WINDOWS.has(visitWindowRaw as FrequentVisitWindow)
      ? (visitWindowRaw as FrequentVisitWindow)
      : null

  // frequentVisitDayThreshold
  // 旧 frequentVisitThreshold (回数) は暗黙変換せず null にリセット
  const hasOldThresholdField =
    "frequentVisitThreshold" in r && !("frequentVisitDayThreshold" in r)
  const visitDayRaw = r["frequentVisitDayThreshold"]
  let frequentVisitDayThreshold: number | null = null
  if (!hasOldThresholdField && frequentVisitWindow !== null) {
    const maxDays = MAX_VISIT_DAYS_BY_WINDOW[frequentVisitWindow]
    frequentVisitDayThreshold =
      Number.isInteger(visitDayRaw) &&
      (visitDayRaw as number) >= 1 &&
      (visitDayRaw as number) <= maxDays
        ? (visitDayRaw as number)
        : null
  }

  const schemaVersion =
    typeof r["schemaVersion"] === "number" ? r["schemaVersion"] : 1

  return {
    schemaVersion,
    frequentVisitReminderEnabled,
    frequentVisitWindow,
    frequentVisitDayThreshold,
    autoArchiveEnabled,
    archiveAfterDays,
    contextMenuBookmarkEnabled,
    aiGranularity,
  }
}
