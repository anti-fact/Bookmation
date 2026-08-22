import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"

import { openBookmationDatabase } from "./open-database"
import { CLASSIFICATION_JOB_INDEXES, DB_NAME, STORES } from "./stores"

describe("openBookmationDatabase", () => {
  afterEach(() => {
    indexedDB.deleteDatabase(DB_NAME)
  })

  it("opens the default database at version 1 with required indexes", async () => {
    const db = await openBookmationDatabase()
    expect(db.name).toBe(DB_NAME)
    expect(db.version).toBe(1)

    const tx = db.transaction(STORES.classificationJobs, "readonly")
    expect(tx.store.indexNames.contains(CLASSIFICATION_JOB_INDEXES.byRequestId)).toBe(true)
    await tx.done
    db.close()
  })
})
