/**
 * fixture oracle に完全一致する決定的 Provider（評価基盤の回帰用）
 */
import { normalizeLabelName } from "~/domain"
import type { FakeProvider, FakeProviderScript } from "./fake-provider"
import type {
  ClassificationEvaluationFixtureSetV3,
  ClassificationPromptInputV2,
  EvaluationApplicableCandidateV1,
  Granularity,
} from "../types"

export function oraclePerfectProvider(
  fixtureSet: ClassificationEvaluationFixtureSetV3,
): FakeProvider {
  return {
    name: "fake-recorded-provider-v1",
    next(input: ClassificationPromptInputV2): FakeProviderScript {
      const fixture = fixtureSet.fixtures.find(
        (f) =>
          f.baseInput.bookmark.normalizedUrl === input.bookmark.normalizedUrl &&
          f.baseInput.bookmark.title === input.bookmark.title,
      )
      if (!fixture) {
        return { kind: "NEEDS_REVIEW", reviewReasonCode: "INSUFFICIENT_EVIDENCE" }
      }

      const g = input.policy.granularity as Granularity

      if (fixture.evaluationCase.kind === "AMBIGUOUS") {
        return { kind: "NEEDS_REVIEW", reviewReasonCode: "AMBIGUOUS" }
      }

      const expectedCategoryId = fixture.expectedCategoryId
      const tagDecisions: unknown[] = []
      const applicable: EvaluationApplicableCandidateV1[] = []

      for (const concept of fixture.concepts) {
        const exp = concept.expectations.find((e) => e.granularity === g)!
        if (exp.action === "OMIT") continue
        if (exp.action === "REUSE") {
          const tagId = concept.acceptableReuseTagIds[0]!
          const decision = {
            action: "REUSE" as const,
            tagId,
            importance: concept.importance,
            evidenceText: input.bookmark.title.slice(0, 24),
            confidence: 0.9,
          }
          const sourceIndex = tagDecisions.length
          tagDecisions.push(decision)
          applicable.push({
            sourceIndex,
            action: "REUSE",
            tagId,
            importance: concept.importance,
          })
        } else {
          const name = concept.acceptableCreateNormalizedNames[0]!
          const decision = {
            action: "CREATE" as const,
            name,
            importance: concept.importance,
            evidenceText: input.bookmark.title.slice(0, 24),
            confidence: 0.9,
          }
          const sourceIndex = tagDecisions.length
          tagDecisions.push(decision)
          applicable.push({
            sourceIndex,
            action: "CREATE",
            name,
            normalizedName: normalizeLabelName(name).normalized,
            importance: concept.importance,
          })
        }
      }

      // EQUIVALENCE OUTSIDE: also ensure MODEL_DECISION never mentions outside tag
      return {
        kind: "CLASSIFIED",
        categoryId: expectedCategoryId,
        tagDecisions,
        applicable,
        applicableCategoryId: expectedCategoryId,
      }
    },
  }
}

/** AMBIGUOUS を 3 回 quality-zero にする Provider */
export function alwaysNeedsReviewProvider(): FakeProvider {
  return {
    name: "fake-recorded-provider-v1",
    next() {
      return { kind: "NEEDS_REVIEW", reviewReasonCode: "AMBIGUOUS" }
    },
  }
}
