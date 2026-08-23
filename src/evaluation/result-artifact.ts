/**
 * result artifact v1: 正規化順・不変条件・resultArtifactSha256
 */
import { canonicalizeUnknown } from "./canonical-json"
import { isSha256LowerHex, sha256HexOfString } from "./hash"
import { policyV2FromGranularity } from "./policy-v2"
import {
  CANDIDATE_QUERY_VERSION,
  EVAL_SAMPLE_SIZE,
  FIXTURE_SCHEMA_VERSION,
  PROMPT_VERSION,
  RESPONSE_SCHEMA_VERSION,
  RESULT_SCHEMA_VERSION,
  ResultArtifactInvalidError,
  SCORER_VERSION,
} from "./types"
import type {
  ClassificationEvaluationFixtureSetV3,
  ClassificationEvaluationResultArtifactV1,
  EvaluationAttemptResultV1,
  EvaluationRunResultV1,
  Granularity,
} from "./types"

function fail(message: string): never {
  throw new ResultArtifactInvalidError(message)
}

function sortRuns(runs: EvaluationRunResultV1[]): EvaluationRunResultV1[] {
  return [...runs].sort((a, b) => {
    if (a.fixtureId !== b.fixtureId) {
      return a.fixtureId < b.fixtureId ? -1 : 1
    }
    if (a.granularity !== b.granularity) return a.granularity - b.granularity
    return a.runSequence - b.runSequence
  })
}

function normalizeAttempt(attempt: EvaluationAttemptResultV1): EvaluationAttemptResultV1 {
  const codes = [...new Set(attempt.diagnosticReasonCodes)].sort()
  return {
    ...attempt,
    modelDecisionCandidates: [...attempt.modelDecisionCandidates].sort(
      (a, b) => a.sourceIndex - b.sourceIndex,
    ),
    candidateSchemaInvalidIndexes: [
      ...attempt.candidateSchemaInvalidIndexes,
    ].sort((a, b) => a - b),
    applicableCandidates: [...attempt.applicableCandidates].sort(
      (a, b) => a.sourceIndex - b.sourceIndex,
    ),
    diagnosticReasonCodes: codes,
  }
}

function normalizeRun(run: EvaluationRunResultV1): EvaluationRunResultV1 {
  if (run.disposition === "EXCLUDED") return run
  const attempts = [...run.attempts]
    .map(normalizeAttempt)
    .sort((a, b) => a.ordinal - b.ordinal)
  let committed = run.committed
  if (committed) {
    committed = {
      ...committed,
      candidates: [...committed.candidates].sort(
        (a, b) => a.sourceIndex - b.sourceIndex,
      ),
      postState: {
        ...committed.postState,
        activeTagIds: [...committed.postState.activeTagIds].sort(),
        existingTagStates: [...committed.postState.existingTagStates].sort(
          (a, b) => (a.tagId < b.tagId ? -1 : a.tagId > b.tagId ? 1 : 0),
        ),
      },
    }
  }
  return { ...run, attempts, committed }
}

export function normalizeResultArtifact(
  artifact: Omit<ClassificationEvaluationResultArtifactV1, "resultArtifactSha256"> & {
    resultArtifactSha256?: string
  },
): Omit<ClassificationEvaluationResultArtifactV1, "resultArtifactSha256"> {
  return {
    resultSchemaVersion: artifact.resultSchemaVersion,
    fixtureSchemaVersion: artifact.fixtureSchemaVersion,
    fixtureVersion: artifact.fixtureVersion,
    fixtureSetSha256: artifact.fixtureSetSha256,
    scorerVersion: artifact.scorerVersion,
    promptVersion: artifact.promptVersion,
    responseSchemaVersion: artifact.responseSchemaVersion,
    candidateQueryVersion: artifact.candidateQueryVersion,
    labelNormalizerVersion: artifact.labelNormalizerVersion,
    labelNormalizerDataSha256: artifact.labelNormalizerDataSha256,
    runs: sortRuns(artifact.runs.map(normalizeRun)),
  }
}

