import { describe, expect, it } from "vitest"
import {
  assertResultArtifactInvariants,
  buildDefaultFixtureSet,
  DEFAULT_PROVIDER_INPUT_QUOTA_BYTES,
  freezeFixtureSet,
  restoreIsolatedEvalDb,
  runFakeEvalBatch,
  scoreApplicableSet,
  scoreClassificationEvalV2,
  verifyResultArtifactHash,
} from "../index"
import { oraclePerfectProvider } from "../control/oracle-provider"

const environment = {
  chromeVersion: "140.0.0.0",
  operatingSystem: "Windows",
  locale: "ja-JP",
  promptApiState: "AVAILABLE" as const,
  providerModel: "fake-oracle-v1",
}

describe("classification eval batch + scorer v2", () => {
  it("restores isolated DB per run without carry-over", () => {
    const set = buildDefaultFixtureSet()
    const fixture = set.fixtures[0]!
    const db1 = restoreIsolatedEvalDb(fixture, 2)
    db1.snapshot.activeTagIds.push("mutated")
    db1.destroy()
    const db2 = restoreIsolatedEvalDb(fixture, 2)
    expect(db2.snapshot.activeTagIds).toEqual(fixture.initialState.activeTagIds)
    db2.assertMatchesBaseInput()
    db2.destroy()
  })

  it("scores a perfect applicable set as perfect", () => {
    const set = buildDefaultFixtureSet()
    const fixture = set.fixtures.find((f) => f.fixtureId === "normal-create-vitest")!
    const stats = scoreApplicableSet(fixture, 2, fixture.expectedCategoryId, [
      {
        sourceIndex: 0,
        action: "CREATE",
        name: "vitest",
        normalizedName: "vitest",
        importance: "CORE",
      },
    ])
    expect(stats.perfect).toBe(true)
    expect(stats.precision).toBe(1)
    expect(stats.recall).toBe(1)
  })

  it(
    "runs fake N=10 batch, seals artifact, and passes scorer thresholds",
    async () => {
      const set = buildDefaultFixtureSet()
      const { fixtureSetSha256, artifact } = await runFakeEvalBatch({
        fixtureSet: set,
        provider: oraclePerfectProvider(set),
        environment,
        providerInputQuotaBytes: DEFAULT_PROVIDER_INPUT_QUOTA_BYTES,
        allowRealModel: false,
      })

      expect(artifact.resultArtifactSha256).toMatch(/^[0-9a-f]{64}$/)
      await verifyResultArtifactHash(artifact)

      const frozen = await freezeFixtureSet(set, {
        providerInputQuotaBytes: DEFAULT_PROVIDER_INPUT_QUOTA_BYTES,
      })
      expect(fixtureSetSha256).toBe(frozen.fixtureSetSha256)

      assertResultArtifactInvariants(
        artifact,
        set,
        fixtureSetSha256,
        artifact.labelNormalizerDataSha256,
      )

      const report = scoreClassificationEvalV2(set, artifact)
      if (!report.passed) {
        // eslint-disable-next-line no-console
        console.error(report.failures)
      }
      expect(report.passed).toBe(true)
      expect(report.normal.allCellsFirstAttemptRate).toBeGreaterThanOrEqual(0.9)
      expect(report.normal.allCellsCommittedRate).toBeGreaterThanOrEqual(0.95)
      expect(report.multiConcept?.strictlyIncreasing).toBe(true)
      expect(report.boundary.every((b) => b.passed)).toBe(true)
      expect(report.equivalence.every((e) => e.passed)).toBe(true)
      expect(report.ambiguous.every((a) => a.passed)).toBe(true)
    },
    120_000,
  )

  it("refuses real-model batch until runtime dependencies are ready", async () => {
    const set = buildDefaultFixtureSet()
    await expect(
      runFakeEvalBatch({
        fixtureSet: set,
        provider: oraclePerfectProvider(set),
        environment,
        providerInputQuotaBytes: DEFAULT_PROVIDER_INPUT_QUOTA_BYTES,
        allowRealModel: true,
      }),
    ).rejects.toThrow(/Real Gemini Nano batch is blocked/)
  })
})
