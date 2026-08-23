/**
 * Classification evaluation types (AI_GUIDE §必須の実モデル評価)
 * production runtime とは分離。policy v2 / fixture v3 / result v1 / scorer v2。
 */
import type { Id } from "~/domain"

export const FIXTURE_SCHEMA_VERSION = 3 as const
export const RESULT_SCHEMA_VERSION = 1 as const
export const SCORER_VERSION = "classification-eval-scorer-v2" as const
export const PROMPT_VERSION = "gemini-nano-tag-classifier-v2" as const
export const RESPONSE_SCHEMA_VERSION = 2 as const
export const CANDIDATE_QUERY_VERSION = "all-active-labels-v1" as const
export const MAX_PROMPT_INPUT_BYTES = 262_144
export const MAX_MODEL_RESPONSE_BYTES = 262_144
export const EVAL_SAMPLE_SIZE = 10

export type TagImportance = "CORE" | "MAJOR" | "SUPPORTING" | "DETAIL"
export type Granularity = 0 | 1 | 2 | 3 | 4

export type ClassificationPolicySnapshotV2 =
  | {
      policyVersion: 2
      granularity: 0
      reusePolicy: "STRONG_REUSE"
      allowedCreateImportance: readonly ["CORE"]
    }
  | {
      policyVersion: 2
      granularity: 1
      reusePolicy: "PREFER_REUSE"
      allowedCreateImportance: readonly ["CORE"]
    }
  | {
      policyVersion: 2
      granularity: 2
      reusePolicy: "BALANCED"
      allowedCreateImportance: readonly ["CORE", "MAJOR"]
    }
  | {
      policyVersion: 2
      granularity: 3
      reusePolicy: "NEAR_EXACT_REUSE"
      allowedCreateImportance: readonly ["CORE", "MAJOR", "SUPPORTING"]
    }
  | {
      policyVersion: 2
      granularity: 4
      reusePolicy: "EXACT_EQUIVALENT_REUSE"
      allowedCreateImportance: readonly [
        "CORE",
        "MAJOR",
        "SUPPORTING",
        "DETAIL",
      ]
    }

export type ClassificationRetryReasonCode =
  | "RESPONSE_SCHEMA_INVALID"
  | "CANDIDATE_SCHEMA_INVALID"
  | "MODEL_TIMEOUT"
  | "MODEL_RESPONSE_INTERRUPTED"
  | "MODEL_RESPONSE_TRUNCATED"
  | "MODEL_RESPONSE_SIZE_EXCEEDED"
  | "MODEL_RESULT_LOST"
  | "MODEL_NEEDS_REVIEW"
  | "CATEGORY_INVALID"
  | "NO_VALID_CANDIDATE"
  | "REUSE_ID_INVALID"
  | "REUSE_PARENT_MISMATCH"
  | "EVIDENCE_INVALID"
  | "IMPORTANCE_NOT_ALLOWED"
  | "NAME_INVALID"
  | "DUPLICATE"

export interface ClassificationPromptInputV2 {
  promptVersion: typeof PROMPT_VERSION
  responseSchemaVersion: typeof RESPONSE_SCHEMA_VERSION
  candidateQueryVersion: typeof CANDIDATE_QUERY_VERSION
  maxPromptInputBytes: typeof MAX_PROMPT_INPUT_BYTES
  maxModelResponseBytes: typeof MAX_MODEL_RESPONSE_BYTES
  policy: ClassificationPolicySnapshotV2
  bookmark: {
    title: string
    normalizedUrl: string
  }
  categories: Array<{
    id: Id
    name: string
    revision: number
  }>
  existingTags: Array<{
    id: Id
    name: string
    origin: "USER" | "AI" | "IMPORT" | "SHARE"
    revision: number
    parentCategoryId: Id
    parentCategoryRevision: number
  }>
  retryContext: null | {
    previousModelAttempt: 1 | 2
    reasonCodes: ClassificationRetryReasonCode[]
  }
}

export type EquivalenceFormV3 =
  | "EXACT"
  | "NORMALIZED"
  | "SYNONYM"
  | "FORMAL_ABBREVIATION"
  | "TRANSLATION"
  | "ORTHOGRAPHIC_VARIANT"

