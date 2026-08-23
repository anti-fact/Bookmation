import type { CategoryPresetCatalog } from "~/catalogs/onboarding-category-presets"
import type { CategoryPresetSelection } from "~/ui/features/onboarding/OnboardingCategoriesPage"

import type { OnboardingState } from "./onboarding"

export type OnboardingReconcileResult = Readonly<{
  catalogMismatch: boolean
  state: OnboardingState
}>

function presetById(catalog: CategoryPresetCatalog) {
  return new Map(
    catalog.sets.flatMap((set) =>
      set.categories.map((category) => [category.id, category] as const)
    )
  )
}

/** 現行 catalog に存在しない category / tag を draft から取り除きます。 */
export function sanitizeCategorySelection(
  catalog: CategoryPresetCatalog,
  selection: CategoryPresetSelection
): CategoryPresetSelection {
  const categories = presetById(catalog)
  const sanitized: Record<string, string[]> = {}

  for (const [categoryId, tags] of Object.entries(selection)) {
    const preset = categories.get(categoryId)
    if (!preset) continue

    const validTags = [...new Set(tags)].filter((tag) => preset.tags.includes(tag))
    if (validTags.length > 0) {
      sanitized[categoryId] = validTags
    }
  }

  return sanitized
}

export function reconcileOnboardingState(
  state: OnboardingState,
  catalog: CategoryPresetCatalog
): OnboardingReconcileResult {
  const catalogMismatch =
    state.catalogVersion !== undefined &&
    state.catalogVersion !== catalog.version

  if (catalogMismatch) {
    return {
      catalogMismatch: true,
      state: {
        ...state,
        catalogVersion: catalog.version,
        categorySelection: {}
      }
    }
  }

  const categorySelection = sanitizeCategorySelection(
    catalog,
    state.categorySelection ?? {}
  )

  return {
    catalogMismatch: false,
    state: {
      ...state,
      catalogVersion: state.catalogVersion ?? catalog.version,
      categorySelection: cloneSelection(categorySelection)
    }
  }
}

function cloneSelection(selection: CategoryPresetSelection): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(selection).map(([categoryId, tags]) => [categoryId, [...tags]])
  )
}
