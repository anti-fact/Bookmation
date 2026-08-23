/**
 * fixture artifact preflight（AI_GUIDE）。違反は FIXTURE_INVALID。
 */
import { normalizeLabelName, getVendoredAssetSha256 } from "~/domain"
import { canonicalizeUnknown, utf8ByteLength } from "./canonical-json"
import { sha256HexOfCanonicalJson } from "./hash"
import { policyV2FromGranularity } from "./policy-v2"
import {
  ALL_RETRY_REASON_CODES,
  buildPromptInput,
} from "./prompt-input"
import {
  FixtureInvalidError,
  FIXTURE_SCHEMA_VERSION,
  MAX_PROMPT_INPUT_BYTES,
  SCORER_VERSION,
} from "./types"
import type {
  ClassificationEvaluationFixtureSetV3,
  ClassificationEvaluationFixtureV3,
  EquivalenceFormV3,
  Granularity,
  TagImportance,
} from "./types"

const GRANULARITIES: Granularity[] = [0, 1, 2, 3, 4]

const EQUIVALENCE_FORMS: EquivalenceFormV3[] = [
  "EXACT",
  "NORMALIZED",
  "SYNONYM",
  "FORMAL_ABBREVIATION",
  "TRANSLATION",
  "ORTHOGRAPHIC_VARIANT",
]

const BOUNDARIES = ["0_TO_1", "1_TO_2", "2_TO_3", "3_TO_4"] as const

function fail(message: string): never {
  throw new FixtureInvalidError(message)
}

function expectGranularityCoverage(
  expectations: ClassificationEvaluationFixtureV3["concepts"][number]["expectations"],
  fixtureId: string,
  conceptId: string,
): void {
  const seen = new Set<number>()
  for (const e of expectations) {
    if (seen.has(e.granularity)) {
      fail(`${fixtureId}/${conceptId}: duplicate granularity ${e.granularity}`)
    }
    seen.add(e.granularity)
  }
  for (const g of GRANULARITIES) {
    if (!seen.has(g)) {
      fail(`${fixtureId}/${conceptId}: missing granularity ${g}`)
    }
  }
}

function importanceAllowedAt(
  importance: TagImportance,
  granularity: Granularity,
): boolean {
  const allowed = policyV2FromGranularity(granularity).allowedCreateImportance
  return (allowed as readonly string[]).includes(importance)
}

function assertNonEmptyUniqueStrings(
  values: string[],
  label: string,
): void {
  if (values.length === 0) fail(`${label} must be non-empty`)
  const set = new Set(values)
  if (set.size !== values.length) fail(`${label} must be unique`)
  for (const v of values) {
    if (v.length === 0) fail(`${label} must not contain empty string`)
  }
}

function validateMultiConcept(
  fixture: ClassificationEvaluationFixtureV3,
): void {
  if (fixture.evaluationCase.kind !== "MULTI_CONCEPT") return
  const ec = fixture.evaluationCase
  const byId = new Map(fixture.concepts.map((c) => [c.conceptId, c]))

  const checkSet = (
    ids: string[],
    expectedImportance: TagImportance,
    label: string,
  ) => {
    assertNonEmptyUniqueStrings(ids, `${fixture.fixtureId} ${label}`)
    for (const id of ids) {
      const c = byId.get(id)
      if (!c) fail(`${fixture.fixtureId}: ${label} unknown concept ${id}`)
      if (c.importance !== expectedImportance) {
        fail(
          `${fixture.fixtureId}: ${label} concept ${id} must be ${expectedImportance}`,
        )
      }
    }
  }

  checkSet(ec.cMinConceptIds, "CORE", "cMinConceptIds")
  checkSet(ec.cAllCoreConceptIds, "CORE", "cAllCoreConceptIds")
  checkSet(ec.majorConceptIds, "MAJOR", "majorConceptIds")
  checkSet(ec.supportingConceptIds, "SUPPORTING", "supportingConceptIds")
  checkSet(ec.detailConceptIds, "DETAIL", "detailConceptIds")

  const cMin = new Set(ec.cMinConceptIds)
  for (const id of cMin) {
    if (!ec.cAllCoreConceptIds.includes(id)) {
      fail(`${fixture.fixtureId}: C_min must be subset of C_all`)
    }
  }

  const E: Record<Granularity, Set<string>> = {
    0: new Set(ec.cMinConceptIds),
    1: new Set(ec.cAllCoreConceptIds),
    2: new Set([...ec.cAllCoreConceptIds, ...ec.majorConceptIds]),
    3: new Set([
      ...ec.cAllCoreConceptIds,
      ...ec.majorConceptIds,
      ...ec.supportingConceptIds,
    ]),
    4: new Set([
      ...ec.cAllCoreConceptIds,
      ...ec.majorConceptIds,
      ...ec.supportingConceptIds,
      ...ec.detailConceptIds,
    ]),
  }

  for (const g of GRANULARITIES) {
    const expected = E[g]
    const actual = new Set(
      fixture.concepts
        .filter((c) => {
          const exp = c.expectations.find((e) => e.granularity === g)!
          return exp.action !== "OMIT"
        })
        .map((c) => c.conceptId),
    )
    if (
      expected.size !== actual.size ||
      [...expected].some((id) => !actual.has(id))
    ) {
      fail(
        `${fixture.fixtureId}: MULTI_CONCEPT expectations at g=${g} must equal E${g}`,
      )
    }
    for (const conceptId of expected) {
      const c = byId.get(conceptId)!
      const exp = c.expectations.find((e) => e.granularity === g)!
      if (exp.action !== "CREATE") {
        fail(
          `${fixture.fixtureId}: MULTI_CONCEPT ${conceptId}@${g} must be CREATE`,
        )
      }
    }
  }
}

