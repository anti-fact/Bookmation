/**
 * 決定的 fake / recorded Classification Provider（制御系試験用）
 */
import type { Id } from "~/domain"
import type {
  ClassificationPromptInputV2,
  EvaluationApplicableCandidateV1,
  EvaluationAttemptResultV1,
  EvaluationDecisionCandidateV1,
  EvaluationDiagnosticReasonCodeV1,
  TagDecision,
  TagImportance,
} from "../types"

export type FakeProviderScript =
  | {
      kind: "JSON_INVALID"
      rawText: string
    }
  | {
      kind: "ENVELOPE_INVALID"
    }
  | {
      kind: "TECHNICAL_FAILURE"
      code:
        | "MODEL_TIMEOUT"
        | "MODEL_RESPONSE_INTERRUPTED"
        | "MODEL_RESPONSE_TRUNCATED"
        | "MODEL_RESPONSE_SIZE_EXCEEDED"
        | "MODEL_RESULT_LOST"
    }
  | {
      kind: "NO_RESPONSE"
    }
  | {
      kind: "NEEDS_REVIEW"
      reviewReasonCode: "AMBIGUOUS" | "INSUFFICIENT_EVIDENCE" | "NO_COMPATIBLE_CATEGORY"
    }
  | {
      kind: "CLASSIFIED"
      categoryId: string
      tagDecisions: unknown[]
      /** candidate schema を通す index。残りは invalid */
      validDecisionIndexes?: number[]
      /** 信頼側適用対象。省略時は valid 全件を適用可能とみなす簡易経路 */
      applicable?: EvaluationApplicableCandidateV1[]
      applicableCategoryId?: string
    }
  | {
      kind: "LATE_RESPONSE"
      /** 受付拒否されるべき遅延応答 */
      categoryId: string
      tagDecisions: unknown[]
    }
  | {
      kind: "DB_ROLLBACK"
      categoryId: string
      applicable: EvaluationApplicableCandidateV1[]
    }

export interface FakeProvider {
  readonly name: "fake-recorded-provider-v1"
  next(input: ClassificationPromptInputV2): FakeProviderScript
}

export function scriptedProvider(scripts: FakeProviderScript[]): FakeProvider {
  let i = 0
  return {
    name: "fake-recorded-provider-v1",
    next(_input) {
      const script = scripts[i]
      i += 1
      if (!script) {
        return { kind: "NEEDS_REVIEW", reviewReasonCode: "INSUFFICIENT_EVIDENCE" }
      }
      return script
    },
  }
}

function isTagDecision(value: unknown): value is TagDecision {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  if (v.action === "REUSE") {
    return (
      typeof v.tagId === "string" &&
      typeof v.importance === "string" &&
      typeof v.evidenceText === "string" &&
      typeof v.confidence === "number"
    )
  }
  if (v.action === "CREATE") {
    return (
      typeof v.name === "string" &&
      typeof v.importance === "string" &&
      typeof v.evidenceText === "string" &&
      typeof v.confidence === "number"
    )
  }
  return false
}