export async function computeResultArtifactSha256(
  artifact: Omit<ClassificationEvaluationResultArtifactV1, "resultArtifactSha256">,
): Promise<string> {
  const normalized = normalizeResultArtifact(artifact)
  // undefined プロパティ等を落として JsonValue に正規化
  const plain = JSON.parse(JSON.stringify(normalized)) as unknown
  return sha256HexOfString(canonicalizeUnknown(plain))
}

export async function sealResultArtifact(
  artifact: Omit<ClassificationEvaluationResultArtifactV1, "resultArtifactSha256">,
): Promise<ClassificationEvaluationResultArtifactV1> {
  const normalized = normalizeResultArtifact(artifact)
  const resultArtifactSha256 = await computeResultArtifactSha256(normalized)
  return { ...normalized, resultArtifactSha256 }
}

function assertAttemptInvariants(attempt: EvaluationAttemptResultV1): void {
  if (!attempt.dispatchReserved || attempt.finalPhase !== "CLOSED") {
    fail("attempt must be DISPATCH_RESERVED CLOSED")
  }

  const disposition = attempt.responseDisposition
  if (disposition === "ENVELOPE_VALID") {
    if (
      !Number.isInteger(attempt.rawCandidateCount) ||
      attempt.rawCandidateCount < 0
    ) {
      fail("ENVELOPE_VALID rawCandidateCount must be >= 0")
    }
    const decisionIdx = new Set(
      attempt.modelDecisionCandidates.map((c) => c.sourceIndex),
    )
    const invalidIdx = new Set(attempt.candidateSchemaInvalidIndexes)
    for (let i = 0; i < attempt.rawCandidateCount; i++) {
      const inD = decisionIdx.has(i)
      const inI = invalidIdx.has(i)
      if (inD === inI) {
        fail("MODEL_DECISION and invalid indexes must partition 0..n-1")
      }
    }
    if (
      decisionIdx.size + invalidIdx.size !== attempt.rawCandidateCount
    ) {
      fail("sourceIndex partition size mismatch")
    }
    for (const c of attempt.applicableCandidates) {
      if (!decisionIdx.has(c.sourceIndex)) {
        fail("APPLICABLE sourceIndex must be subset of MODEL_DECISION")
      }
    }
  } else {
    if (attempt.rawCandidateCount !== 0) fail("non-ENVELOPE_VALID rawCandidateCount must be 0")
    if (attempt.modelDecisionCandidates.length !== 0) fail("modelDecisionCandidates must be empty")
    if (attempt.candidateSchemaInvalidIndexes.length !== 0) {
      fail("candidateSchemaInvalidIndexes must be empty")
    }
    if (attempt.applicableCandidates.length !== 0) fail("applicableCandidates must be empty")
    if (attempt.modelDecisionCategoryId !== null || attempt.applicableCategoryId !== null) {
      fail("categories must be null for non-ENVELOPE_VALID")
    }
  }

  if (
    attempt.outcome === "GLOBAL_INVALID" ||
    attempt.outcome === "ZERO_VALID"
  ) {
    if (attempt.applicableCandidates.length !== 0) {
      fail("quality-zero must have 0 APPLICABLE")
    }
  }
  if (attempt.outcome === "ZERO_VALID" && disposition !== "ENVELOPE_VALID") {
    fail("ZERO_VALID requires ENVELOPE_VALID")
  }
  if (attempt.outcome === "TECHNICAL_FAILURE") {
    if (
      disposition !== "NO_RESPONSE" &&
      disposition !== "TECHNICAL_FAILURE"
    ) {
      fail("TECHNICAL_FAILURE outcome requires NO_RESPONSE or TECHNICAL_FAILURE disposition")
    }
  }
  if (attempt.outcome === "GLOBAL_INVALID") {
    if (
      disposition !== "JSON_INVALID" &&
      disposition !== "ENVELOPE_INVALID" &&
      disposition !== "ENVELOPE_VALID"
    ) {
      fail("GLOBAL_INVALID disposition invalid")
    }
  }
  if (attempt.outcome === "APPLIED") {
    if (disposition !== "ENVELOPE_VALID") fail("APPLIED requires ENVELOPE_VALID")
    if (attempt.applicableCandidates.length < 1) {
      fail("APPLIED requires >=1 APPLICABLE")
    }
  }
}