function validateBoundary(fixture: ClassificationEvaluationFixtureV3): void {
  if (fixture.evaluationCase.kind !== "BOUNDARY") return
  const ec = fixture.evaluationCase
  const byId = new Map(fixture.concepts.map((c) => [c.conceptId, c]))

  if (ec.boundary === "0_TO_1") {
    const broad = byId.get(ec.broadReuseConceptId)
    const specific = byId.get(ec.specificCoreCreateConceptId)
    if (!broad || !specific) {
      fail(`${fixture.fixtureId}: BOUNDARY 0_TO_1 concept missing`)
    }
    const b0 = broad.expectations.find((e) => e.granularity === 0)!
    const b1 = broad.expectations.find((e) => e.granularity === 1)!
    const s0 = specific.expectations.find((e) => e.granularity === 0)!
    const s1 = specific.expectations.find((e) => e.granularity === 1)!
    if (b0.action !== "REUSE" || b1.action !== "OMIT") {
      fail(`${fixture.fixtureId}: broad concept must REUSE@0 OMIT@1`)
    }
    if (s0.action !== "OMIT" || s1.action !== "CREATE") {
      fail(`${fixture.fixtureId}: specific CORE must OMIT@0 CREATE@1`)
    }
    if (specific.importance !== "CORE") {
      fail(`${fixture.fixtureId}: specific concept must be CORE`)
    }
    return
  }

  const target = byId.get(ec.targetCreateConceptId)
  if (!target) fail(`${fixture.fixtureId}: BOUNDARY target missing`)
  const low =
    ec.boundary === "1_TO_2" ? 1 : ec.boundary === "2_TO_3" ? 2 : 3
  const high = (low + 1) as Granularity
  const expectedImportance: TagImportance =
    ec.boundary === "1_TO_2"
      ? "MAJOR"
      : ec.boundary === "2_TO_3"
        ? "SUPPORTING"
        : "DETAIL"
  if (target.importance !== expectedImportance) {
    fail(
      `${fixture.fixtureId}: BOUNDARY ${ec.boundary} target must be ${expectedImportance}`,
    )
  }
  const tLow = target.expectations.find((e) => e.granularity === low)!
  const tHigh = target.expectations.find((e) => e.granularity === high)!
  if (tLow.action !== "OMIT" || tHigh.action !== "CREATE") {
    fail(
      `${fixture.fixtureId}: BOUNDARY target must OMIT@${low} CREATE@${high}`,
    )
  }
}