export type NonAmbiguousEvaluationCaseV3 =
  | { kind: "NORMAL" }
  | {
      kind: "MULTI_CONCEPT"
      cMinConceptIds: string[]
      cAllCoreConceptIds: string[]
      majorConceptIds: string[]
      supportingConceptIds: string[]
      detailConceptIds: string[]
    }
  | {
      kind: "BOUNDARY"
      boundary: "0_TO_1"
      broadReuseConceptId: string
      specificCoreCreateConceptId: string
    }
  | {
      kind: "BOUNDARY"
      boundary: "1_TO_2" | "2_TO_3" | "3_TO_4"
      targetCreateConceptId: string
    }
  | {
      kind: "EQUIVALENCE"
      form: EquivalenceFormV3
      placement: "IN_SELECTED_CATEGORY" | "OUTSIDE_SELECTED_CATEGORY_ONLY"
      targetConceptId: string
      equivalentTagId: Id
    }

export interface ClassificationEvaluationFixtureCommonV3 {
  fixtureId: string
  baseInput: Omit<ClassificationPromptInputV2, "policy" | "retryContext">
  initialState: {
    bookmarkId: Id
    bookmarkRevision: number
    activeTagIds: Id[]
    reservedTagTombstoneNormalizedNames: string[]
  }
  concepts: Array<{
    conceptId: string
    importance: TagImportance
    acceptableReuseTagIds: Id[]
    acceptableCreateNormalizedNames: string[]
    expectations: Array<{
      granularity: Granularity
      action: "REUSE" | "CREATE" | "OMIT"
    }>
  }>
}

export type ClassificationEvaluationFixtureV3 =
  | (ClassificationEvaluationFixtureCommonV3 & {
      evaluationCase: { kind: "AMBIGUOUS" }
      expectedCategoryId: "NEEDS_REVIEW"
    })
  | (ClassificationEvaluationFixtureCommonV3 & {
      evaluationCase: NonAmbiguousEvaluationCaseV3
      expectedCategoryId: Id
    })

export interface ClassificationEvaluationFixtureSetV3 {
  fixtureSchemaVersion: typeof FIXTURE_SCHEMA_VERSION
  fixtureVersion: string
  scorerVersion: typeof SCORER_VERSION
  fixtures: ClassificationEvaluationFixtureV3[]
}

export type EvaluationExclusionReasonV1 =
  | "DEVICE_UNSUPPORTED"
  | "PROMPT_API_UNAVAILABLE_BEFORE_FIRST_DISPATCH"
  | "MODEL_NOT_READY_BEFORE_FIRST_DISPATCH"
  | "AI_HOST_LOST_BEFORE_FIRST_DISPATCH"
  | "HARNESS_FAILURE_BEFORE_FIRST_DISPATCH"

export type EvaluationTerminalReasonCodeV1 =
  | "APPLIED"
  | "QUALITY_ZERO_EXHAUSTED"
  | "DISPATCH_BUDGET_EXHAUSTED_WITH_TECHNICAL_FAILURE"
  | "EXECUTION_ATTEMPT_LIMIT_EXCEEDED"
  | "CANCELED_STALE"
  | "CANCELED_SETTINGS"
  | "CANCELED_USER"

export type TagDecision =
  | {
      action: "REUSE"
      tagId: Id
      importance: TagImportance
      evidenceText: string
      confidence: number
    }
  | {
      action: "CREATE"
      name: string
      importance: TagImportance
      evidenceText: string
      confidence: number
    }

export type EvaluationDecisionCandidateV1 = {
  sourceIndex: number
  decision: TagDecision
}

export type EvaluationDiagnosticReasonCodeV1 =
  | ClassificationRetryReasonCode
  | "INPUT_CONTEXT_TOO_LARGE"
  | "STALE_CLASSIFICATION_INPUT"
  | "AI_DISABLED"
  | "SETTINGS_RECONFIGURATION_REQUIRED"
  | "EXECUTION_ATTEMPT_LIMIT_EXCEEDED"
  | "CLASSIFICATION_JOB_INVARIANT_VIOLATION"

export type EvaluationApplicableCandidateV1 =
  | {
      sourceIndex: number
      action: "REUSE"
      tagId: Id
      importance: TagImportance
    }
  | {
      sourceIndex: number
      action: "CREATE"
      name: string
      normalizedName: string
      importance: TagImportance
    }

