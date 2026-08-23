import { CATEGORY_PRESET_CATALOG } from "~/catalogs/onboarding-category-presets"
import {
  reconcileOnboardingState,
  sanitizeCategorySelection
} from "~/extension/onboarding-draft"
import {
  getOnboardingState,
  initializeOnboardingIfMissing,
  ONBOARDING_STATE_KEY,
  type OnboardingState,
  type OnboardingStorage
} from "~/extension/onboarding"
import type { BookmarkFormPort } from "~/ui/features/bookmarks/bookmark-form-port"
import type { CategoryPresetSelection } from "~/ui/features/onboarding/OnboardingCategoriesPage"
import type { OnboardingPort } from "~/ui/features/onboarding/onboarding-port"

import {
  OnboardingPortError,
  toOnboardingRequestToken
} from "~/extension/onboarding-errors"

import { createChromeBookmarkFormPort } from "./chrome-bookmark-form-port"

function cloneSelection(selection: CategoryPresetSelection) {
  return Object.fromEntries(
    Object.entries(selection).map(([categoryId, tags]) => [
      categoryId,
      [...tags]
    ])
  )
}

function nextState(
  current: OnboardingState,
  patch: Partial<OnboardingState>
): OnboardingState {
  return { ...current, ...patch, updatedAt: Date.now() }
}

export function createChromeOnboardingPort({
  bookmarkFormPort = createChromeBookmarkFormPort(),
  storage = chrome.storage.local
}: {
  bookmarkFormPort?: BookmarkFormPort
  storage?: OnboardingStorage
} = {}): OnboardingPort {
  const write = async (state: OnboardingState) => {
    await storage.set({ [ONBOARDING_STATE_KEY]: state })
    return state
  }
  const current = async () => initializeOnboardingIfMissing(storage)
  let pendingMutation: Promise<void> = Promise.resolve()
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = pendingMutation.then(operation, operation)
    pendingMutation = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
  const persistIfChanged = async (
    original: OnboardingState,
    reconciled: ReturnType<typeof reconcileOnboardingState>
  ) => {
    const selectionChanged =
      JSON.stringify(reconciled.state.categorySelection ?? {}) !==
      JSON.stringify(original.categorySelection ?? {})
    const versionChanged =
      reconciled.state.catalogVersion !== original.catalogVersion
    if (reconciled.catalogMismatch || selectionChanged || versionChanged) {
      await write(reconciled.state)
    }
    return reconciled
  }
  const loadReconciled = async () => {
    const state = await getOnboardingState(storage)
    if (!state) return null
    const reconciled = reconcileOnboardingState(state, CATEGORY_PRESET_CATALOG)
    return persistIfChanged(state, reconciled)
  }

  return {
    async load() {
      await pendingMutation
      const reconciled = await loadReconciled()
      return reconciled?.state ?? null
    },
    async loadWithMeta() {
      await pendingMutation
      return loadReconciled()
    },
    start() {
      return serialize(async () => {
        const state = await current()
        return write(
          nextState(state, {
            catalogVersion: CATEGORY_PRESET_CATALOG.version,
            categorySelection: state.categorySelection ?? {},
            currentStepId: "categories",
            status: "IN_PROGRESS"
          })
        )
      })
    },
    saveSelection(selection) {
      return serialize(async () => {
        const state = await current()
        const categorySelection = sanitizeCategorySelection(
          CATEGORY_PRESET_CATALOG,
          selection
        )
        return write(
          nextState(state, {
            catalogVersion: CATEGORY_PRESET_CATALOG.version,
            categorySelection: cloneSelection(categorySelection),
            currentStepId: "categories",
            status: "IN_PROGRESS"
          })
        )
      })
    },
    skip() {
      return serialize(async () => {
        const state = await current()
        return write(
          nextState(state, {
            catalogVersion: CATEGORY_PRESET_CATALOG.version,
            categorySelection: {},
            currentStepId: null,
            status: "COMPLETED"
          })
        )
      })
    },
    complete(selection) {
      return serialize(async () => {
        let state = await current()
        const sanitized = sanitizeCategorySelection(
          CATEGORY_PRESET_CATALOG,
          selection
        )
        const applyRequestId = state.applyRequestId ?? crypto.randomUUID()
        state = await write(
          nextState(state, {
            applyRequestId,
            catalogVersion: CATEGORY_PRESET_CATALOG.version,
            categorySelection: cloneSelection(sanitized),
            currentStepId: "categories",
            status: "IN_PROGRESS"
          })
        )
        const categories = new Map(
          CATEGORY_PRESET_CATALOG.sets.flatMap((set) =>
            set.categories.map((category) => [category.id, category] as const)
          )
        )
        for (const [categoryId, selectedTags] of Object.entries(sanitized)) {
          const preset = categories.get(categoryId)
          if (!preset)
            throw new OnboardingPortError("ONBOARDING_CATEGORY_UNKNOWN")
          const uniqueTags = [...new Set(selectedTags)]
          if (uniqueTags.some((tag) => !preset.tags.includes(tag)))
            throw new OnboardingPortError("ONBOARDING_TAG_UNKNOWN")

          const categoryCandidates = await bookmarkFormPort.searchCategories(
            preset.name
          )
          const category =
            categoryCandidates.find((item) => item.name === preset.name) ??
            (await bookmarkFormPort.createCategory({
              name: preset.name,
              requestId: `onboarding:${applyRequestId}:category:${toOnboardingRequestToken(preset.id)}`
            }))

          for (const tagName of uniqueTags) {
            const tagCandidates = await bookmarkFormPort.searchTags(tagName)
            const existing = tagCandidates.find((item) => item.name === tagName)
            if (existing) {
              if (existing.parentCategoryId !== category.id)
                throw new OnboardingPortError("ONBOARDING_TAG_CONFLICT")
              continue
            }
            await bookmarkFormPort.createTag({
              category,
              name: tagName,
              requestId: `onboarding:${applyRequestId}:tag:${toOnboardingRequestToken(preset.id)}:${preset.tags.indexOf(tagName)}`
            })
          }
        }

        return write(
          nextState(state, {
            categorySelection: {},
            currentStepId: null,
            status: "COMPLETED"
          })
        )
      })
    }
  }
}