function validateEquivalence(
  fixture: ClassificationEvaluationFixtureV3,
): void {
  if (fixture.evaluationCase.kind !== "EQUIVALENCE") return
  const ec = fixture.evaluationCase
  const concept = fixture.concepts.find((c) => c.conceptId === ec.targetConceptId)
  if (!concept) fail(`${fixture.fixtureId}: equivalence targetConcept missing`)
  const tag = fixture.baseInput.existingTags.find((t) => t.id === ec.equivalentTagId)
  if (!tag) fail(`${fixture.fixtureId}: equivalence equivalentTagId missing`)

  if (ec.placement === "IN_SELECTED_CATEGORY") {
    if (tag.parentCategoryId !== fixture.expectedCategoryId) {
      fail(`${fixture.fixtureId}: IN_SELECTED tag parent must match expectedCategory`)
    }
    for (const e of concept.expectations) {
      if (e.action !== "REUSE") {
        fail(`${fixture.fixtureId}: IN_SELECTED target must REUSE at all g`)
      }
    }
  } else {
    if (fixture.expectedCategoryId === "NEEDS_REVIEW") {
      fail(`${fixture.fixtureId}: OUTSIDE placement needs non-ambiguous category`)
    }
    if (tag.parentCategoryId === fixture.expectedCategoryId) {
      fail(`${fixture.fixtureId}: OUTSIDE tag parent must differ from expectedCategory`)
    }
    for (const e of concept.expectations) {
      if (e.action !== "OMIT") {
        fail(`${fixture.fixtureId}: OUTSIDE target must OMIT at all g`)
      }
    }
    for (const g of GRANULARITIES) {
      const anchors = fixture.concepts.filter((c) => {
        if (c.conceptId === ec.targetConceptId) return false
        const exp = c.expectations.find((e) => e.granularity === g)!
        return exp.action !== "OMIT"
      })
      if (anchors.length === 0) {
        fail(
          `${fixture.fixtureId}: OUTSIDE must have non-OMIT anchor at g=${g}`,
        )
      }
    }
  }
}

