import { describe, expect, it } from "vitest"
import {
  buildDefaultFixtureSet,
  DEFAULT_PROVIDER_INPUT_QUOTA_BYTES,
  FixtureInvalidError,
  freezeFixtureSet,
  hashFixtureSet,
  preflightFixtureSet,
} from "./index"

describe("classification eval fixture set v3", () => {
  it("preflights and freezes with stable SHA-256", async () => {
    const set = buildDefaultFixtureSet()
    const { fixtureSetSha256 } = await freezeFixtureSet(set, {
      providerInputQuotaBytes: DEFAULT_PROVIDER_INPUT_QUOTA_BYTES,
    })
    expect(fixtureSetSha256).toMatch(/^[0-9a-f]{64}$/)
    const again = await hashFixtureSet(set)
    expect(again).toBe(fixtureSetSha256)
  })

  it("rejects missing required coverage", () => {
    const set = buildDefaultFixtureSet()
    const withoutNormal = {
      ...set,
      fixtures: set.fixtures.filter((f) => f.evaluationCase.kind !== "NORMAL"),
    }
    expect(() =>
      preflightFixtureSet(withoutNormal, {
        providerInputQuotaBytes: DEFAULT_PROVIDER_INPUT_QUOTA_BYTES,
      }),
    ).toThrow(FixtureInvalidError)
  })

  it("rejects unknown provider quota", () => {
    const set = buildDefaultFixtureSet()
    expect(() =>
      preflightFixtureSet(set, { providerInputQuotaBytes: null }),
    ).toThrow(/Provider quota/)
  })

  it("includes NORMAL, MULTI_CONCEPT, AMBIGUOUS, 4 BOUNDARY, 12 EQUIVALENCE", () => {
    const set = buildDefaultFixtureSet()
    const kinds = set.fixtures.map((f) => f.evaluationCase.kind)
    expect(kinds.filter((k) => k === "NORMAL").length).toBeGreaterThanOrEqual(1)
    expect(kinds.filter((k) => k === "MULTI_CONCEPT").length).toBeGreaterThanOrEqual(1)
    expect(kinds.filter((k) => k === "AMBIGUOUS").length).toBeGreaterThanOrEqual(1)
    expect(kinds.filter((k) => k === "BOUNDARY").length).toBe(4)
    expect(kinds.filter((k) => k === "EQUIVALENCE").length).toBe(12)
  })

  it("changes hash when oracle expectations change", async () => {
    const set = buildDefaultFixtureSet()
    const a = await hashFixtureSet(set)
    const mutated = structuredClone(set)
    const concept = mutated.fixtures[0]!.concepts[0]!
    concept.expectations[0]!.action =
      concept.expectations[0]!.action === "OMIT" ? "CREATE" : "OMIT"
    const b = await hashFixtureSet(mutated)
    expect(b).not.toBe(a)
  })
})
