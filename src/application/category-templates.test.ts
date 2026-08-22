import { describe, expect, it, vi } from "vitest"

import type { CategoryTemplateCatalog } from "~/catalogs/category-templates"

import {
  CategoryTemplateApplicationError,
  applyCategoryTemplates,
  getCategoryTemplateCatalog,
  type CategoryTemplateApplyReceipt,
} from "./category-templates"

const catalog: CategoryTemplateCatalog = {
  version: "test-v1",
  locale: "ja",
  templates: [
    { id: "work", name: "仕事", setId: "starter" },
    { id: "learning", name: "学習", setId: "starter" },
  ],
}

function dependencies() {
  const receipts = new Map<string, CategoryTemplateApplyReceipt>()
  return {
    catalog,
    repository: { createCategory: vi.fn().mockImplementation(async (input) => ({ id: input.id, revision: 1 })) },
    receipts: {
      get: vi.fn(async (requestId: string) => receipts.get(requestId)),
      put: vi.fn(async (receipt: CategoryTemplateApplyReceipt) => void receipts.set(receipt.requestId, receipt)),
    },
  }
}

describe("Category templates", () => {
  it("reads the bundled catalog without writing Categories", () => {
    expect(getCategoryTemplateCatalog(catalog)).toBe(catalog)
  })

  it("applies only explicit template IDs through CreateCategory and replays the receipt", async () => {
    const deps = dependencies()
    const input = { catalogVersion: catalog.version, templateIds: ["work"], requestId: "apply-1" }

    const first = await applyCategoryTemplates(input, deps)
    const retry = await applyCategoryTemplates(input, deps)

    expect(first.results).toHaveLength(1)
    expect(retry).toEqual(first)
    expect(deps.repository.createCategory).toHaveBeenCalledTimes(1)
    expect(deps.repository.createCategory).toHaveBeenCalledWith(expect.objectContaining({
      name: "仕事",
      creationRequestId: "category-template:apply-1:work",
    }))
  })

  it("rejects catalog mismatch, unknown IDs, and request ID reuse with another payload", async () => {
    const deps = dependencies()
    await expect(applyCategoryTemplates({ catalogVersion: "old", templateIds: [], requestId: "a" }, deps)).rejects.toBeInstanceOf(CategoryTemplateApplicationError)
    await expect(applyCategoryTemplates({ catalogVersion: catalog.version, templateIds: ["missing"], requestId: "a" }, deps)).rejects.toMatchObject({ code: "CATEGORY_TEMPLATE_UNKNOWN_ID" })
    await applyCategoryTemplates({ catalogVersion: catalog.version, templateIds: ["work"], requestId: "a" }, deps)
    await expect(applyCategoryTemplates({ catalogVersion: catalog.version, templateIds: ["learning"], requestId: "a" }, deps)).rejects.toMatchObject({ code: "CATEGORY_TEMPLATE_REQUEST_REUSED" })
  })
})
