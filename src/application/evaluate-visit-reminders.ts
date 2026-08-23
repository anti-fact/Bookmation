import { LocalDataLayer } from "~/adapters"
import { computeUrlHash } from "~/adapters/indexeddb/crypto-utils"
import { openBookmationDatabase } from "~/adapters/indexeddb/open-database"
import { VisitReminderRepository } from "~/adapters/indexeddb/visit-reminder-repository"
import { isAllowedUrl, validateAndNormalizeUrl } from "~/domain/value-objects/url"
import {
  blocksReminderCandidate,
  countDistinctVisitDays,
  isReminderEvaluationReady,
  shouldSkipReminderNotification,
  windowStartMs,
} from "~/domain/visit-reminder"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"
import type { HistoryPort } from "~/ports/history-port"

export type EvaluateVisitRemindersResult = Readonly<{
  evaluated: boolean
  pendingReminderId: string | null
}>

export async function evaluateVisitReminders(deps: {
  settingsStore: LocalSettingsStore
  history: HistoryPort
  now?: number
}): Promise<EvaluateVisitRemindersResult> {
  const now = deps.now ?? Date.now()
  const settings = await deps.settingsStore.get()

  if (!isReminderEvaluationReady(settings)) {
    return { evaluated: false, pendingReminderId: null }
  }

  const window = settings.frequentVisitWindow!
  const threshold = settings.frequentVisitDayThreshold!
  const windowStartedAt = windowStartMs(window, now)

  const db = await openBookmationDatabase()
  const reminders = new VisitReminderRepository(db)
  const dataLayer = await LocalDataLayer.open()

  try {
    const existingPending = await reminders.getOldestPending()
    if (existingPending) {
      return { evaluated: true, pendingReminderId: existingPending.id }
    }

    const candidates = await deps.history.searchCandidatesSince(windowStartedAt)

    for (const candidate of candidates) {
      if (!isAllowedUrl(candidate.url)) {
        continue
      }

      const normalized = validateAndNormalizeUrl(candidate.url)
      const existingBookmark = await dataLayer.findActiveBookmarkByNormalizedUrl(
        normalized.normalized,
      )
      if (existingBookmark) {
        continue
      }

      const urlHash = await computeUrlHash(normalized.normalized)
      const existingReminder = await reminders.getByUrlHash(urlHash)
      if (existingReminder && blocksReminderCandidate(existingReminder.state)) {
        continue
      }
      if (existingReminder && shouldSkipReminderNotification(existingReminder.state)) {
        continue
      }

      const visitTimes = await deps.history.getVisitTimes(candidate.url)
      const visitDays = countDistinctVisitDays(
        visitTimes,
        windowStartedAt,
        existingReminder?.countingResetAt ?? null,
      )
      if (visitDays < threshold) {
        continue
      }

      const reminder = await reminders.createPending({
        id: crypto.randomUUID(),
        normalizedUrl: normalized.normalized,
        window,
        windowStartedAt,
        visitDaysAtReminder: visitDays,
        countingResetAt: existingReminder?.countingResetAt ?? null,
        now,
      })

      return { evaluated: true, pendingReminderId: reminder.id }
    }
  } finally {
    await dataLayer.close()
    db.close()
  }

  return { evaluated: true, pendingReminderId: null }
}
