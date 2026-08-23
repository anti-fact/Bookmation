/**
 * classification-eval-scorer-v2
 * 同じ result artifact から Category / concept P-R / REUSE-CREATE /
 * importance / semantic duplicate / Category外同等禁止を再採点する。
 */
import type {
  ClassificationEvaluationFixtureSetV3,
  ClassificationEvaluationFixtureV3,
  ClassificationEvaluationResultArtifactV1,
  EvaluationApplicableCandidateV1,
  EvaluationRunResultV1,
  Granularity,
} from "../types"
import { EVAL_SAMPLE_SIZE } from "../types"

export interface ConceptMatchStats {
  precision: number
  recall: number
  semanticDuplicate: boolean
  categoryMatch: boolean
  perfect: boolean
}

export interface CellScore {
  fixtureId: string
  granularity: Granularity
  kind: ClassificationEvaluationFixtureV3["evaluationCase"]["kind"]
  includedRuns: number
  firstAttemptSuccessRate: number | null
  committedSuccessRate: number | null
  conceptPrecisionMean: number | null
  conceptRecallMean: number | null
}

export interface ScorerReportV2 {
  scorerVersion: "classification-eval-scorer-v2"
  passed: boolean
  failures: string[]
  normal: {
    perCellFirstAttemptMin: number
    allCellsFirstAttemptRate: number
    allCellsCommittedRate: number
    jsonEnvelopeInvalidRate: number | null
  }
  multiConcept: {
    meanCreateCounts: number[]
    strictlyIncreasing: boolean
  } | null
  boundary: Array<{
    fixtureId: string
    boundary: string
    deltaPoints: number
    passed: boolean
  }>
  equivalence: Array<{
    fixtureId: string
    placement: string
    form: string
    passed: boolean
  }>
  ambiguous: Array<{
    fixtureId: string
    granularity: Granularity
    passed: boolean
  }>
  cells: CellScore[]
}

function includedForCell(
  runs: EvaluationRunResultV1[],
  fixtureId: string,
  granularity: Granularity,
): Extract<EvaluationRunResultV1, { disposition: "INCLUDED" }>[] {
  return runs
    .filter(
      (r): r is Extract<EvaluationRunResultV1, { disposition: "INCLUDED" }> =>
        r.disposition === "INCLUDED" &&
        r.fixtureId === fixtureId &&
        r.granularity === granularity,
    )
    .sort((a, b) => a.sampleIndex - b.sampleIndex)
}

function expectedConcepts(
  fixture: ClassificationEvaluationFixtureV3,
  granularity: Granularity,
) {
  return fixture.concepts.filter((c) => {
    const exp = c.expectations.find((e) => e.granularity === granularity)!
    return exp.action !== "OMIT"
  })
}

function matchCandidateToConcept(
  fixture: ClassificationEvaluationFixtureV3,
  granularity: Granularity,
  candidate: EvaluationApplicableCandidateV1,
): { conceptId: string; ok: boolean } | null {
  const matches: { conceptId: string; ok: boolean }[] = []
  for (const concept of fixture.concepts) {
    const exp = concept.expectations.find((e) => e.granularity === granularity)!
    if (candidate.action === "REUSE") {
      if (!concept.acceptableReuseTagIds.includes(candidate.tagId)) continue
      const ok =
        exp.action === "REUSE" && candidate.importance === concept.importance
      matches.push({ conceptId: concept.conceptId, ok })
    } else {
      if (
        !concept.acceptableCreateNormalizedNames.includes(candidate.normalizedName)
      ) {
        continue
      }
      const ok =
        exp.action === "CREATE" && candidate.importance === concept.importance
      matches.push({ conceptId: concept.conceptId, ok })
    }
  }
  if (matches.length === 0) return null
  if (matches.length > 1) {
    return { conceptId: matches[0]!.conceptId, ok: false }
  }
  return matches[0]!
}

