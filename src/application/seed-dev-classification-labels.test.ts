import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { DEV_CLASSIFICATION_LABEL_TREE } from "~/catalogs/dev-classification-labels"
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

  it("creates the fixed category/tag tree", async () => {
    const expectedCategories = DEV_CLASSIFICATION_LABEL_TREE.length
    const expectedTags = DEV_CLASSIFICATION_LABEL_TREE.reduce(
      (sum, category) => sum + category.tags.length,
      0,
    )

    const first = await seedDevClassificationLabels(layer)
    expect(first.categoriesCreated).toBe(expectedCategories)
    expect(first.tagsCreated).toBe(expectedTags)
    expect(first.categoriesReused).toBe(0)
    expect(first.tagsReused).toBe(0)

    const labels = await layer.listActiveLabelsForClassification()
    expect(labels.categories).toHaveLength(expectedCategories)
    expect(labels.existingTags).toHaveLength(expectedTags)
    expect(labels.categories.map((c) => c.name).sort()).toEqual(
      [...DEV_CLASSIFICATION_LABEL_TREE.map((c) => c.name)].sort(),
    )
  })

  it("is idempotent on second run", async () => {
    await seedDevClassificationLabels(layer)
    const second = await seedDevClassificationLabels(layer)

    expect(second.categoriesCreated).toBe(0)
    expect(second.tagsCreated).toBe(0)
    expect(second.categoriesReused).toBe(DEV_CLASSIFICATION_LABEL_TREE.length)
    expect(second.tagsReused).toBe(
      DEV_CLASSIFICATION_LABEL_TREE.reduce(
        (sum, category) => sum + category.tags.length,
        0,
      ),
    )
  })
})
