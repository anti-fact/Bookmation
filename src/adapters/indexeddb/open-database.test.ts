import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"

import { openBookmationDatabase } from "./open-database"
import {
  CLASSIFICATION_JOB_INDEXES,
  DB_NAME,
  STORES,
  VISIT_REMINDER_INDEXES,
} from "./stores"

describe("openBookmationDatabase", () => {
  afterEach(() => {
    indexedDB.deleteDatabase(DB_NAME)
  })

  it("opens the default database at version 2 with required indexes", async () => {
    const db = await openBookmationDatabase()
    expect(db.name).toBe(DB_NAME)
    expect(db.version).toBe(2)

    const jobTx = db.transaction(STORES.classificationJobs, "readonly")
    expect(jobTx.store.indexNames.contains(CLASSIFICATION_JOB_INDEXES.byRequestId)).toBe(
      true,
    )
    await jobTx.done

    const reminderTx = db.transaction(STORES.visitReminders, "readonly")
    expect(
      reminderTx.store.indexNames.contains(VISIT_REMINDER_INDEXES.byNormalizedUrlHash),
    ).toBe(true)
    await reminderTx.done
    db.close()
  })
})