function assertIncludedRun(run: Extract<EvaluationRunResultV1, { disposition: "INCLUDED" }>): void {
  if (run.modelAttempt !== run.attempts.length) {
    fail("modelAttempt must equal attempts.length")
  }
  if (run.attempts.length < 1 || run.attempts.length > 3) {
    fail("INCLUDED must have 1..3 attempts")
  }
  for (let i = 0; i < run.attempts.length; i++) {
    const ordinal = (i + 1) as 1 | 2 | 3
    if (run.attempts[i]!.ordinal !== ordinal) {
      fail("attempt ordinals must be contiguous from 1")
    }
    assertAttemptInvariants(run.attempts[i]!)
  }

  const last = run.attempts[run.attempts.length - 1]!
  const applied = run.attempts.filter((a) => a.outcome === "APPLIED")
  if (run.finalJobState === "SUCCEEDED") {
    if (run.terminalReasonCode !== "APPLIED") fail("SUCCEEDED requires APPLIED reason")
    if (applied.length !== 1) fail("SUCCEEDED requires exactly one APPLIED attempt")
    if (last.outcome !== "APPLIED") fail("APPLIED must be last attempt")
    if (!run.committed) fail("SUCCEEDED requires COMMITTED")
    if (
      run.committed.sourceAttemptId !== last.attemptId ||
      run.committed.sourceAttemptOrdinal !== last.ordinal
    ) {
      fail("COMMITTED source attempt mismatch")
    }
    if (run.committed.categoryId !== last.applicableCategoryId) {
      fail("COMMITTED category must match APPLICABLE")
    }
    if (
      JSON.stringify(run.committed.candidates) !==
      JSON.stringify(last.applicableCandidates)
    ) {
      fail("COMMITTED candidates must equal last APPLICABLE")
    }
  } else {
    if (run.committed !== null) fail("non-SUCCEEDED committed must be null")
  }

  if (run.finalJobState === "NEEDS_REVIEW") {
    if (run.terminalReasonCode !== "QUALITY_ZERO_EXHAUSTED") {
      fail("NEEDS_REVIEW reason")
    }
    if (run.modelAttempt !== 3) fail("NEEDS_REVIEW requires modelAttempt=3")
    if (
      !run.attempts.every(
        (a) => a.outcome === "GLOBAL_INVALID" || a.outcome === "ZERO_VALID",
      )
    ) {
      fail("NEEDS_REVIEW requires all quality-zero")
    }
  }

  if (
    run.finalJobState === "FAILED" &&
    run.terminalReasonCode === "DISPATCH_BUDGET_EXHAUSTED_WITH_TECHNICAL_FAILURE"
  ) {
    if (run.modelAttempt !== 3) fail("dispatch FAILED requires modelAttempt=3")
    const outcomes = run.attempts.map((a) => a.outcome)
    if (
      !outcomes.every(
        (o) =>
          o === "GLOBAL_INVALID" ||
          o === "ZERO_VALID" ||
          o === "TECHNICAL_FAILURE",
      )
    ) {
      fail("dispatch FAILED attempt outcomes invalid")
    }
    if (!outcomes.includes("TECHNICAL_FAILURE")) {
      fail("dispatch FAILED requires at least one TECHNICAL_FAILURE")
    }
  }

  if (
    run.finalJobState === "FAILED" &&
    run.terminalReasonCode === "EXECUTION_ATTEMPT_LIMIT_EXCEEDED"
  ) {
    if (run.executionAttempt !== 3) fail("execution FAILED requires executionAttempt=3")
    if (run.modelAttempt >= 3) fail("execution FAILED requires modelAttempt<3")
  }

  if (run.finalJobState === "CANCELED") {
    const code = run.terminalReasonCode
    if (
      code !== "CANCELED_STALE" &&
      code !== "CANCELED_SETTINGS" &&
      code !== "CANCELED_USER"
    ) {
      fail("CANCELED reason invalid")
    }
    if (last.outcome !== code) fail("CANCELED last outcome must match reason")
  }
}