export interface EvaluationAttemptResultV1 {
  attemptId: Id
  ordinal: 1 | 2 | 3
  dispatchReserved: true
  finalPhase: "CLOSED"
  responseDisposition:
    | "JSON_INVALID"
    | "ENVELOPE_INVALID"
    | "ENVELOPE_VALID"
    | "NO_RESPONSE"
    | "TECHNICAL_FAILURE"
  outcome:
    | "GLOBAL_INVALID"
    | "ZERO_VALID"
    | "APPLIED"
    | "TECHNICAL_FAILURE"
    | "CANCELED_STALE"
    | "CANCELED_SETTINGS"
    | "CANCELED_USER"
  rawCandidateCount: number
  modelDecisionCategoryId: string | null
  modelDecisionCandidates: EvaluationDecisionCandidateV1[]
  candidateSchemaInvalidIndexes: number[]
  applicableCategoryId: Id | null
  applicableCandidates: EvaluationApplicableCandidateV1[]
  diagnosticReasonCodes: EvaluationDiagnosticReasonCodeV1[]
}

export interface EvaluationCommittedResultV1 {
  sourceAttemptId: Id
  sourceAttemptOrdinal: 1 | 2 | 3
  categoryId: Id
  candidates: EvaluationApplicableCandidateV1[]
  postState: {
    bookmarkClassificationState: "CLASSIFIED"
    bookmarkRevision: number
    activeTagIds: Id[]
    existingTagStates: Array<{
      tagId: Id
      parentCategoryId: Id
      revision: number
    }>
  }
}

export interface EvaluationEnvironmentV1 {
  chromeVersion: string
  operatingSystem: string
  locale: string
  promptApiState:
    | "AVAILABLE"
    | "DOWNLOADABLE"
    | "DOWNLOADING"
    | "UNAVAILABLE"
  providerModel: string | null
}

export interface EvaluationRunCommonV1 {
  runId: string
  fixtureId: string
  granularity: Granularity
  runSequence: number
  policy: ClassificationPolicySnapshotV2
  environment: EvaluationEnvironmentV1
  executionAttempt: 0 | 1 | 2 | 3
}

export type EvaluationRunResultV1 =
  | (EvaluationRunCommonV1 & {
      disposition: "INCLUDED"
      sampleIndex: number
      exclusionPhase: null
      exclusionReason: null
      modelAttempt: 1 | 2 | 3
      attempts: EvaluationAttemptResultV1[]
      finalJobState: "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW" | "CANCELED"
      terminalReasonCode: EvaluationTerminalReasonCodeV1
      committed: EvaluationCommittedResultV1 | null
    })
  | (EvaluationRunCommonV1 & {
      disposition: "EXCLUDED"
      sampleIndex: null
      exclusionPhase: "BEFORE_CLAIM" | "PREPARED"
      exclusionReason: EvaluationExclusionReasonV1
      modelAttempt: 0
      attempts: []
      finalJobState: null
      terminalReasonCode: null
      committed: null
    })

export interface ClassificationEvaluationResultArtifactV1 {
  resultSchemaVersion: typeof RESULT_SCHEMA_VERSION
  fixtureSchemaVersion: typeof FIXTURE_SCHEMA_VERSION
  fixtureVersion: string
  fixtureSetSha256: string
  scorerVersion: typeof SCORER_VERSION
  promptVersion: typeof PROMPT_VERSION
  responseSchemaVersion: typeof RESPONSE_SCHEMA_VERSION
  candidateQueryVersion: typeof CANDIDATE_QUERY_VERSION
  labelNormalizerVersion: 1
  labelNormalizerDataSha256: string
  runs: EvaluationRunResultV1[]
  resultArtifactSha256: string
}

export type FixtureInvalidCode = "FIXTURE_INVALID"

export class FixtureInvalidError extends Error {
  readonly code: FixtureInvalidCode = "FIXTURE_INVALID"
  constructor(message: string) {
    super(message)
    this.name = "FixtureInvalidError"
  }
}

export class ResultArtifactInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ResultArtifactInvalidError"
  }
}
