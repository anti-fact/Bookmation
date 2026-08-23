import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { DEV_CLASSIFICATION_CATEGORY_SEED } from "~/catalogs/dev-classification-labels"
import { seedDevClassificationLabels } from "./seed-dev-classification-labels"

function testDbName(): string {
  return `bookmation-seed-test-${crypto.randomUUID()}`
}

describe("seedDevClassificationLabels", () => {
  let dbName: string
  let layer: LocalDataLayer

  beforeEach(async () => {
    dbName = testDbName()
    layer = await LocalDataLayer.open(dbName)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  it("creates categories only (no tags)", async () => {
    const first = await seedDevClassificationLabels(layer)
    expect(first.categoriesCreated).toBe(DEV_CLASSIFICATION_CATEGORY_SEED.length)
    expect(first.tagsCreated).toBe(0)

    const labels = await layer.listActiveLabelsForClassification()
    expect(labels.categories).toHaveLength(DEV_CLASSIFICATION_CATEGORY_SEED.length)
    expect(labels.existingTags).toHaveLength(0)
  })

  it("is idempotent on second run", async () => {
    await seedDevClassificationLabels(layer)
    const second = await seedDevClassificationLabels(layer)

    expect(second.categoriesCreated).toBe(0)
    expect(second.categoriesReused).toBe(DEV_CLASSIFICATION_CATEGORY_SEED.length)
    expect(second.tagsCreated).toBe(0)
  })
})
