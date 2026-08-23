import type { FrequentVisitWindow } from "./types"

export const VISIT_REMINDER_SCHEMA_VERSION = 1 as const

export type VisitReminderState =
  | "PENDING"
  | "SAVED"
  | "DECLINED"
  | "DISMISSED"
  | "SUPPRESSED"

export type VisitReminderRecord = Readonly<{
  schemaVersion: typeof VISIT_REMINDER_SCHEMA_VERSION
  id: string
  normalizedUrlHash: string
  normalizedUrl: string
  window: FrequentVisitWindow
  windowStartedAt: number
  visitDaysAtReminder: number
  countingResetAt: number | null
  state: VisitReminderState
  remindedAt: number
  respondedAt: number | null
  createdAt: number
  updatedAt: number
}>

export type VisitReminderResponse = "yes" | "no" | "dismissed"

const WINDOW_DAY_COUNTS: Record<FrequentVisitWindow, number> = {
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
  LAST_365_DAYS: 365,
}

export function startOfLocalCalendarDay(epochMs: number): number {
  const date = new Date(epochMs)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function localCalendarDayKey(epochMs: number): string {
  const date = new Date(epochMs)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** 当日を含む直近 N 暦日の開始時刻（ローカル）を返す。 */
export function windowStartMs(window: FrequentVisitWindow, now: number): number {
  const dayCount = WINDOW_DAY_COUNTS[window]
  const todayStart = startOfLocalCalendarDay(now)
  const startDate = new Date(todayStart)
  startDate.setDate(startDate.getDate() - (dayCount - 1))
  return startDate.getTime()
}

export function countDistinctVisitDays(
  visitTimes: readonly number[],
  windowStartMs: number,
  countingResetAt: number | null,
): number {
  const effectiveStart = Math.max(windowStartMs, countingResetAt ?? 0)
  const dayKeys = new Set<string>()

  for (const visitTime of visitTimes) {
    if (visitTime <= effectiveStart) {
      continue
    }
    dayKeys.add(localCalendarDayKey(visitTime))
  }

  return dayKeys.size
}

export function isReminderEvaluationReady(settings: {
  frequentVisitReminderEnabled: boolean
  frequentVisitWindow: FrequentVisitWindow | null
  frequentVisitDayThreshold: number | null
}): boolean {
  return (
    settings.frequentVisitReminderEnabled &&
    settings.frequentVisitWindow !== null &&
    settings.frequentVisitDayThreshold !== null
  )
}

export function blocksReminderCandidate(state: VisitReminderState): boolean {
  return state === "SUPPRESSED" || state === "SAVED"
}

export function shouldSkipReminderNotification(state: VisitReminderState): boolean {
  return state === "PENDING" || blocksReminderCandidate(state)
}
