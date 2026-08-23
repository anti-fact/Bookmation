import { openBookmationDatabase } from "~/adapters/indexeddb/open-database"
import { VisitReminderRepository } from "~/adapters/indexeddb/visit-reminder-repository"

export type PendingVisitReminderView = Readonly<{
  reminderId: string
  normalizedUrl: string
  title: string
  visitDays: number
}>

export async function getPendingVisitReminder(): Promise<PendingVisitReminderView | null> {
  const db = await openBookmationDatabase()
  const reminders = new VisitReminderRepository(db)

  try {
    const pending = await reminders.getOldestPending()
    if (!pending) {
      return null
    }

    return {
      reminderId: pending.id,
      normalizedUrl: pending.normalizedUrl,
      title: pending.normalizedUrl,
      visitDays: pending.visitDaysAtReminder,
    }
  } finally {
    db.close()
  }
}
