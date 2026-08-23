/**
 * Classification evaluation fixture set v3（合成データのみ）
 */
import {
  ambiguousFixture,
  equivalenceFixture,
  nonAmbiguousFixture,
} from "./builders"
import type {
  ClassificationEvaluationFixtureSetV3,
  ClassificationEvaluationFixtureV3,
  EquivalenceFormV3,
} from "../types"
import { FIXTURE_SCHEMA_VERSION, SCORER_VERSION } from "../types"

const CAT_TECH = { id: "cat-tech", name: "Technology" }
const CAT_LIFE = { id: "cat-life", name: "Lifestyle" }
const CAT_SCI = { id: "cat-science", name: "Science" }

/** NORMAL: 既存Tag REUSE（全粒度） */
const normalReuse: ClassificationEvaluationFixtureV3 = nonAmbiguousFixture({
  fixtureId: "normal-reuse-typescript",
  expectedCategoryId: CAT_TECH.id,
  evaluationCase: { kind: "NORMAL" },
  title: "TypeScript Handbook — Basics",
  normalizedUrl: "https://example.test/docs/typescript-handbook",
  categories: [CAT_TECH, CAT_LIFE],
  existingTags: [
    {
      id: "tag-typescript",
      name: "TypeScript",
      parentCategoryId: CAT_TECH.id,
      origin: "USER",
    },
  ],
  concepts: [
    {
      conceptId: "c-typescript",
      importance: "CORE",
      acceptableReuseTagIds: ["tag-typescript"],
      actions: { 0: "REUSE", 1: "REUSE", 2: "REUSE", 3: "REUSE", 4: "REUSE" },
    },
  ],
})

