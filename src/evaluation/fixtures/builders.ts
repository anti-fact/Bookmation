/**
 * 評価fixture組み立てヘルパー（合成データのみ。個人Bookmark不可）
 */
import { emptyPromptMeta } from "../prompt-input"
import type {
  ClassificationEvaluationFixtureCommonV3,
  ClassificationEvaluationFixtureV3,
  EquivalenceFormV3,
  Granularity,
  NonAmbiguousEvaluationCaseV3,
  TagImportance,
} from "../types"

type ConceptDef = {
  conceptId: string
  importance: TagImportance
  acceptableReuseTagIds?: string[]
  acceptableCreateNormalizedNames?: string[]
  /** granularity → action。未指定は OMIT */
  actions: Partial<Record<Granularity, "REUSE" | "CREATE" | "OMIT">>
}

function expectationsFromActions(
  actions: ConceptDef["actions"],
): ClassificationEvaluationFixtureCommonV3["concepts"][number]["expectations"] {
  return ([0, 1, 2, 3, 4] as Granularity[]).map((granularity) => ({
    granularity,
    action: actions[granularity] ?? "OMIT",
  }))
}

export function buildConcepts(
  defs: ConceptDef[],
): ClassificationEvaluationFixtureCommonV3["concepts"] {
  return defs.map((d) => ({
    conceptId: d.conceptId,
    importance: d.importance,
    acceptableReuseTagIds: d.acceptableReuseTagIds ?? [],
    acceptableCreateNormalizedNames: d.acceptableCreateNormalizedNames ?? [],
    expectations: expectationsFromActions(d.actions),
  }))
}

type Cat = { id: string; name: string; revision?: number }
type Tag = {
  id: string
  name: string
  parentCategoryId: string
  origin?: "USER" | "AI" | "IMPORT" | "SHARE"
  revision?: number
  parentCategoryRevision?: number
}

export function buildBaseInput(args: {
  title: string
  normalizedUrl: string
  categories: Cat[]
  existingTags: Tag[]
}): ClassificationEvaluationFixtureCommonV3["baseInput"] {
  const cats = [...args.categories].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )
  const originOrder = { USER: 0, AI: 1, IMPORT: 2, SHARE: 3 } as const
  const tags = [...args.existingTags].sort((a, b) => {
    const oa = originOrder[a.origin ?? "USER"]
    const ob = originOrder[b.origin ?? "USER"]
    if (oa !== ob) return oa - ob
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  return {
    ...emptyPromptMeta(),
    bookmark: {
      title: args.title,
      normalizedUrl: args.normalizedUrl,
    },
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      revision: c.revision ?? 1,
      tags: tags
        .filter((t) => t.parentCategoryId === c.id)
        .map((t) => ({
          id: t.id,
          name: t.name,
          origin: t.origin ?? "USER",
          revision: t.revision ?? 1,
        })),
    })),
    existingTags: tags.map((t) => {
      const parent = cats.find((c) => c.id === t.parentCategoryId)!
      return {
        id: t.id,
        name: t.name,
        origin: t.origin ?? "USER",
        revision: t.revision ?? 1,
        parentCategoryId: t.parentCategoryId,
        parentCategoryRevision: t.parentCategoryRevision ?? parent.revision ?? 1,
      }
    }),
  }
}

export function nonAmbiguousFixture(args: {
  fixtureId: string
  expectedCategoryId: string
  evaluationCase: NonAmbiguousEvaluationCaseV3
  title: string
  normalizedUrl: string
  categories: Cat[]
  existingTags: Tag[]
  activeTagIds?: string[]
  reservedTagTombstoneNormalizedNames?: string[]
  bookmarkId?: string
  bookmarkRevision?: number
  concepts: ConceptDef[]
}): ClassificationEvaluationFixtureV3 {
  return {
    fixtureId: args.fixtureId,
    expectedCategoryId: args.expectedCategoryId,
    evaluationCase: args.evaluationCase,
    baseInput: buildBaseInput({
      title: args.title,
      normalizedUrl: args.normalizedUrl,
      categories: args.categories,
      existingTags: args.existingTags,
    }),
    initialState: {
      bookmarkId: args.bookmarkId ?? `bm-${args.fixtureId}`,
      bookmarkRevision: args.bookmarkRevision ?? 1,
      activeTagIds: args.activeTagIds ?? [],
      reservedTagTombstoneNormalizedNames:
        args.reservedTagTombstoneNormalizedNames ?? [],
    },
    concepts: buildConcepts(args.concepts),
  }
}

export function ambiguousFixture(args: {
  fixtureId: string
  title: string
  normalizedUrl: string
  categories: Cat[]
  existingTags?: Tag[]
  concepts?: ConceptDef[]
}): ClassificationEvaluationFixtureV3 {
  return {
    fixtureId: args.fixtureId,
    expectedCategoryId: "NEEDS_REVIEW",
    evaluationCase: { kind: "AMBIGUOUS" },
    baseInput: buildBaseInput({
      title: args.title,
      normalizedUrl: args.normalizedUrl,
      categories: args.categories,
      existingTags: args.existingTags ?? [],
    }),
    initialState: {
      bookmarkId: `bm-${args.fixtureId}`,
      bookmarkRevision: 1,
      activeTagIds: [],
      reservedTagTombstoneNormalizedNames: [],
    },
    concepts: buildConcepts(args.concepts ?? []),
  }
}

export function equivalenceFixture(args: {
  fixtureId: string
  form: EquivalenceFormV3
  placement: "IN_SELECTED_CATEGORY" | "OUTSIDE_SELECTED_CATEGORY_ONLY"
  expectedCategoryId: string
  equivalentTagId: string
  targetConceptId: string
  title: string
  normalizedUrl: string
  categories: Cat[]
  existingTags: Tag[]
  concepts: ConceptDef[]
}): ClassificationEvaluationFixtureV3 {
  return nonAmbiguousFixture({
    ...args,
    evaluationCase: {
      kind: "EQUIVALENCE",
      form: args.form,
      placement: args.placement,
      targetConceptId: args.targetConceptId,
      equivalentTagId: args.equivalentTagId,
    },
  })
}
