import type { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import {
  DEV_CLASSIFICATION_CATEGORY_SEED,
  DEV_CLASSIFICATION_LABEL_SEED_VERSION,
  devCategoryCreationRequestId,
} from "~/catalogs/dev-classification-labels"
import { DomainErrorCode, isDomainError, normalizeLabelName } from "~/domain"

export type SeedDevClassificationLabelsResult = Readonly<{
  seedVersion: typeof DEV_CLASSIFICATION_LABEL_SEED_VERSION
  categoriesCreated: number
  categoriesReused: number
  tagsCreated: 0
  tagsReused: 0
  categories: readonly { id: string; name: string; tagCount: number }[]
}>

type EnsureLabel = Readonly<{
  id: string
  name: string
  revision: number
  created: boolean
}>

async function findActiveCategoryByName(
  layer: LocalDataLayer,
  name: string,
): Promise<{ id: string; name: string; revision: number } | null> {
  const normalized = normalizeLabelName(name).normalized
  const { categories } = await layer.listActiveLabelsForClassification()
  const hit = categories.find((item) => item.name === normalized)
  return hit ?? null
}

async function ensureCategory(
  layer: LocalDataLayer,
  name: string,
  creationRequestId: string,
): Promise<EnsureLabel> {
  const existing = await findActiveCategoryByName(layer, name)
  if (existing) {
    return { ...existing, created: false }
  }
  try {
    const created = await layer.createCategory({
      id: crypto.randomUUID(),
      name,
      creationRequestId,
    })
    return {
      id: created.id,
      name: created.name,
      revision: created.revision,
      created: true,
    }
  } catch (error) {
    if (
      isDomainError(error) &&
      error.code === DomainErrorCode.DUPLICATE_NORMALIZED_NAME
    ) {
      const raced = await findActiveCategoryByName(layer, name)
      if (raced) {
        return { ...raced, created: false }
      }
    }
    throw error
  }
}

/** Category のみ冪等投入する。Tag は作成しない。 */
export async function seedDevClassificationLabels(
  layer: LocalDataLayer,
): Promise<SeedDevClassificationLabelsResult> {
  let categoriesCreated = 0
  let categoriesReused = 0
  const categories: { id: string; name: string; tagCount: number }[] = []

  for (const categorySpec of DEV_CLASSIFICATION_CATEGORY_SEED) {
    const category = await ensureCategory(
      layer,
      categorySpec.name,
      devCategoryCreationRequestId(categorySpec.slug),
    )
    if (category.created) categoriesCreated += 1
    else categoriesReused += 1

    categories.push({
      id: category.id,
      name: category.name,
      tagCount: 0,
    })
  }

  return {
    seedVersion: DEV_CLASSIFICATION_LABEL_SEED_VERSION,
    categoriesCreated,
    categoriesReused,
    tagsCreated: 0,
    tagsReused: 0,
    categories,
  }
}