function validateFixture(fixture: ClassificationEvaluationFixtureV3): void {
  const fixtureId = fixture.fixtureId
  if (!fixtureId) fail("fixtureId must be non-empty")

  const categoryIds = new Set<string>()
  for (const cat of fixture.baseInput.categories) {
    if (categoryIds.has(cat.id)) fail(`${fixtureId}: duplicate category id`)
    categoryIds.add(cat.id)
  }

  const tagIds = new Set<string>()
  const tagById = new Map(fixture.baseInput.existingTags.map((t) => [t.id, t]))
  for (const tag of fixture.baseInput.existingTags) {
    if (tagIds.has(tag.id)) fail(`${fixtureId}: duplicate tag id`)
    tagIds.add(tag.id)
    if (!categoryIds.has(tag.parentCategoryId)) {
      fail(`${fixtureId}: tag ${tag.id} parent not in categories`)
    }
  }

  for (const cat of fixture.baseInput.categories) {
    const expectedTagIds = fixture.baseInput.existingTags
      .filter((t) => t.parentCategoryId === cat.id)
      .map((t) => t.id)
    const actualTagIds = cat.tags.map((t) => t.id)
    if (actualTagIds.join("\0") !== expectedTagIds.join("\0")) {
      fail(
        `${fixtureId}: category ${cat.id} tags must list that parent's existingTags`,
      )
    }
    for (const nested of cat.tags) {
      const source = tagById.get(nested.id)
      if (!source) {
        fail(`${fixtureId}: category ${cat.id} tag ${nested.id} not in existingTags`)
      }
    }
  }

  const existingNormalized = new Set(
    fixture.baseInput.existingTags.map(
      (t) => normalizeLabelName(t.name).normalized,
    ),
  )
  const tombstones = fixture.initialState.reservedTagTombstoneNormalizedNames
  for (const name of tombstones) {
    try {
      const n = normalizeLabelName(name)
      if (n.normalized !== name) {
        fail(`${fixtureId}: tombstone ${name} is not Normalizer canonical`)
      }
    } catch {
      fail(`${fixtureId}: tombstone ${name} invalid for Normalizer v1`)
    }
  }

  const active = fixture.initialState.activeTagIds
  if (new Set(active).size !== active.length) {
    fail(`${fixtureId}: activeTagIds must be unique`)
  }
  for (const id of active) {
    if (!tagById.has(id)) fail(`${fixtureId}: activeTagId ${id} not in existingTags`)
  }

  if (fixture.evaluationCase.kind === "AMBIGUOUS") {
    if (fixture.expectedCategoryId !== "NEEDS_REVIEW") {
      fail(`${fixtureId}: AMBIGUOUS must expect NEEDS_REVIEW`)
    }
  } else {
    if (fixture.expectedCategoryId === "NEEDS_REVIEW") {
      fail(`${fixtureId}: non-AMBIGUOUS expectedCategoryId must be Id`)
    }
    if (!categoryIds.has(fixture.expectedCategoryId)) {
      fail(`${fixtureId}: expectedCategoryId not in categories`)
    }
  }

  const conceptIds = new Set<string>()
  const reuseIdOwners = new Map<string, string>()
  const createNameOwners = new Map<string, string>()

  for (const concept of fixture.concepts) {
    if (conceptIds.has(concept.conceptId)) {
      fail(`${fixtureId}: duplicate conceptId ${concept.conceptId}`)
    }
    conceptIds.add(concept.conceptId)
    expectGranularityCoverage(concept.expectations, fixtureId, concept.conceptId)

    for (const id of concept.acceptableReuseTagIds) {
      if (!id) fail(`${fixtureId}/${concept.conceptId}: empty reuse id`)
      const prev = reuseIdOwners.get(id)
      if (prev && prev !== concept.conceptId) {
        fail(`${fixtureId}: reuse id ${id} claimed by multiple concepts`)
      }
      reuseIdOwners.set(id, concept.conceptId)
    }
    for (const name of concept.acceptableCreateNormalizedNames) {
      if (!name) fail(`${fixtureId}/${concept.conceptId}: empty create name`)
      let canonical: string
      try {
        canonical = normalizeLabelName(name).normalized
      } catch {
        fail(
          `${fixtureId}/${concept.conceptId}: create name not Normalizer-valid: ${name}`,
        )
      }
      if (canonical !== name) {
        fail(
          `${fixtureId}/${concept.conceptId}: create name must be canonical (${name})`,
        )
      }
      if (existingNormalized.has(name) || tombstones.includes(name)) {
        fail(
          `${fixtureId}/${concept.conceptId}: create name collides with existing/tombstone`,
        )
      }
      const prev = createNameOwners.get(name)
      if (prev && prev !== concept.conceptId) {
        fail(`${fixtureId}: create name ${name} claimed by multiple concepts`)
      }
      createNameOwners.set(name, concept.conceptId)
    }

    for (const exp of concept.expectations) {
      if (exp.action === "REUSE") {
        if (concept.acceptableReuseTagIds.length === 0) {
          fail(
            `${fixtureId}/${concept.conceptId}: REUSE@${exp.granularity} needs reuse ids`,
          )
        }
        if (fixture.expectedCategoryId === "NEEDS_REVIEW") continue
        for (const id of concept.acceptableReuseTagIds) {
          const tag = tagById.get(id)
          if (!tag) {
            fail(`${fixtureId}: reuse id ${id} not in existingTags`)
          }
          if (tag.parentCategoryId !== fixture.expectedCategoryId) {
            fail(
              `${fixtureId}: reuse id ${id} must be under expectedCategory`,
            )
          }
        }
      }
      if (exp.action === "CREATE") {
        if (concept.acceptableCreateNormalizedNames.length === 0) {
          fail(
            `${fixtureId}/${concept.conceptId}: CREATE@${exp.granularity} needs create names`,
          )
        }
        if (!importanceAllowedAt(concept.importance, exp.granularity)) {
          fail(
            `${fixtureId}/${concept.conceptId}: CREATE@${exp.granularity} importance not allowed`,
          )
        }
      }
    }
  }

  if (fixture.evaluationCase.kind === "AMBIGUOUS") {
    for (const concept of fixture.concepts) {
      for (const exp of concept.expectations) {
        if (exp.action !== "OMIT") {
          fail(`${fixtureId}: AMBIGUOUS expectations must all be OMIT`)
        }
      }
    }
  } else {
    for (const g of GRANULARITIES) {
      const nonOmit = fixture.concepts.filter((c) => {
        const exp = c.expectations.find((e) => e.granularity === g)!
        return exp.action !== "OMIT"
      })
      if (nonOmit.length === 0) {
        fail(`${fixtureId}: non-AMBIGUOUS needs non-OMIT concept at g=${g}`)
      }
    }
  }

  validateMultiConcept(fixture)
  validateBoundary(fixture)
  validateEquivalence(fixture)
}