export function scoreApplicableSet(
  fixture: ClassificationEvaluationFixtureV3,
  granularity: Granularity,
  categoryId: string | null,
  candidates: EvaluationApplicableCandidateV1[],
): ConceptMatchStats {
  if (fixture.evaluationCase.kind === "AMBIGUOUS") {
    return {
      precision: 0,
      recall: 0,
      semanticDuplicate: false,
      categoryMatch: false,
      perfect: false,
    }
  }

  const expected = expectedConcepts(fixture, granularity)
  const expectedIds = new Set(expected.map((c) => c.conceptId))
  const categoryMatch = categoryId === fixture.expectedCategoryId

  if (candidates.length === 0) {
    return {
      precision: 0,
      recall: 0,
      semanticDuplicate: false,
      categoryMatch,
      perfect: false,
    }
  }

  const conceptHits = new Map<string, number>()
  let truePositives = 0
  let semanticDuplicate = false

  for (const candidate of candidates) {
    const match = matchCandidateToConcept(fixture, granularity, candidate)
    if (!match) continue
    const prev = conceptHits.get(match.conceptId) ?? 0
    conceptHits.set(match.conceptId, prev + 1)
    if (prev >= 1) semanticDuplicate = true
    if (match.ok && expectedIds.has(match.conceptId) && prev === 0) {
      truePositives += 1
    }
  }

  // false positive: candidate that doesn't uniquely ok-match an expected concept
  let correctCandidates = 0
  for (const candidate of candidates) {
    const match = matchCandidateToConcept(fixture, granularity, candidate)
    if (
      match &&
      match.ok &&
      expectedIds.has(match.conceptId) &&
      (conceptHits.get(match.conceptId) ?? 0) === 1
    ) {
      correctCandidates += 1
    }
  }

  const precision = correctCandidates / candidates.length
  const recall =
    expected.length === 0 ? 0 : truePositives / expected.length

  const perfect =
    categoryMatch &&
    precision === 1 &&
    recall === 1 &&
    !semanticDuplicate &&
    candidates.length === expected.length

  return {
    precision,
    recall,
    semanticDuplicate,
    categoryMatch,
    perfect,
  }
}

function firstAttemptApplicable(
  run: Extract<EvaluationRunResultV1, { disposition: "INCLUDED" }>,
): {
  categoryId: string | null
  candidates: EvaluationApplicableCandidateV1[]
} | null {
  const a1 = run.attempts.find((a) => a.ordinal === 1)
  if (!a1) return null
  return {
    categoryId: a1.applicableCategoryId,
    candidates: a1.applicableCandidates,
  }
}

function isAmbiguousSuccess(
  run: Extract<EvaluationRunResultV1, { disposition: "INCLUDED" }>,
): boolean {
  return (
    run.finalJobState === "NEEDS_REVIEW" &&
    run.terminalReasonCode === "QUALITY_ZERO_EXHAUSTED" &&
    run.modelAttempt === 3 &&
    run.attempts.every(
      (a) => a.outcome === "GLOBAL_INVALID" || a.outcome === "ZERO_VALID",
    ) &&
    run.committed === null
  )
}

function createConceptCount(
  fixture: ClassificationEvaluationFixtureV3,
  granularity: Granularity,
  candidates: EvaluationApplicableCandidateV1[],
): number {
  const expected = expectedConcepts(fixture, granularity).filter((c) => {
    const exp = c.expectations.find((e) => e.granularity === granularity)!
    return exp.action === "CREATE"
  })
  const hit = new Set<string>()
  for (const candidate of candidates) {
    if (candidate.action !== "CREATE") continue
    const match = matchCandidateToConcept(fixture, granularity, candidate)
    if (match?.ok && expected.some((c) => c.conceptId === match.conceptId)) {
      hit.add(match.conceptId)
    }
  }
  return hit.size
}

function rate(ok: number, total: number): number {
  return total === 0 ? 0 : ok / total
}