/** NORMAL: CREATE only（既存同等なし） */
const normalCreate: ClassificationEvaluationFixtureV3 = nonAmbiguousFixture({
  fixtureId: "normal-create-vitest",
  expectedCategoryId: CAT_TECH.id,
  evaluationCase: { kind: "NORMAL" },
  title: "Vitest Unit Testing Guide",
  normalizedUrl: "https://example.test/docs/vitest-guide",
  categories: [CAT_TECH],
  existingTags: [],
  concepts: [
    {
      conceptId: "c-vitest",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["vitest"],
      actions: {
        0: "CREATE",
        1: "CREATE",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
  ],
})

/** MULTI_CONCEPT: C_min ⊂ C_all、M/S/D 非空 */
const multiConcept: ClassificationEvaluationFixtureV3 = nonAmbiguousFixture({
  fixtureId: "multi-concept-react-query",
  expectedCategoryId: CAT_TECH.id,
  evaluationCase: {
    kind: "MULTI_CONCEPT",
    cMinConceptIds: ["c-react"],
    cAllCoreConceptIds: ["c-react", "c-tanstack-query"],
    majorConceptIds: ["c-caching"],
    supportingConceptIds: ["c-devtools"],
    detailConceptIds: ["c-query-key"],
  },
  title: "TanStack Query caching, Devtools, and queryKey patterns for React",
  normalizedUrl: "https://example.test/docs/tanstack-query-react",
  categories: [CAT_TECH],
  existingTags: [],
  concepts: [
    {
      conceptId: "c-react",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["react"],
      actions: {
        0: "CREATE",
        1: "CREATE",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
    {
      conceptId: "c-tanstack-query",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["tanstack query"],
      actions: {
        0: "OMIT",
        1: "CREATE",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
    {
      conceptId: "c-caching",
      importance: "MAJOR",
      acceptableCreateNormalizedNames: ["caching"],
      actions: {
        0: "OMIT",
        1: "OMIT",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
    {
      conceptId: "c-devtools",
      importance: "SUPPORTING",
      acceptableCreateNormalizedNames: ["devtools"],
      actions: {
        0: "OMIT",
        1: "OMIT",
        2: "OMIT",
        3: "CREATE",
        4: "CREATE",
      },
    },
    {
      conceptId: "c-query-key",
      importance: "DETAIL",
      acceptableCreateNormalizedNames: ["querykey"],
      actions: {
        0: "OMIT",
        1: "OMIT",
        2: "OMIT",
        3: "OMIT",
        4: "CREATE",
      },
    },
  ],
})

/** AMBIGUOUS: 同等COREのCategoryが複数 */
const ambiguous: ClassificationEvaluationFixtureV3 = ambiguousFixture({
  fixtureId: "ambiguous-dual-core-category",
  title: "Climate policy and renewable energy markets overview",
  normalizedUrl: "https://example.test/docs/climate-energy-overview",
  categories: [CAT_LIFE, CAT_SCI],
  existingTags: [],
  concepts: [
    {
      conceptId: "c-climate",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["climate policy"],
      actions: {},
    },
  ],
})

const boundary0to1: ClassificationEvaluationFixtureV3 = nonAmbiguousFixture({
  fixtureId: "boundary-0-to-1-webdev",
  expectedCategoryId: CAT_TECH.id,
  evaluationCase: {
    kind: "BOUNDARY",
    boundary: "0_TO_1",
    broadReuseConceptId: "c-web-dev",
    specificCoreCreateConceptId: "c-css-grid",
  },
  title: "CSS Grid layout for modern web development",
  normalizedUrl: "https://example.test/docs/css-grid-web",
  categories: [CAT_TECH],
  existingTags: [
    {
      id: "tag-web-development",
      name: "Web Development",
      parentCategoryId: CAT_TECH.id,
      origin: "USER",
    },
  ],
  concepts: [
    {
      conceptId: "c-web-dev",
      importance: "CORE",
      acceptableReuseTagIds: ["tag-web-development"],
      actions: {
        0: "REUSE",
        1: "OMIT",
        2: "OMIT",
        3: "OMIT",
        4: "OMIT",
      },
    },
    {
      conceptId: "c-css-grid",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["css grid"],
      actions: {
        0: "OMIT",
        1: "CREATE",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
  ],
})

const boundary1to2: ClassificationEvaluationFixtureV3 = nonAmbiguousFixture({
  fixtureId: "boundary-1-to-2-major",
  expectedCategoryId: CAT_TECH.id,
  evaluationCase: {
    kind: "BOUNDARY",
    boundary: "1_TO_2",
    targetCreateConceptId: "c-indexeddb",
  },
  title: "Browser storage with IndexedDB for offline apps",
  normalizedUrl: "https://example.test/docs/indexeddb-offline",
  categories: [CAT_TECH],
  existingTags: [],
  concepts: [
    {
      conceptId: "c-offline-apps",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["offline apps"],
      actions: {
        0: "CREATE",
        1: "CREATE",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
    {
      conceptId: "c-indexeddb",
      importance: "MAJOR",
      acceptableCreateNormalizedNames: ["indexeddb"],
      actions: {
        0: "OMIT",
        1: "OMIT",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
  ],
})

const boundary2to3: ClassificationEvaluationFixtureV3 = nonAmbiguousFixture({
  fixtureId: "boundary-2-to-3-supporting",
  expectedCategoryId: CAT_TECH.id,
  evaluationCase: {
    kind: "BOUNDARY",
    boundary: "2_TO_3",
    targetCreateConceptId: "c-service-worker",
  },
  title: "Progressive web apps using a service worker cache strategy",
  normalizedUrl: "https://example.test/docs/pwa-service-worker",
  categories: [CAT_TECH],
  existingTags: [],
  concepts: [
    {
      conceptId: "c-pwa",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["progressive web apps"],
      actions: {
        0: "CREATE",
        1: "CREATE",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
    {
      conceptId: "c-service-worker",
      importance: "SUPPORTING",
      acceptableCreateNormalizedNames: ["service worker"],
      actions: {
        0: "OMIT",
        1: "OMIT",
        2: "OMIT",
        3: "CREATE",
        4: "CREATE",
      },
    },
  ],
})

const boundary3to4: ClassificationEvaluationFixtureV3 = nonAmbiguousFixture({
  fixtureId: "boundary-3-to-4-detail",
  expectedCategoryId: CAT_TECH.id,
  evaluationCase: {
    kind: "BOUNDARY",
    boundary: "3_TO_4",
    targetCreateConceptId: "c-cache-api",
  },
  title: "PWA caching with the Cache API matchAll method",
  normalizedUrl: "https://example.test/docs/cache-api-matchall",
  categories: [CAT_TECH],
  existingTags: [],
  concepts: [
    {
      conceptId: "c-caching-core",
      importance: "CORE",
      acceptableCreateNormalizedNames: ["pwa caching"],
      actions: {
        0: "CREATE",
        1: "CREATE",
        2: "CREATE",
        3: "CREATE",
        4: "CREATE",
      },
    },
    {
      conceptId: "c-cache-api",
      importance: "DETAIL",
      acceptableCreateNormalizedNames: ["cache api"],
      actions: {
        0: "OMIT",
        1: "OMIT",
        2: "OMIT",
        3: "OMIT",
        4: "CREATE",
      },
    },
  ],
})

const EQUIV_FORMS: EquivalenceFormV3[] = [
  "EXACT",
  "NORMALIZED",
  "SYNONYM",
  "FORMAL_ABBREVIATION",
  "TRANSLATION",
  "ORTHOGRAPHIC_VARIANT",
]

/** 表示名の差: formごとの合成表記（正規化後の一致は preflight が既存名側で扱う） */
const EQUIV_TAG_NAMES: Record<EquivalenceFormV3, { inName: string; pageTitle: string }> = {
  EXACT: { inName: "GraphQL", pageTitle: "GraphQL query language overview" },
  NORMALIZED: {
    inName: "WebAssembly",
    pageTitle: "Web Assembly runtime notes",
  },
  SYNONYM: {
    inName: "Javascript",
    pageTitle: "ECMAScript language reference",
  },
  FORMAL_ABBREVIATION: {
    inName: "Hypertext Transfer Protocol",
    pageTitle: "HTTP protocol primer",
  },
  TRANSLATION: {
    inName: "Machine Learning",
    pageTitle: "機械学習の基礎ガイド",
  },
  ORTHOGRAPHIC_VARIANT: {
    inName: "Color",
    pageTitle: "Colour systems for UI design",
  },
}

function buildEquivalenceFixtures(): ClassificationEvaluationFixtureV3[] {
  const out: ClassificationEvaluationFixtureV3[] = []
  for (const form of EQUIV_FORMS) {
    const names = EQUIV_TAG_NAMES[form]
    const tagIn = `tag-eq-${form.toLowerCase()}-in`
    const tagOut = `tag-eq-${form.toLowerCase()}-out`

    out.push(
      equivalenceFixture({
        fixtureId: `equivalence-${form}-in`,
        form,
        placement: "IN_SELECTED_CATEGORY",
        expectedCategoryId: CAT_TECH.id,
        equivalentTagId: tagIn,
        targetConceptId: "c-target",
        title: names.pageTitle,
        normalizedUrl: `https://example.test/docs/eq-${form.toLowerCase()}-in`,
        categories: [CAT_TECH, CAT_LIFE],
        existingTags: [
          {
            id: tagIn,
            name: names.inName,
            parentCategoryId: CAT_TECH.id,
            origin: "USER",
          },
        ],
        concepts: [
          {
            conceptId: "c-target",
            importance: "CORE",
            acceptableReuseTagIds: [tagIn],
            actions: {
              0: "REUSE",
              1: "REUSE",
              2: "REUSE",
              3: "REUSE",
              4: "REUSE",
            },
          },
        ],
      }),
    )

    const anchorNames: Record<EquivalenceFormV3, string> = {
      EXACT: "anchor exact",
      NORMALIZED: "anchor normalized",
      SYNONYM: "anchor synonym",
      FORMAL_ABBREVIATION: "anchor formal abbreviation",
      TRANSLATION: "anchor translation",
      ORTHOGRAPHIC_VARIANT: "anchor orthographic variant",
    }

    out.push(
      equivalenceFixture({
        fixtureId: `equivalence-${form}-out`,
        form,
        placement: "OUTSIDE_SELECTED_CATEGORY_ONLY",
        expectedCategoryId: CAT_TECH.id,
        equivalentTagId: tagOut,
        targetConceptId: "c-forbidden",
        title: names.pageTitle,
        normalizedUrl: `https://example.test/docs/eq-${form.toLowerCase()}-out`,
        categories: [CAT_TECH, CAT_LIFE],
        existingTags: [
          {
            id: tagOut,
            name: names.inName,
            parentCategoryId: CAT_LIFE.id,
            origin: "USER",
          },
        ],
        concepts: [
          {
            conceptId: "c-forbidden",
            importance: "CORE",
            acceptableReuseTagIds: [],
            actions: {
              0: "OMIT",
              1: "OMIT",
              2: "OMIT",
              3: "OMIT",
              4: "OMIT",
            },
          },
          {
            conceptId: "c-anchor",
            importance: "CORE",
            acceptableCreateNormalizedNames: [anchorNames[form]],
            actions: {
              0: "CREATE",
              1: "CREATE",
              2: "CREATE",
              3: "CREATE",
              4: "CREATE",
            },
          },
        ],
      }),
    )
  }
  return out
}

// Fix duplicate property in OUTSIDE fixture - I accidentally duplicated acceptableReuseTagIds
// Let me fix that in the write - I'll rewrite the equivalence section carefully.

export const FIXTURE_VERSION = "classification-eval-fixtures-v3.0.0"

export function buildDefaultFixtureSet(): ClassificationEvaluationFixtureSetV3 {
  const fixtures: ClassificationEvaluationFixtureV3[] = [
    normalReuse,
    normalCreate,
    multiConcept,
    ambiguous,
    boundary0to1,
    boundary1to2,
    boundary2to3,
    boundary3to4,
    ...buildEquivalenceFixtures(),
  ]

  return {
    fixtureSchemaVersion: FIXTURE_SCHEMA_VERSION,
    fixtureVersion: FIXTURE_VERSION,
    scorerVersion: SCORER_VERSION,
    fixtures,
  }
}

/** テスト用: Provider quota を十分大きくして preflight 可能にする既定値 */
export const DEFAULT_PROVIDER_INPUT_QUOTA_BYTES = 1_000_000
