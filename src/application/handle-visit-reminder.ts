import { LocalDataLayer } from "~/adapters"
import { openBookmationDatabase } from "~/adapters/indexeddb/open-database"
import { VisitReminderRepository } from "~/adapters/indexeddb/visit-reminder-repository"
import type { VisitReminderResponse } from "~/domain/visit-reminder"

import { SaveBookmarkUseCase } from "./save-bookmark"

export type HandleVisitReminderInput = Readonly<{
  reminderId: string
  response: VisitReminderResponse
  suppressFuture?: boolean
  now?: number
}>

export type HandleVisitReminderResult = Readonly<{
  state: "SAVED" | "DECLINED" | "DISMISSED" | "SUPPRESSED"
  duplicate?: boolean
}>

export async function handleVisitReminder(
  input: HandleVisitReminderInput,
  deps: {
    saveBookmark?: SaveBookmarkUseCase
  } = {},
): Promise<HandleVisitReminderResult> {
  const now = input.now ?? Date.now()
  const db = await openBookmationDatabase()
  const reminders = new VisitReminderRepository(db)

  try {
    const existing = await reminders.getById(input.reminderId)
    if (!existing) {
      throw new Error("REMINDER_NOT_FOUND")
    }

    if (input.response === "yes") {
      const dataLayer = await LocalDataLayer.open()
      try {
        const saveBookmark =
          deps.saveBookmark ?? new SaveBookmarkUseCase(dataLayer)
        const saveResult = await saveBookmark.saveFromVisitReminder({
          rawUrl: existing.normalizedUrl,
          title: "",
          creationRequestId: `visit-reminder:${input.reminderId}`,
        })
        await reminders.updateResponse(input.reminderId, "SAVED", now, existing.countingResetAt)
        return { state: "SAVED", duplicate: saveResult.duplicate }
      } finally {
        await dataLayer.close()
      }
    }

    const suppress = input.suppressFuture === true
    const state = suppress ? "SUPPRESSED" : input.response === "dismissed" ? "DISMISSED" : "DECLINED"
    await reminders.updateResponse(input.reminderId, state, now, now)
    return { state }
  } finally {
    db.close()
  }
}
