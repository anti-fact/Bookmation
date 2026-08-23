import type { BookmationDatabase } from "./open-database"
import type { PersistedVisitReminderRecord } from "./persisted-types"
import { computeUrlHash } from "./crypto-utils"
import { STORES, VISIT_REMINDER_INDEXES } from "./stores"
import { VISIT_REMINDER_SCHEMA_VERSION, type VisitReminderState } from "~/domain/visit-reminder"

export class VisitReminderRepository {
  constructor(private readonly db: BookmationDatabase) {}

  async getByUrlHash(normalizedUrlHash: string): Promise<PersistedVisitReminderRecord | undefined> {
    return this.db.getFromIndex(
      STORES.visitReminders,
      VISIT_REMINDER_INDEXES.byNormalizedUrlHash,
      normalizedUrlHash,
    )
  }

  async getById(reminderId: string): Promise<PersistedVisitReminderRecord | undefined> {
    return this.db.get(STORES.visitReminders, reminderId)
  }

  async put(record: PersistedVisitReminderRecord): Promise<void> {
    await this.db.put(STORES.visitReminders, record)
  }

  async createPending(input: {
    id: string
    normalizedUrl: string
    window: PersistedVisitReminderRecord["window"]
    windowStartedAt: number
    visitDaysAtReminder: number
    countingResetAt: number | null
    now: number
  }): Promise<PersistedVisitReminderRecord> {
    const normalizedUrlHash = await computeUrlHash(input.normalizedUrl)
    const existing = await this.getByUrlHash(normalizedUrlHash)
    const record: PersistedVisitReminderRecord = {
      schemaVersion: VISIT_REMINDER_SCHEMA_VERSION,
      id: existing?.id ?? input.id,
      normalizedUrlHash,
      normalizedUrl: input.normalizedUrl,
      window: input.window,
      windowStartedAt: input.windowStartedAt,
      visitDaysAtReminder: input.visitDaysAtReminder,
      countingResetAt: input.countingResetAt,
      state: "PENDING",
      remindedAt: input.now,
      respondedAt: null,
      createdAt: existing?.createdAt ?? input.now,
      updatedAt: input.now,
    }
    await this.put(record)
    return record
  }

  async updateResponse(
    reminderId: string,
    state: VisitReminderState,
    now: number,
    countingResetAt: number | null,
  ): Promise<PersistedVisitReminderRecord | undefined> {
    const existing = await this.db.get(STORES.visitReminders, reminderId)
    if (!existing) {
      return undefined
    }
    const updated: PersistedVisitReminderRecord = {
      ...existing,
      state,
      respondedAt: now,
      countingResetAt,
      updatedAt: now,
    }
    await this.put(updated)
    return updated
  }

  async getOldestPending(): Promise<PersistedVisitReminderRecord | undefined> {
    const pending = await this.db.getAllFromIndex(
      STORES.visitReminders,
      VISIT_REMINDER_INDEXES.byState,
      "PENDING",
    )
    pending.sort((left, right) => left.remindedAt - right.remindedAt || left.id.localeCompare(right.id))
    return pending[0]
  }
}