export function assertResultArtifactInvariants(
  artifact: ClassificationEvaluationResultArtifactV1,
  fixtureSet: ClassificationEvaluationFixtureSetV3,
  expectedFixtureSetSha256: string,
  expectedNormalizerSha256: string,
): void {
  if (artifact.resultSchemaVersion !== RESULT_SCHEMA_VERSION) {
    fail("resultSchemaVersion mismatch")
  }
  if (artifact.fixtureSchemaVersion !== FIXTURE_SCHEMA_VERSION) {
    fail("fixtureSchemaVersion mismatch")
  }
  if (artifact.scorerVersion !== SCORER_VERSION) fail("scorerVersion mismatch")
  if (artifact.promptVersion !== PROMPT_VERSION) fail("promptVersion mismatch")
  if (artifact.responseSchemaVersion !== RESPONSE_SCHEMA_VERSION) {
    fail("responseSchemaVersion mismatch")
  }
  if (artifact.candidateQueryVersion !== CANDIDATE_QUERY_VERSION) {
    fail("candidateQueryVersion mismatch")
  }
  if (artifact.fixtureVersion !== fixtureSet.fixtureVersion) {
    fail("fixtureVersion mismatch")
  }
  if (artifact.fixtureSetSha256 !== expectedFixtureSetSha256) {
    fail("fixtureSetSha256 mismatch")
  }
  if (artifact.labelNormalizerDataSha256 !== expectedNormalizerSha256) {
    fail("labelNormalizerDataSha256 mismatch")
  }
  if (!isSha256LowerHex(artifact.fixtureSetSha256)) fail("fixtureSetSha256 format")
  if (!isSha256LowerHex(artifact.labelNormalizerDataSha256)) {
    fail("labelNormalizerDataSha256 format")
  }
  if (!isSha256LowerHex(artifact.resultArtifactSha256)) {
    fail("resultArtifactSha256 format")
  }

  const fixtureIds = new Set(fixtureSet.fixtures.map((f) => f.fixtureId))
  const runIds = new Set<string>()
  const cells = new Map<string, EvaluationRunResultV1[]>()

  for (const run of artifact.runs) {
    if (runIds.has(run.runId)) fail(`duplicate runId ${run.runId}`)
    runIds.add(run.runId)
    if (!fixtureIds.has(run.fixtureId)) fail(`unknown fixtureId ${run.fixtureId}`)
    const expectedPolicy = policyV2FromGranularity(run.granularity)
    if (JSON.stringify(run.policy) !== JSON.stringify(expectedPolicy)) {
      fail(`policy mismatch for ${run.fixtureId}@${run.granularity}`)
    }
    const key = `${run.fixtureId}|${run.granularity}`
    const list = cells.get(key) ?? []
    list.push(run)
    cells.set(key, list)

    if (run.disposition === "EXCLUDED") {
      if (run.modelAttempt !== 0 || run.attempts.length !== 0 || run.committed !== null) {
        fail("EXCLUDED shape invalid")
      }
      if (run.sampleIndex !== null || run.terminalReasonCode !== null) {
        fail("EXCLUDED sample/terminal must be null")
      }
    } else {
      assertIncludedRun(run)
    }
  }

  for (const fixture of fixtureSet.fixtures) {
    for (const g of [0, 1, 2, 3, 4] as Granularity[]) {
      const key = `${fixture.fixtureId}|${g}`
      const list = cells.get(key)
      if (!list) fail(`missing cell ${key}`)
      const sorted = [...list].sort((a, b) => a.runSequence - b.runSequence)
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i]!.runSequence !== i + 1) {
          fail(`runSequence gap in ${key}`)
        }
      }
      const included = sorted.filter((r) => r.disposition === "INCLUDED")
      if (included.length !== EVAL_SAMPLE_SIZE) {
        fail(`${key} must have exactly ${EVAL_SAMPLE_SIZE} INCLUDED`)
      }
      for (let i = 0; i < included.length; i++) {
        if (included[i]!.sampleIndex !== i + 1) {
          fail(`${key} sampleIndex must be 1..10 in runSequence order`)
        }
      }
    }
  }
}

export async function verifyResultArtifactHash(
  artifact: ClassificationEvaluationResultArtifactV1,
): Promise<void> {
  const { resultArtifactSha256: claimed, ...rest } = artifact
  const computed = await computeResultArtifactSha256(rest)
  if (claimed !== computed) {
    fail("resultArtifactSha256 mismatch")
  }
}
