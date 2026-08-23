import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import type { ExtensionMessageRequest } from "~/extension/messages"

import { handleClassificationJobMessage } from "./classification-job-application"

function uuid(): string {
  return crypto.randomUUID()
}

describe("handleClassificationJobMessage", () => {
  let dbName: string
  let layer: LocalDataLayer

  beforeEach(async () => {
    dbName = `classification-application-test-${uuid()}`
    layer = await LocalDataLayer.open(dbName)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  it("returns every active label required by the classification host", async () => {
    const category = await layer.createCategory({
      id: uuid(),
      name: "Development",
      creationRequestId: uuid()
    })
    const tags = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        layer.createTag({
          id: uuid(),
          name: `Tag ${index}`,
          parentCategoryId: category.id,
          expectedParentRevision: category.revision,
          creationRequestId: uuid()
        })
      )
    )
    await layer.saveBookmarkWithJob({
      id: uuid(),
      rawUrl: "https://example.com/classify",
      title: "Classification target",
      creationRequestId: uuid(),
      jobId: uuid()
    })
    const request: ExtensionMessageRequest = {
      schemaVersion: 1,
      requestId: uuid(),
      source: "ai-host",
      action: "claim-classification-job",
      payload: { executorInstanceId: uuid() }
    }

    const response = await handleClassificationJobMessage(layer, request)

    expect(response?.ok).toBe(true)
    if (!response?.ok) throw new Error("Expected a successful response")
    const data = response.data as { labels: Array<Record<string, unknown>> }
    expect(data.labels).toHaveLength(11)
    expect(data.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: category.id,
          kind: "CATEGORY",
          name: "development"
        }),
        expect.objectContaining({
          id: tags[9].id,
          kind: "TAG",
          parentCategoryId: category.id,
          parentCategoryName: "development"
        })
      ])
    )
  })
})