export function materializeAttemptFromScript(args: {
  attemptId: Id
  ordinal: 1 | 2 | 3
  script: FakeProviderScript
  acceptLate?: boolean
}): {
  attempt: EvaluationAttemptResultV1
  lateRejected?: boolean
  rolledBack?: boolean
} {
  const { attemptId, ordinal, script } = args

  if (script.kind === "LATE_RESPONSE") {
    if (!args.acceptLate) {
      return {
        lateRejected: true,
        attempt: {
          attemptId,
          ordinal,
          dispatchReserved: true,
          finalPhase: "CLOSED",
          responseDisposition: "NO_RESPONSE",
          outcome: "TECHNICAL_FAILURE",
          rawCandidateCount: 0,
          modelDecisionCategoryId: null,
          modelDecisionCandidates: [],
          candidateSchemaInvalidIndexes: [],
          applicableCategoryId: null,
          applicableCandidates: [],
          diagnosticReasonCodes: ["MODEL_RESULT_LOST"],
        },
      }
    }
    // acceptLate は試験用。CLASSIFIED 相当として扱う
    return materializeAttemptFromScript({
      attemptId,
      ordinal,
      script: {
        kind: "CLASSIFIED",
        categoryId: script.categoryId,
        tagDecisions: script.tagDecisions,
      },
      acceptLate: true,
    })
  }

  if (script.kind === "JSON_INVALID") {
    return {
      attempt: {
        attemptId,
        ordinal,
        dispatchReserved: true,
        finalPhase: "CLOSED",
        responseDisposition: "JSON_INVALID",
        outcome: "GLOBAL_INVALID",
        rawCandidateCount: 0,
        modelDecisionCategoryId: null,
        modelDecisionCandidates: [],
        candidateSchemaInvalidIndexes: [],
        applicableCategoryId: null,
        applicableCandidates: [],
        diagnosticReasonCodes: ["RESPONSE_SCHEMA_INVALID"],
      },
    }
  }

  if (script.kind === "ENVELOPE_INVALID") {
    return {
      attempt: {
        attemptId,
        ordinal,
        dispatchReserved: true,
        finalPhase: "CLOSED",
        responseDisposition: "ENVELOPE_INVALID",
        outcome: "GLOBAL_INVALID",
        rawCandidateCount: 0,
        modelDecisionCategoryId: null,
        modelDecisionCandidates: [],
        candidateSchemaInvalidIndexes: [],
        applicableCategoryId: null,
        applicableCandidates: [],
        diagnosticReasonCodes: ["RESPONSE_SCHEMA_INVALID"],
      },
    }
  }

  if (script.kind === "TECHNICAL_FAILURE") {
    return {
      attempt: {
        attemptId,
        ordinal,
        dispatchReserved: true,
        finalPhase: "CLOSED",
        responseDisposition: "TECHNICAL_FAILURE",
        outcome: "TECHNICAL_FAILURE",
        rawCandidateCount: 0,
        modelDecisionCategoryId: null,
        modelDecisionCandidates: [],
        candidateSchemaInvalidIndexes: [],
        applicableCategoryId: null,
        applicableCandidates: [],
        diagnosticReasonCodes: [script.code],
      },
    }
  }

  if (script.kind === "NO_RESPONSE") {
    return {
      attempt: {
        attemptId,
        ordinal,
        dispatchReserved: true,
        finalPhase: "CLOSED",
        responseDisposition: "NO_RESPONSE",
        outcome: "TECHNICAL_FAILURE",
        rawCandidateCount: 0,
        modelDecisionCategoryId: null,
        modelDecisionCandidates: [],
        candidateSchemaInvalidIndexes: [],
        applicableCategoryId: null,
        applicableCandidates: [],
        diagnosticReasonCodes: ["MODEL_RESULT_LOST"],
      },
    }
  }

  if (script.kind === "NEEDS_REVIEW") {
    return {
      attempt: {
        attemptId,
        ordinal,
        dispatchReserved: true,
        finalPhase: "CLOSED",
        responseDisposition: "ENVELOPE_VALID",
        outcome: "GLOBAL_INVALID",
        rawCandidateCount: 0,
        modelDecisionCategoryId: null,
        modelDecisionCandidates: [],
        candidateSchemaInvalidIndexes: [],
        applicableCategoryId: null,
        applicableCandidates: [],
        diagnosticReasonCodes: ["MODEL_NEEDS_REVIEW"],
      },
    }
  }

  if (script.kind === "DB_ROLLBACK") {
    return {
      rolledBack: true,
      attempt: {
        attemptId,
        ordinal,
        dispatchReserved: true,
        finalPhase: "CLOSED",
        responseDisposition: "ENVELOPE_VALID",
        outcome: "TECHNICAL_FAILURE",
        rawCandidateCount: script.applicable.length,
        modelDecisionCategoryId: script.categoryId,
        modelDecisionCandidates: script.applicable.map((c, sourceIndex) => ({
          sourceIndex,
          decision:
            c.action === "REUSE"
              ? {
                  action: "REUSE" as const,
                  tagId: c.tagId,
                  importance: c.importance,
                  evidenceText: "rollback",
                  confidence: 1,
                }
              : {
                  action: "CREATE" as const,
                  name: c.name,
                  importance: c.importance,
                  evidenceText: "rollback",
                  confidence: 1,
                },
        })),
        candidateSchemaInvalidIndexes: [],
        applicableCategoryId: script.categoryId,
        applicableCandidates: script.applicable,
        diagnosticReasonCodes: ["CLASSIFICATION_JOB_INVARIANT_VIOLATION"],
      },
    }
  }

  // CLASSIFIED
  const raw = script.tagDecisions
  const validIndexes =
    script.validDecisionIndexes ??
    raw.map((_, idx) => idx).filter((idx) => isTagDecision(raw[idx]))
  const validSet = new Set(validIndexes)
  const invalidIndexes: number[] = []
  const decisions: EvaluationDecisionCandidateV1[] = []
  for (let i = 0; i < raw.length; i++) {
    if (validSet.has(i) && isTagDecision(raw[i])) {
      decisions.push({ sourceIndex: i, decision: raw[i] as TagDecision })
    } else {
      invalidIndexes.push(i)
    }
  }

  const applicable =
    script.applicable ??
    decisions.map((d) => {
      if (d.decision.action === "REUSE") {
        return {
          sourceIndex: d.sourceIndex,
          action: "REUSE" as const,
          tagId: d.decision.tagId,
          importance: d.decision.importance as TagImportance,
        }
      }
      return {
        sourceIndex: d.sourceIndex,
        action: "CREATE" as const,
        name: d.decision.name,
        normalizedName: d.decision.name.toLowerCase(),
        importance: d.decision.importance as TagImportance,
      }
    })

  const applicableCategoryId = script.applicableCategoryId ?? script.categoryId
  const codes: EvaluationDiagnosticReasonCodeV1[] = []
  if (invalidIndexes.length > 0) codes.push("CANDIDATE_SCHEMA_INVALID")
  if (applicable.length === 0) codes.push("NO_VALID_CANDIDATE")

  const outcome =
    applicable.length > 0
      ? ("APPLIED" as const)
      : invalidIndexes.length === raw.length || raw.length === 0
        ? ("ZERO_VALID" as const)
        : ("ZERO_VALID" as const)

  return {
    attempt: {
      attemptId,
      ordinal,
      dispatchReserved: true,
      finalPhase: "CLOSED",
      responseDisposition: "ENVELOPE_VALID",
      outcome,
      rawCandidateCount: raw.length,
      modelDecisionCategoryId: script.categoryId,
      modelDecisionCandidates: decisions,
      candidateSchemaInvalidIndexes: invalidIndexes,
      applicableCategoryId: applicable.length > 0 ? applicableCategoryId : null,
      applicableCandidates: applicable.length > 0 ? applicable : [],
      diagnosticReasonCodes: codes,
    },
  }
}
