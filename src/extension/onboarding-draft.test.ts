import { describe, expect, it } from "vitest"

import { CATEGORY_PRESET_CATALOG } from "~/catalogs/onboarding-category-presets"

import {
  reconcileOnboardingState,
  sanitizeCategorySelection
} from "./onboarding-draft"
import type { OnboardingState } from "./onboarding"

const baseState: OnboardingState = {
  catalogVersion: CATEGORY_PRESET_CATALOG.version,
  categorySelection: {},
  currentStepId: "categories",
  initializedBy: "INSTALL",
  schemaVersion: 1,
  status: "IN_PROGRESS",
  updatedAt: 1
}

describe("onboarding draft", () => {
  it("drops unknown categories and tags from a saved selection", () => {
    expect(
      sanitizeCategorySelection(CATEGORY_PRESET_CATALOG, {
        "study.lecture": ["授業ページ", "存在しないタグ"],
        "missing.category": ["資料"]
      })
    ).toEqual({ "study.lecture": ["授業ページ"] })
  })

  it("clears the draft when the catalog version changes", () => {
    const result = reconcileOnboardingState(
      {
        ...baseState,
        catalogVersion: "old-version",
        categorySelection: { "study.lecture": ["授業ページ"] }
      },
      CATEGORY_PRESET_CATALOG
    )

    expect(result.catalogMismatch).toBe(true)
    expect(result.state.categorySelection).toEqual({})
    expect(result.state.catalogVersion).toBe(CATEGORY_PRESET_CATALOG.version)
  })

  it("keeps a matching draft after sanitizing stale preset ids", () => {
    const result = reconcileOnboardingState(
      {
        ...baseState,
        categorySelection: {
          "study.lecture": ["授業ページ"],
          "removed.category": ["資料"]
        }
      },
      CATEGORY_PRESET_CATALOG
    )

    expect(result.catalogMismatch).toBe(false)
    expect(result.state.categorySelection).toEqual({
      "study.lecture": ["授業ページ"]
    })
  })
})
