import type { CategoryTemplateCatalog } from "~/catalogs/category-templates"
import { isDomainError } from "~/domain"
import type { CreateCategoryInput } from "~/ports/repositories"

export type CategoryTemplateResult = Readonly<{
  templateId: string
  status: "CREATED" | "FAILED"
  categoryId?: string
  errorCode?: string
}>

export type CategoryTemplateApplyReceipt = Readonly<{
  requestId: string
  requestFingerprint: string
  results: readonly CategoryTemplateResult[]
}>

export interface CategoryTemplateRepository {
  createCategory(input: CreateCategoryInput): Promise<{ id: string; revision: number }>
}

/** requestId の結果を Service Worker 再起動後も保持するための Port。 */
export interface CategoryTemplateReceiptStore {
  get(requestId: string): Promise<CategoryTemplateApplyReceipt | undefined>
  put(receipt: CategoryTemplateApplyReceipt): Promise<void>
}

export class CategoryTemplateApplicationError extends Error {
  constructor(
    readonly code:
      | "CATEGORY_TEMPLATE_CATALOG_VERSION_MISMATCH"
      | "CATEGORY_TEMPLATE_UNKNOWN_ID"
      | "CATEGORY_TEMPLATE_REQUEST_REUSED",
  ) {
    super(code)
    this.name = "CategoryTemplateApplicationError"
  }
}

function fingerprint(catalogVersion: string, templateIds: readonly string[]): string {
  return JSON.stringify({ catalogVersion, templateIds })
}

/** catalog閲覧は参照だけで、Label／onboarding stateを書き換えない。 */
export function getCategoryTemplateCatalog(catalog: CategoryTemplateCatalog): CategoryTemplateCatalog {
  return catalog
}

export async function applyCategoryTemplates(
  input: Readonly<{
    catalogVersion: string
    templateIds: readonly string[]
    requestId: string
  }>,
  dependencies: Readonly<{
    catalog: CategoryTemplateCatalog
    repository: CategoryTemplateRepository
    receipts: CategoryTemplateReceiptStore
  }>,
): Promise<CategoryTemplateApplyReceipt> {
  const requestFingerprint = fingerprint(input.catalogVersion, input.templateIds)
  const prior = await dependencies.receipts.get(input.requestId)
  if (prior) {
    if (prior.requestFingerprint !== requestFingerprint) {
      throw new CategoryTemplateApplicationError("CATEGORY_TEMPLATE_REQUEST_REUSED")
    }
    return prior
  }
  if (input.catalogVersion !== dependencies.catalog.version) {
    throw new CategoryTemplateApplicationError("CATEGORY_TEMPLATE_CATALOG_VERSION_MISMATCH")
  }

  const selected = new Set(input.templateIds)
  if (selected.size !== input.templateIds.length) {
    throw new CategoryTemplateApplicationError("CATEGORY_TEMPLATE_UNKNOWN_ID")
  }
  const byId = new Map(dependencies.catalog.templates.map((template) => [template.id, template]))
  for (const templateId of input.templateIds) {
    if (!byId.has(templateId)) {
      throw new CategoryTemplateApplicationError("CATEGORY_TEMPLATE_UNKNOWN_ID")
    }
  }

  const results: CategoryTemplateResult[] = []
  for (const templateId of input.templateIds) {
    const template = byId.get(templateId)!
    try {
      const category = await dependencies.repository.createCategory({
        id: crypto.randomUUID(),
        name: template.name,
        // Stable per request and catalog item: a retry reaches BE-05's normal
        // CreateCategory idempotency rather than creating another Category.
        creationRequestId: `category-template:${input.requestId}:${template.id}`,
      })
      results.push({ templateId, status: "CREATED", categoryId: category.id })
    } catch (error) {
      results.push({
        templateId,
        status: "FAILED",
        errorCode: isDomainError(error)
          ? error.code
          : error instanceof Error
            ? error.name
            : "UNKNOWN_ERROR",
      })
    }
  }

  const receipt: CategoryTemplateApplyReceipt = {
    requestId: input.requestId,
    requestFingerprint,
    results,
  }
  await dependencies.receipts.put(receipt)
  return receipt
}