function assertCoverage(fixtures: ClassificationEvaluationFixtureV3[]): void {
  const kinds = new Set(fixtures.map((f) => f.evaluationCase.kind))
  for (const k of ["NORMAL", "MULTI_CONCEPT", "AMBIGUOUS"] as const) {
    if (!kinds.has(k)) fail(`fixture set missing kind ${k}`)
  }

  const boundaries = new Set(
    fixtures
      .filter((f) => f.evaluationCase.kind === "BOUNDARY")
      .map((f) =>
        f.evaluationCase.kind === "BOUNDARY" ? f.evaluationCase.boundary : "",
      ),
  )
  for (const b of BOUNDARIES) {
    if (!boundaries.has(b)) fail(`fixture set missing BOUNDARY ${b}`)
  }

  const eqPairs = new Set(
    fixtures
      .filter((f) => f.evaluationCase.kind === "EQUIVALENCE")
      .map((f) => {
        if (f.evaluationCase.kind !== "EQUIVALENCE") return ""
        return `${f.evaluationCase.form}|${f.evaluationCase.placement}`
      }),
  )
  for (const form of EQUIVALENCE_FORMS) {
    for (const placement of [
      "IN_SELECTED_CATEGORY",
      "OUTSIDE_SELECTED_CATEGORY_ONLY",
    ] as const) {
      const key = `${form}|${placement}`
      if (!eqPairs.has(key)) {
        fail(`fixture set missing EQUIVALENCE ${key}`)
      }
    }
  }
}

function assertPromptByteBudgets(
  fixtures: ClassificationEvaluationFixtureV3[],
  providerInputQuotaBytes: number | null,
): void {
  if (providerInputQuotaBytes === null) {
    fail("Provider quota unknown: batch must not start")
  }
  for (const fixture of fixtures) {
    for (const g of GRANULARITIES) {
      const initial = buildPromptInput(fixture, g, null)
      const retry = buildPromptInput(fixture, g, {
        previousModelAttempt: 2,
        reasonCodes: [...ALL_RETRY_REASON_CODES],
      })
      for (const input of [initial, retry]) {
        const canonical = canonicalizeUnknown(input)
        const bytes = utf8ByteLength(canonical)
        if (bytes > MAX_PROMPT_INPUT_BYTES) {
          fail(
            `${fixture.fixtureId}@${g}: prompt input ${bytes} > maxPromptInputBytes`,
          )
        }
        // system prompt を含む実request上限の近似: JSON + 固定余裕
        // 固定system prompt長は harness 側定数。ここは JSON 側が quota を超えないこと。
        if (bytes > providerInputQuotaBytes) {
          fail(
            `${fixture.fixtureId}@${g}: prompt input exceeds provider quota`,
          )
        }
      }
    }
  }
}

export interface FixturePreflightOptions {
  /** Provider 入力quota（system prompt込み）。測定不能なら null で拒否 */
  providerInputQuotaBytes: number | null
}

export function preflightFixtureSet(
  set: ClassificationEvaluationFixtureSetV3,
  options: FixturePreflightOptions,
): void {
  if (set.fixtureSchemaVersion !== FIXTURE_SCHEMA_VERSION) {
    fail(`fixtureSchemaVersion must be ${FIXTURE_SCHEMA_VERSION}`)
  }
  if (set.scorerVersion !== SCORER_VERSION) {
    fail(`scorerVersion must be ${SCORER_VERSION}`)
  }
  if (!set.fixtureVersion) fail("fixtureVersion must be non-empty")
  if (!Array.isArray(set.fixtures) || set.fixtures.length === 0) {
    fail("fixtures must be non-empty")
  }

  const ids = new Set<string>()
  for (const fixture of set.fixtures) {
    if (ids.has(fixture.fixtureId)) {
      fail(`duplicate fixtureId ${fixture.fixtureId}`)
    }
    ids.add(fixture.fixtureId)
    validateFixture(fixture)
  }

  assertCoverage(set.fixtures)
  assertPromptByteBudgets(set.fixtures, options.providerInputQuotaBytes)
}

/** hash 対象: fixtureSchemaVersion, fixtureVersion, scorerVersion, fixtures */
export async function hashFixtureSet(
  set: ClassificationEvaluationFixtureSetV3,
): Promise<string> {
  return sha256HexOfCanonicalJson({
    fixtureSchemaVersion: set.fixtureSchemaVersion,
    fixtureVersion: set.fixtureVersion,
    scorerVersion: set.scorerVersion,
    fixtures: set.fixtures,
  })
}

export async function freezeFixtureSet(
  set: ClassificationEvaluationFixtureSetV3,
  options: FixturePreflightOptions,
): Promise<{ set: ClassificationEvaluationFixtureSetV3; fixtureSetSha256: string }> {
  preflightFixtureSet(set, options)
  const fixtureSetSha256 = await hashFixtureSet(set)
  return { set, fixtureSetSha256 }
}

export function labelNormalizerDataSha256(): string {
  return getVendoredAssetSha256()
}
