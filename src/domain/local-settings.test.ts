/**
 * LocalSettings domain 単体テスト
 */
import { describe, it, expect } from "vitest"
import {
  migrateLocalSettings,
  assertLocalSettingsValid,
  DEFAULT_LOCAL_SETTINGS,
} from "~/domain/local-settings"
import { DomainErrorCode } from "~/domain/errors"

describe("migrateLocalSettings", () => {
  it("null 入力 → DEFAULT_LOCAL_SETTINGS を返す", () => {
    expect(migrateLocalSettings(null)).toMatchObject(DEFAULT_LOCAL_SETTINGS)
  })

  it("空オブジェクト → DEFAULT_LOCAL_SETTINGS を返す", () => {
    expect(migrateLocalSettings({})).toMatchObject({
      aiGranularity: 2,
      archiveAfterDays: 30,
      autoArchiveEnabled: false,
      contextMenuBookmarkEnabled: true,
      frequentVisitReminderEnabled: false,
    })
  })

  it("旧 frequentVisitThreshold (回数) は null にリセット", () => {
    const result = migrateLocalSettings({ frequentVisitThreshold: 5 })
    expect(result.frequentVisitDayThreshold).toBeNull()
    expect(result.frequentVisitWindow).toBeNull()
    expect(result.frequentVisitReminderEnabled).toBe(false)
  })

  it("archiveAfterDays 欠損 → 30 に縮退", () => {
    const result = migrateLocalSettings({})
    expect(result.archiveAfterDays).toBe(30)
  })

  it("archiveAfterDays が負数 → 30 に縮退", () => {
    const result = migrateLocalSettings({ archiveAfterDays: -1 })
    expect(result.archiveAfterDays).toBe(30)
  })

  it("archiveAfterDays=30 → 30 を保持", () => {
    const result = migrateLocalSettings({ archiveAfterDays: 30 })
    expect(result.archiveAfterDays).toBe(30)
  })

  it("contextMenuBookmarkEnabled 欠損 → true", () => {
    const result = migrateLocalSettings({})
    expect(result.contextMenuBookmarkEnabled).toBe(true)
  })

  it("contextMenuBookmarkEnabled が string (破損値) → false に縮退", () => {
    const result = migrateLocalSettings({ contextMenuBookmarkEnabled: "yes" })
    expect(result.contextMenuBookmarkEnabled).toBe(false)
  })

  it("aiGranularity 不正値 → 0 に縮退", () => {
    const result = migrateLocalSettings({ aiGranularity: 99 })
    expect(result.aiGranularity).toBe(0)
  })

  it("aiGranularity=3 → 3 を保持", () => {
    const result = migrateLocalSettings({ aiGranularity: 3 })
    expect(result.aiGranularity).toBe(3)
  })

  it("frequentVisitWindow が不正 string → null に縮退", () => {
    const result = migrateLocalSettings({ frequentVisitWindow: "LAST_1_YEAR" })
    expect(result.frequentVisitWindow).toBeNull()
  })

  it("frequentVisitWindow が有効 → 保持", () => {
    const result = migrateLocalSettings({ frequentVisitWindow: "LAST_30_DAYS" })
    expect(result.frequentVisitWindow).toBe("LAST_30_DAYS")
  })

  it("frequentVisitDayThreshold が期間上限を超えると null に縮退", () => {
    const result = migrateLocalSettings({
      frequentVisitWindow: "LAST_7_DAYS",
      frequentVisitDayThreshold: 8,
    })
    expect(result.frequentVisitDayThreshold).toBeNull()
  })

  it("frequentVisitDayThreshold が期間内の有効値 → 保持", () => {
    const result = migrateLocalSettings({
      frequentVisitWindow: "LAST_7_DAYS",
      frequentVisitDayThreshold: 5,
    })
    expect(result.frequentVisitDayThreshold).toBe(5)
  })
})
describe("assertLocalSettingsValid", () => {
  it("DEFAULT_LOCAL_SETTINGS はバリデーションを通る", () => {
    expect(() => assertLocalSettingsValid(DEFAULT_LOCAL_SETTINGS)).not.toThrow()
  })

  it("aiGranularity=5 は拒否", () => {
    const settings = { ...DEFAULT_LOCAL_SETTINGS, aiGranularity: 5 as never }
    expect(() => assertLocalSettingsValid(settings)).toThrow(
      DomainErrorCode.SETTINGS_AI_GRANULARITY_OUT_OF_RANGE,
    )
  })

  it("archiveAfterDays=0 は拒否", () => {
    const settings = { ...DEFAULT_LOCAL_SETTINGS, archiveAfterDays: 0 }
    expect(() => assertLocalSettingsValid(settings)).toThrow(
      DomainErrorCode.SETTINGS_ARCHIVE_AFTER_DAYS_INVALID,
    )
  })

  it("frequentVisitDayThreshold が window=LAST_7_DAYS で 8 → 拒否", () => {
    const settings = {
      ...DEFAULT_LOCAL_SETTINGS,
      frequentVisitWindow: "LAST_7_DAYS" as const,
      frequentVisitDayThreshold: 8,
    }
    expect(() => assertLocalSettingsValid(settings)).toThrow(
      DomainErrorCode.SETTINGS_FREQUENT_VISIT_DAY_THRESHOLD_INVALID,
    )
  })
})
