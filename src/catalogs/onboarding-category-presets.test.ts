// 提示候補が Label の一意名制約をそのまま満たすことを、正規化まで含めて確認します。
import { describe, expect, it } from "vitest"

import { normalizeLabelName } from "~/domain/normalizer"

import { CATEGORY_PRESET_CATALOG } from "./onboarding-category-presets"

const categories = CATEGORY_PRESET_CATALOG.sets.flatMap((set) => set.categories)

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }
  return [...duplicates]
}

describe("CATEGORY_PRESET_CATALOG", () => {
  it("keeps every set id, category id and category name unique", () => {
    expect(
      findDuplicates(CATEGORY_PRESET_CATALOG.sets.map((set) => set.id))
    ).toEqual([])
    expect(
      findDuplicates(categories.map((category) => category.id))
    ).toEqual([])
    expect(
      findDuplicates(
        categories.map(
          (category) => normalizeLabelName(category.name).normalized
        )
      )
    ).toEqual([])
  })

  it("keeps tag names unique across parent categories", () => {
    // tagUniqueName は親をまたいで global unique なので、set 単位ではなく全体で確認します。
    const tagNames = categories.flatMap((category) =>
      category.tags.map((tag) => normalizeLabelName(tag).normalized)
    )

    expect(findDuplicates(tagNames)).toEqual([])
  })

  it("keeps icons distinct inside a set so neighbouring cards stay tellable apart", () => {
    for (const set of CATEGORY_PRESET_CATALOG.sets) {
      expect({
        setId: set.id,
        duplicates: findDuplicates(
          set.categories.map((category) => category.icon)
        )
      }).toEqual({ setId: set.id, duplicates: [] })
    }
  })

  it("gives every category at least one tag", () => {
    const empty = categories.filter((category) => category.tags.length === 0)

    expect(empty).toEqual([])
  })
})
