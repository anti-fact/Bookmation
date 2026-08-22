/**
 * Label domain 単体テスト
 */
import { describe, it, expect } from "vitest"
import {
  assertLabelInvariants,
  assertNoCategoryNameConflict,
  assertNoTagNameConflict,
  assertCategoryGcAllowed,
} from "~/domain/label"
import { DomainErrorCode } from "~/domain/errors"
import type { LabelRecord } from "~/domain/label"

function makeCategoryRecord(
  overrides: Partial<LabelRecord> = {},
): LabelRecord {
  return {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000001",
    name: "Python",
    normalizedName: "python",
    nameNormalizationVersion: 1,
    categoryUniqueName: "python",
    kind: "CATEGORY",
    parentCategoryId: null,
    origin: "USER",
    creationRequestId: "req-001",
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    revision: 0,
    deletedAt: null,
    cascadeDeleteRequestId: null,
    ...overrides,
  }
}

function makeTagRecord(
  overrides: Partial<LabelRecord> = {},
): LabelRecord {
  return {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000002",
    name: "Django",
    normalizedName: "django",
    nameNormalizationVersion: 1,
    tagUniqueName: "django",
    kind: "TAG",
    parentCategoryId: "00000000-0000-4000-8000-000000000001",
    origin: "USER",
    creationRequestId: "req-002",
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    revision: 0,
    deletedAt: null,
    cascadeDeleteRequestId: null,
    ...overrides,
  }
}

describe("assertLabelInvariants", () => {
  describe("CATEGORY", () => {
    it("正常ケースでエラーを投げない", () => {
      const cat = makeCategoryRecord()
      expect(() => assertLabelInvariants(cat, null)).not.toThrow()
    })

    it("origin=AI は拒否する", () => {
      const cat = makeCategoryRecord({ origin: "AI" })
      expect(() => assertLabelInvariants(cat, null)).toThrow(
        DomainErrorCode.CATEGORY_ORIGIN_MUST_BE_USER,
      )
    })

    it("origin=IMPORT は拒否する", () => {
      const cat = makeCategoryRecord({ origin: "IMPORT" })
      expect(() => assertLabelInvariants(cat, null)).toThrow(
        DomainErrorCode.CATEGORY_ORIGIN_MUST_BE_USER,
      )
    })

    it("parentCategoryId が非 null なら拒否する", () => {
      const cat = makeCategoryRecord({
        parentCategoryId: "00000000-0000-4000-8000-000000000099",
      })
      expect(() => assertLabelInvariants(cat, null)).toThrow(
        DomainErrorCode.CATEGORY_PARENT_MUST_BE_NULL,
      )
    })

    it("categoryUniqueName が normalizedName と不一致なら拒否する", () => {
      const cat = makeCategoryRecord({ categoryUniqueName: "other" })
      expect(() => assertLabelInvariants(cat, null)).toThrow(
        DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
      )
    })
  })

  describe("TAG", () => {
    const parent = makeCategoryRecord()

    it("正常ケースでエラーを投げない", () => {
      const tag = makeTagRecord()
      expect(() => assertLabelInvariants(tag, parent)).not.toThrow()
    })

    it("active TAG に active CATEGORY 親 → OK", () => {
      const tag = makeTagRecord({ deletedAt: null })
      const activeCat = makeCategoryRecord({ deletedAt: null })
      expect(() => assertLabelInvariants(tag, activeCat)).not.toThrow()
    })

    it("active TAG に deleted CATEGORY 親 → 拒否", () => {
      const tag = makeTagRecord({ deletedAt: null })
      const deletedCat = makeCategoryRecord({ deletedAt: 1000 })
      expect(() => assertLabelInvariants(tag, deletedCat)).toThrow(
        DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT,
      )
    })

    it("tombstone TAG に deleted CATEGORY 親 → 許可", () => {
      const tag = makeTagRecord({ deletedAt: 1000 })
      const deletedCat = makeCategoryRecord({ deletedAt: 500 })
      expect(() => assertLabelInvariants(tag, deletedCat)).not.toThrow()
    })

    it("親 CATEGORY record が null → 拒否", () => {
      const tag = makeTagRecord()
      expect(() => assertLabelInvariants(tag, null)).toThrow(
        DomainErrorCode.TAG_PARENT_CATEGORY_RECORD_MISSING,
      )
    })

    it("parentCategoryId が null → 拒否", () => {
      const tag = makeTagRecord({ parentCategoryId: null })
      expect(() => assertLabelInvariants(tag, parent)).toThrow(
        DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT,
      )
    })

    it("tagUniqueName が normalizedName と不一致なら拒否", () => {
      const tag = makeTagRecord({ tagUniqueName: "other" })
      expect(() => assertLabelInvariants(tag, parent)).toThrow(
        DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
      )
    })
  })
})

describe("assertNoCategoryNameConflict", () => {
  it("既存レコードと名前が一致しない → OK", () => {
    const existing = [makeCategoryRecord({ normalizedName: "javascript" })]
    expect(() => assertNoCategoryNameConflict("python", existing)).not.toThrow()
  })

  it("active レコードと名前が一致 → 拒否", () => {
    const existing = [makeCategoryRecord({ normalizedName: "python", deletedAt: null })]
    expect(() => assertNoCategoryNameConflict("python", existing)).toThrow(
      DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
    )
  })

  it("tombstone レコードと名前が一致 → 拒否 (tombstone も予約)", () => {
    const existing = [makeCategoryRecord({ normalizedName: "python", deletedAt: 1000 })]
    expect(() => assertNoCategoryNameConflict("python", existing)).toThrow(
      DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
    )
  })

  it("excludeId が一致するレコードはスキップ → OK", () => {
    const existing = [makeCategoryRecord({ id: "00000000-0000-4000-8000-000000000001", normalizedName: "python" })]
    expect(() =>
      assertNoCategoryNameConflict("python", existing, "00000000-0000-4000-8000-000000000001"),
    ).not.toThrow()
  })
})

describe("assertNoTagNameConflict", () => {
  it("既存と名前が一致しない → OK", () => {
    const existing = [makeTagRecord({ normalizedName: "flask" })]
    expect(() => assertNoTagNameConflict("django", existing)).not.toThrow()
  })

  it("tombstone TAG と名前が一致 → 拒否 (グローバル予約)", () => {
    const existing = [makeTagRecord({ normalizedName: "django", deletedAt: 1000 })]
    expect(() => assertNoTagNameConflict("django", existing)).toThrow(
      DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
    )
  })
})

describe("assertCategoryGcAllowed", () => {
  const catId = "00000000-0000-4000-8000-000000000001"

  it("子 TAG なし → GC 許可", () => {
    expect(() => assertCategoryGcAllowed(catId, [])).not.toThrow()
  })

  it("子 TAG 残存 → GC 拒否", () => {
    const childTag = makeTagRecord({ parentCategoryId: catId })
    expect(() => assertCategoryGcAllowed(catId, [childTag])).toThrow(
      DomainErrorCode.TAG_PARENT_CATEGORY_RECORD_MISSING,
    )
  })

  it("他の Category の TAG は影響しない", () => {
    const otherCatTag = makeTagRecord({
      parentCategoryId: "00000000-0000-4000-8000-000000000099",
    })
    expect(() => assertCategoryGcAllowed(catId, [otherCatTag])).not.toThrow()
  })
})
