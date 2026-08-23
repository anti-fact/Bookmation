import { CATEGORY_PRESET_CATALOG } from "~/catalogs/onboarding-category-presets"
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

export class OnboardingPortError extends Error {
  constructor(
    readonly code:
      | "ONBOARDING_CATEGORY_UNKNOWN"
      | "ONBOARDING_TAG_UNKNOWN"
      | "ONBOARDING_TAG_CONFLICT"
  ) {
    super(code)
    this.name = "OnboardingPortError"
  }
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

  return {
    async load() {
      await pendingMutation
      return getOnboardingState(storage)
    },
    start() {
      return serialize(async () => {
        const state = await current()
        return write(
          nextState(state, {
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
        return write(
          nextState(state, {
            categorySelection: cloneSelection(selection),
            currentStepId: "categories",
            status: "IN_PROGRESS"
          })
        )
      })
    },
    complete(selection) {
      return serialize(async () => {
        let state = await current()
        const applyRequestId = state.applyRequestId ?? crypto.randomUUID()
        state = await write(
          nextState(state, {
            applyRequestId,
            categorySelection: cloneSelection(selection),
            currentStepId: "categories",
            status: "IN_PROGRESS"
          })
        )
        const categories = new Map(
          CATEGORY_PRESET_CATALOG.sets.flatMap((set) =>
            set.categories.map((category) => [category.id, category] as const)
          )
        )
        for (const [categoryId, selectedTags] of Object.entries(selection)) {
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
              requestId: `onboarding:${applyRequestId}:category:${preset.id}`
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
              requestId: `onboarding:${applyRequestId}:tag:${preset.id}:${preset.tags.indexOf(tagName)}`
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