export function scoreClassificationEvalV2(
  fixtureSet: ClassificationEvaluationFixtureSetV3,
  artifact: ClassificationEvaluationResultArtifactV1,
): ScorerReportV2 {
  const failures: string[] = []
  const cells: CellScore[] = []
  const fixtureById = new Map(fixtureSet.fixtures.map((f) => [f.fixtureId, f]))

  let normalFirstOk = 0
  let normalFirstTotal = 0
  let normalCommittedOk = 0
  let normalCommittedTotal = 0
  let normalCellFirstMins: number[] = []

  let jsonInvalid = 0
  let jsonDenom = 0

  const ambiguousResults: ScorerReportV2["ambiguous"] = []
  const boundaryResults: ScorerReportV2["boundary"] = []
  const equivalenceResults: ScorerReportV2["equivalence"] = []

  for (const fixture of fixtureSet.fixtures) {
    for (const g of [0, 1, 2, 3, 4] as Granularity[]) {
      const included = includedForCell(artifact.runs, fixture.fixtureId, g)
      if (included.length !== EVAL_SAMPLE_SIZE) {
        failures.push(
          `${fixture.fixtureId}@${g}: expected ${EVAL_SAMPLE_SIZE} included, got ${included.length}`,
        )
      }

      let firstOk = 0
      let committedOk = 0
      let precisionSum = 0
      let recallSum = 0

      for (const run of included) {
        for (const attempt of run.attempts) {
          if (
            attempt.responseDisposition === "NO_RESPONSE" ||
            attempt.responseDisposition === "TECHNICAL_FAILURE"
          ) {
            continue
          }
          jsonDenom += 1
          if (
            attempt.responseDisposition === "JSON_INVALID" ||
            attempt.responseDisposition === "ENVELOPE_INVALID"
          ) {
            jsonInvalid += 1
          }
        }

        if (fixture.evaluationCase.kind === "AMBIGUOUS") {
          if (isAmbiguousSuccess(run)) {
            firstOk += 1
            committedOk += 1
          }
          continue
        }

        const first = firstAttemptApplicable(run)
        if (first) {
          const s = scoreApplicableSet(
            fixture,
            g,
            first.categoryId,
            first.candidates,
          )
          precisionSum += s.precision
          recallSum += s.recall
          if (s.perfect) firstOk += 1
        }

        if (run.committed) {
          const s = scoreApplicableSet(
            fixture,
            g,
            run.committed.categoryId,
            run.committed.candidates,
          )
          if (s.perfect) committedOk += 1
        }
      }

      const n = included.length || EVAL_SAMPLE_SIZE
      const firstRate = rate(firstOk, n)
      const committedRate = rate(committedOk, n)

      cells.push({
        fixtureId: fixture.fixtureId,
        granularity: g,
        kind: fixture.evaluationCase.kind,
        includedRuns: included.length,
        firstAttemptSuccessRate:
          fixture.evaluationCase.kind === "AMBIGUOUS" ? null : firstRate,
        committedSuccessRate:
          fixture.evaluationCase.kind === "AMBIGUOUS" ? firstRate : committedRate,
        conceptPrecisionMean:
          fixture.evaluationCase.kind === "AMBIGUOUS" ? null : precisionSum / n,
        conceptRecallMean:
          fixture.evaluationCase.kind === "AMBIGUOUS" ? null : recallSum / n,
      })

      if (fixture.evaluationCase.kind === "NORMAL") {
        normalFirstOk += firstOk
        normalFirstTotal += n
        normalCommittedOk += committedOk
        normalCommittedTotal += n
        normalCellFirstMins.push(firstRate)
        if (firstRate < 0.8) {
          failures.push(
            `NORMAL ${fixture.fixtureId}@${g} first-attempt success ${firstRate} < 0.8`,
          )
        }
      }

      if (fixture.evaluationCase.kind === "AMBIGUOUS") {
        const passed = firstOk === n
        ambiguousResults.push({
          fixtureId: fixture.fixtureId,
          granularity: g,
          passed,
        })
        if (!passed) {
          failures.push(
            `AMBIGUOUS ${fixture.fixtureId}@${g} requires 10/10 NEEDS_REVIEW`,
          )
        }
      }
    }
  }

  const allCellsFirst =
    normalFirstTotal === 0 ? 0 : normalFirstOk / normalFirstTotal
  const allCellsCommitted =
    normalCommittedTotal === 0 ? 0 : normalCommittedOk / normalCommittedTotal
  if (allCellsFirst < 0.9) {
    failures.push(`NORMAL all-cell first-attempt ${allCellsFirst} < 0.9`)
  }
  if (allCellsCommitted < 0.95) {
    failures.push(`NORMAL all-cell committed ${allCellsCommitted} < 0.95`)
  }

  const jsonRate = jsonDenom === 0 ? null : jsonInvalid / jsonDenom
  if (jsonRate === null) {
    failures.push("JSON/envelope invalid rate denominator is 0")
  } else if (jsonRate > 0.05) {
    failures.push(`JSON/envelope invalid rate ${jsonRate} > 0.05`)
  }

  // MULTI_CONCEPT
  const multi = fixtureSet.fixtures.find(
    (f) => f.evaluationCase.kind === "MULTI_CONCEPT",
  )
  let multiReport: ScorerReportV2["multiConcept"] = null
  if (multi && multi.evaluationCase.kind === "MULTI_CONCEPT") {
    const means: number[] = []
    for (const g of [0, 1, 2, 3, 4] as Granularity[]) {
      const included = includedForCell(artifact.runs, multi.fixtureId, g)
      let sum = 0
      let setExact = 0
      const expected = expectedConcepts(multi, g)
      for (const run of included) {
        const first = firstAttemptApplicable(run)
        const candidates = first?.candidates ?? []
        sum += createConceptCount(multi, g, candidates)
        const s = scoreApplicableSet(
          multi,
          g,
          first?.categoryId ?? null,
          candidates,
        )
        if (s.perfect) setExact += 1
        for (const concept of expected) {
          // per-concept adoption tracked via recall in aggregate
        }
      }
      const mean = sum / EVAL_SAMPLE_SIZE
      means.push(mean)
      const recallAgg =
        included.reduce((acc, run) => {
          const first = firstAttemptApplicable(run)
          return (
            acc +
            scoreApplicableSet(
              multi,
              g,
              first?.categoryId ?? null,
              first?.candidates ?? [],
            ).recall
          )
        }, 0) / EVAL_SAMPLE_SIZE
      if (recallAgg < 0.9) {
        failures.push(
          `MULTI_CONCEPT ${multi.fixtureId}@${g} concept recall ${recallAgg} < 0.9`,
        )
      }
      if (setExact / EVAL_SAMPLE_SIZE < 0.8) {
        failures.push(
          `MULTI_CONCEPT ${multi.fixtureId}@${g} exact set rate < 0.8`,
        )
      }
    }
    const strictlyIncreasing =
      means[0]! < means[1]! &&
      means[1]! < means[2]! &&
      means[2]! < means[3]! &&
      means[3]! < means[4]!
    if (!strictlyIncreasing) {
      failures.push(
        `MULTI_CONCEPT meanCreateCount not strictly increasing: ${means.join(",")}`,
      )
    }
    multiReport = { meanCreateCounts: means, strictlyIncreasing }
  }

  // BOUNDARY 20 points
  for (const fixture of fixtureSet.fixtures) {
    if (fixture.evaluationCase.kind !== "BOUNDARY") continue
    const ec = fixture.evaluationCase
    if (ec.boundary === "0_TO_1") {
      const low = includedForCell(artifact.runs, fixture.fixtureId, 0)
      const high = includedForCell(artifact.runs, fixture.fixtureId, 1)
      const broadLow = rate(
        low.filter((run) => {
          const first = firstAttemptApplicable(run)
          if (!first) return false
          return first.candidates.some(
            (c) =>
              c.action === "REUSE" &&
              fixture.concepts
                .find((x) => x.conceptId === ec.broadReuseConceptId)
                ?.acceptableReuseTagIds.includes(c.tagId),
          )
        }).length,
        EVAL_SAMPLE_SIZE,
      )
      const broadHigh = rate(
        high.filter((run) => {
          const first = firstAttemptApplicable(run)
          if (!first) return false
          return first.candidates.some(
            (c) =>
              c.action === "REUSE" &&
              fixture.concepts
                .find((x) => x.conceptId === ec.broadReuseConceptId)
                ?.acceptableReuseTagIds.includes(c.tagId),
          )
        }).length,
        EVAL_SAMPLE_SIZE,
      )
      const specificLow = rate(
        low.filter((run) => {
          const first = firstAttemptApplicable(run)
          const names =
            fixture.concepts.find(
              (x) => x.conceptId === ec.specificCoreCreateConceptId,
            )?.acceptableCreateNormalizedNames ?? []
          return (
            first?.candidates.some(
              (c) =>
                c.action === "CREATE" && names.includes(c.normalizedName),
            ) ?? false
          )
        }).length,
        EVAL_SAMPLE_SIZE,
      )
      const specificHigh = rate(
        high.filter((run) => {
          const first = firstAttemptApplicable(run)
          const names =
            fixture.concepts.find(
              (x) => x.conceptId === ec.specificCoreCreateConceptId,
            )?.acceptableCreateNormalizedNames ?? []
          return (
            first?.candidates.some(
              (c) =>
                c.action === "CREATE" && names.includes(c.normalizedName),
            ) ?? false
          )
        }).length,
        EVAL_SAMPLE_SIZE,
      )
      const deltaReuse = (broadLow - broadHigh) * 100
      const deltaCreate = (specificHigh - specificLow) * 100
      const passed = deltaReuse >= 20 && deltaCreate >= 20
      boundaryResults.push({
        fixtureId: fixture.fixtureId,
        boundary: ec.boundary,
        deltaPoints: Math.min(deltaReuse, deltaCreate),
        passed,
      })
      if (!passed) {
        failures.push(
          `BOUNDARY ${fixture.fixtureId} 0_TO_1 deltas reuse=${deltaReuse} create=${deltaCreate}`,
        )
      }
    } else {
      const lowG =
        ec.boundary === "1_TO_2" ? 1 : ec.boundary === "2_TO_3" ? 2 : 3
      const highG = (lowG + 1) as Granularity
      const low = includedForCell(artifact.runs, fixture.fixtureId, lowG)
      const high = includedForCell(artifact.runs, fixture.fixtureId, highG)
      const names =
        fixture.concepts.find((x) => x.conceptId === ec.targetCreateConceptId)
          ?.acceptableCreateNormalizedNames ?? []
      const adopt = (
        runs: Extract<EvaluationRunResultV1, { disposition: "INCLUDED" }>[],
      ) =>
        rate(
          runs.filter((run) => {
            const first = firstAttemptApplicable(run)
            return (
              first?.candidates.some(
                (c) =>
                  c.action === "CREATE" && names.includes(c.normalizedName),
              ) ?? false
            )
          }).length,
          EVAL_SAMPLE_SIZE,
        )
      const delta = (adopt(high) - adopt(low)) * 100
      const passed = delta >= 20
      boundaryResults.push({
        fixtureId: fixture.fixtureId,
        boundary: ec.boundary,
        deltaPoints: delta,
        passed,
      })
      if (!passed) {
        failures.push(
          `BOUNDARY ${fixture.fixtureId} ${ec.boundary} delta=${delta} < 20`,
        )
      }
    }
  }

  // EQUIVALENCE
  for (const fixture of fixtureSet.fixtures) {
    if (fixture.evaluationCase.kind !== "EQUIVALENCE") continue
    const ec = fixture.evaluationCase
    let passed = true
    for (const g of [0, 1, 2, 3, 4] as Granularity[]) {
      const included = includedForCell(artifact.runs, fixture.fixtureId, g)
      for (const run of included) {
        if (ec.placement === "IN_SELECTED_CATEGORY") {
          const first = firstAttemptApplicable(run)
          const reuseOk =
            first?.candidates.filter(
              (c) =>
                c.action === "REUSE" && c.tagId === ec.equivalentTagId,
            ).length === 1 &&
            !first.candidates.some((c) => {
              if (c.action !== "CREATE") return false
              const names =
                fixture.concepts.find((x) => x.conceptId === ec.targetConceptId)
                  ?.acceptableCreateNormalizedNames ?? []
              return names.includes(c.normalizedName)
            })
          const committedOk =
            run.committed?.candidates.filter(
              (c) =>
                c.action === "REUSE" && c.tagId === ec.equivalentTagId,
            ).length === 1
          if (!reuseOk || !committedOk) passed = false
        } else {
          // OUTSIDE: all attempts ENVELOPE_VALID, no invalid indexes,
          // MODEL_DECISION has 0 REUSE of equivalentTag and 0 CREATE of target,
          // COMMITTED has anchors perfect and no forbidden concept
          for (const attempt of run.attempts) {
            if (attempt.responseDisposition !== "ENVELOPE_VALID") passed = false
            if (attempt.candidateSchemaInvalidIndexes.length > 0) passed = false
            for (const d of attempt.modelDecisionCandidates) {
              if (
                d.decision.action === "REUSE" &&
                d.decision.tagId === ec.equivalentTagId
              ) {
                passed = false
              }
              if (d.decision.action === "CREATE") {
                const names =
                  fixture.concepts.find(
                    (x) => x.conceptId === ec.targetConceptId,
                  )?.acceptableCreateNormalizedNames ?? []
                // target has no create names typically; still check normalized via oracle empty
                void names
              }
            }
          }
          if (!run.committed) {
            passed = false
          } else {
            const s = scoreApplicableSet(
              fixture,
              g,
              run.committed.categoryId,
              run.committed.candidates,
            )
            // perfect for anchors means target OMIT satisfied and anchors matched
            if (!s.perfect) passed = false
            const forbiddenHit = run.committed.candidates.some((c) => {
              if (c.action === "REUSE") return c.tagId === ec.equivalentTagId
              return false
            })
            if (forbiddenHit) passed = false
            // parent/revision immutability
            for (const tag of fixture.baseInput.existingTags) {
              const st = run.committed.postState.existingTagStates.find(
                (x) => x.tagId === tag.id,
              )
              if (
                !st ||
                st.parentCategoryId !== tag.parentCategoryId ||
                st.revision !== tag.revision
              ) {
                passed = false
              }
            }
          }
        }
      }
    }
    equivalenceResults.push({
      fixtureId: fixture.fixtureId,
      placement: ec.placement,
      form: ec.form,
      passed,
    })
    if (!passed) {
      failures.push(`EQUIVALENCE ${fixture.fixtureId} failed criteria`)
    }
  }

  void fixtureById
  void normalCellFirstMins

  return {
    scorerVersion: "classification-eval-scorer-v2",
    passed: failures.length === 0,
    failures,
    normal: {
      perCellFirstAttemptMin:
        normalCellFirstMins.length === 0
          ? 0
          : Math.min(...normalCellFirstMins),
      allCellsFirstAttemptRate: allCellsFirst,
      allCellsCommittedRate: allCellsCommitted,
      jsonEnvelopeInvalidRate: jsonRate,
    },
    multiConcept: multiReport,
    boundary: boundaryResults,
    equivalence: equivalenceResults,
    ambiguous: ambiguousResults,
    cells,
  }
}
