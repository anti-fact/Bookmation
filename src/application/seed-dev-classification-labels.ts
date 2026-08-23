import type { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import {
  DEV_CLASSIFICATION_LABEL_SEED_VERSION,
  DEV_CLASSIFICATION_LABEL_TREE,
  devCategoryCreationRequestId,
  devTagCreationRequestId,
} from "~/catalogs/dev-classification-labels"
import { DomainErrorCode, isDomainError, normalizeLabelName } from "~/domain"

export type SeedDevClassificationLabelsResult = Readonly<{
  seedVersion: typeof DEV_CLASSIFICATION_LABEL_SEED_VERSION
  categoriesCreated: number
  categoriesReused: number
  tagsCreated: number
  tagsReused: number
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

async function findActiveTagByName(
  layer: LocalDataLayer,
  name: string,
  parentCategoryId: string,
): Promise<{ id: string; name: string; revision: number } | null> {
  const normalized = normalizeLabelName(name).normalized
  const { existingTags } = await layer.listActiveLabelsForClassification()
  const hit = existingTags.find(
    (item) =>
      item.normalizedName === normalized &&
      item.parentCategoryId === parentCategoryId,
  )
  return hit
    ? { id: hit.id, name: hit.name, revision: hit.revision }
    : null
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

async function ensureTag(
  layer: LocalDataLayer,
  args: {
    name: string
    parentCategoryId: string
    expectedParentRevision: number
    creationRequestId: string
  },
): Promise<EnsureLabel> {
  const existing = await findActiveTagByName(
    layer,
    args.name,
    args.parentCategoryId,
  )
  if (existing) {
    return { ...existing, created: false }
  }
  try {
    const created = await layer.createTag({
      id: crypto.randomUUID(),
      name: args.name,
      parentCategoryId: args.parentCategoryId,
      expectedParentRevision: args.expectedParentRevision,
      creationRequestId: args.creationRequestId,
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
      const raced = await findActiveTagByName(
        layer,
        args.name,
        args.parentCategoryId,
      )
      if (raced) {
        return { ...raced, created: false }
      }
    }
    throw error
  }
}

/** 分類 Host 検証用の Category／Tag 木を冪等に投入する。 */
export async function seedDevClassificationLabels(
  layer: LocalDataLayer,
): Promise<SeedDevClassificationLabelsResult> {
  let categoriesCreated = 0
  let categoriesReused = 0
  let tagsCreated = 0
  let tagsReused = 0
  const categories: { id: string; name: string; tagCount: number }[] = []

  for (const categorySpec of DEV_CLASSIFICATION_LABEL_TREE) {
    const category = await ensureCategory(
      layer,
      categorySpec.name,
      devCategoryCreationRequestId(categorySpec.slug),
    )
    if (category.created) categoriesCreated += 1
    else categoriesReused += 1

    let tagCount = 0
    for (const tagSpec of categorySpec.tags) {
      const tag = await ensureTag(layer, {
        name: tagSpec.name,
        parentCategoryId: category.id,
        expectedParentRevision: category.revision,
        creationRequestId: devTagCreationRequestId(
          categorySpec.slug,
          tagSpec.slug,
        ),
      })
      if (tag.created) tagsCreated += 1
      else tagsReused += 1
      tagCount += 1
    }

    categories.push({
      id: category.id,
      name: category.name,
      tagCount,
    })
  }

  return {
    seedVersion: DEV_CLASSIFICATION_LABEL_SEED_VERSION,
    categoriesCreated,
    categoriesReused,
    tagsCreated,
    tagsReused,
    categories,
  }
}
