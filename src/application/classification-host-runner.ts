/**
 * claim → Prompt API → validate → apply の Host 側オーケストレーション
 * Service Worker では実行しない。
 */
import {
  buildClassificationPromptInput,
  isPolicyV2,
  policyFromGranularity,
  resolveDispatchBudgetTerminal,
  validateClassificationModelResult,
  type ApplicableCandidate,
  type ClassificationPolicySnapshotV2,
  type SnapshotTag,
} from "~/domain"
import type { ClassificationProvider } from "~/ports/classification-provider"
import { ClassificationProviderError } from "~/ports/classification-provider"

export type HostLabelCategory = {
  id: string
  name: string
  revision: number
}

export type HostLabelTag = {
  id: string
  name: string
  normalizedName: string
  origin: "USER" | "AI" | "IMPORT" | "SHARE"
  revision: number
  parentCategoryId: string
  parentCategoryRevision: number
  deletedAt: number | null
}

export type ClaimedClassificationContext = {
  jobId: string
  executorInstanceId: string
  bookmarkRevision: number
  bookmarkTitle: string
  bookmarkNormalizedUrl: string
  policy: ClassificationPolicySnapshotV2
  categories: HostLabelCategory[]
  existingTags: HostLabelTag[]
}

export type ClassificationHostPorts = {
  claim(): Promise<ClaimedClassificationContext | null>
  applyValidated(args: {
    jobId: string
    executorInstanceId: string
    bookmarkRevision: number
    categoryId: string
    candidates: ApplicableCandidate[]
  }): Promise<void>
  applyTerminal(args: {
    jobId: string
    executorInstanceId: string
    bookmarkRevision: number
    outcome: "FAILED" | "NEEDS_REVIEW" | "CANCELED"
    errorCode: string | null
  }): Promise<void>
}

export type ClassificationHostRunResult =
  | { status: "NO_JOB" }
  | { status: "SKIPPED_UNAVAILABLE"; capabilityState: string }
  | {
      status: "APPLIED"
      jobId: string
      acceptedCount: number
      rejectedCount: number
      debug: ClassificationHostAttemptDebug
    }
  | {
      status: "TERMINAL"
      jobId: string
      outcome: "FAILED" | "NEEDS_REVIEW"
      errorCode: string
      attemptOutcome: string
      debug: ClassificationHostAttemptDebug | null
    }
  | {
      status: "ERROR"
      code: string
      message: string
      debug: ClassificationHostAttemptDebug | null
    }

/** Host デバッグ用。モデル生応答と検証要約（本番 Job 永続化には使わない）。 */
export type ClassificationHostAttemptDebug = {
  rawText: string
  parsed: unknown
  bookmark: {
    title: string
    normalizedUrl: string
  }
  validation: {
    responseDisposition: string
    outcome: string
    rawCandidateCount: number
    modelDecisionCategoryId: string | null
    candidateSchemaInvalidIndexes: number[]
    diagnosticReasonCodes: readonly string[]
    acceptedCount: number
    rejectedCount: number
  }
}

const MAX_DEBUG_RAW_TEXT_CHARS = 16_384

function buildAttemptDebug(args: {
  rawText: string
  parsed: unknown
  bookmarkTitle: string
  bookmarkNormalizedUrl: string
  validated: {
    responseDisposition: string
    outcome: string
    rawCandidateCount: number
    modelDecisionCategoryId: string | null
    candidateSchemaInvalidIndexes: number[]
    diagnosticReasonCodes: readonly string[]
    acceptedCount: number
    rejectedCount: number
  }
}): ClassificationHostAttemptDebug {
  const rawText =
    args.rawText.length > MAX_DEBUG_RAW_TEXT_CHARS
      ? `${args.rawText.slice(0, MAX_DEBUG_RAW_TEXT_CHARS)}…[truncated]`
      : args.rawText
  return {
    rawText,
    parsed: args.parsed,
    bookmark: {
      title: args.bookmarkTitle,
      normalizedUrl: args.bookmarkNormalizedUrl,
    },
    validation: {
      responseDisposition: args.validated.responseDisposition,
      outcome: args.validated.outcome,
      rawCandidateCount: args.validated.rawCandidateCount,
      modelDecisionCategoryId: args.validated.modelDecisionCategoryId,
      candidateSchemaInvalidIndexes: [
        ...args.validated.candidateSchemaInvalidIndexes,
      ],
      diagnosticReasonCodes: [...args.validated.diagnosticReasonCodes],
      acceptedCount: args.validated.acceptedCount,
      rejectedCount: args.validated.rejectedCount,
    },
  }
}

function logAttemptDebug(jobId: string, debug: ClassificationHostAttemptDebug): void {
  console.info("[Bookmation] Classification Host model response", {
    jobId,
    bookmark: debug.bookmark,
    rawText: debug.rawText,
    parsed: debug.parsed,
    validation: debug.validation,
  })
}

function toSnapshotTags(tags: HostLabelTag[]): SnapshotTag[] {
  return tags.map((t) => ({
    id: t.id,
    name: t.name,
    normalizedName: t.normalizedName,
    origin: t.origin,
    revision: t.revision,
    parentCategoryId: t.parentCategoryId,
    parentCategoryRevision: t.parentCategoryRevision,
    deletedAt: t.deletedAt,
  }))
}

/**
 * 1 Job を claim し、Gemini Nano を1回呼び、検証結果を適用する。
 * 本縦スライスは attempt=1。3 quality-zero の NEEDS_REVIEW は
 * resolveDispatchBudgetTerminal の骨格のみ（単発では FAILED へ寄せる）。
 */
export async function runOneClassificationJob(args: {
  provider: ClassificationProvider
  ports: ClassificationHostPorts
}): Promise<ClassificationHostRunResult> {
  const capability = await args.provider.capability()
  if (capability.state !== "AVAILABLE") {
    return {
      status: "SKIPPED_UNAVAILABLE",
      capabilityState: capability.state,
    }
  }

  const claimed = await args.ports.claim()
  if (!claimed) {
    return { status: "NO_JOB" }
  }

  if (!isPolicyV2(claimed.policy)) {
    await args.ports.applyTerminal({
      jobId: claimed.jobId,
      executorInstanceId: claimed.executorInstanceId,
      bookmarkRevision: claimed.bookmarkRevision,
      outcome: "FAILED",
      errorCode: "CLASSIFICATION_POLICY_INVALID",
    })
    return {
      status: "TERMINAL",
      jobId: claimed.jobId,
      outcome: "FAILED",
      errorCode: "CLASSIFICATION_POLICY_INVALID",
      attemptOutcome: "GLOBAL_INVALID",
      debug: null,
    }
  }

  const promptInput = buildClassificationPromptInput({
    policy: claimed.policy,
    bookmark: {
      title: claimed.bookmarkTitle,
      normalizedUrl: claimed.bookmarkNormalizedUrl,
    },
    categories: claimed.categories,
    existingTags: claimed.existingTags.map((t) => ({
      id: t.id,
      name: t.name,
      origin: t.origin,
      revision: t.revision,
      parentCategoryId: t.parentCategoryId,
      parentCategoryRevision: t.parentCategoryRevision,
    })),
    retryContext: null,
  })

  try {
    const output = await args.provider.classify(promptInput)
    const validated = validateClassificationModelResult({
      raw: output.parsed,
      promptInput,
      snapshotTags: toSnapshotTags(claimed.existingTags),
      policy: claimed.policy,
    })
    const debug = buildAttemptDebug({
      rawText: output.rawText,
      parsed: output.parsed,
      bookmarkTitle: claimed.bookmarkTitle,
      bookmarkNormalizedUrl: claimed.bookmarkNormalizedUrl,
      validated,
    })
    logAttemptDebug(claimed.jobId, debug)

    if (
      validated.outcome === "APPLIED" &&
      validated.applicableCategoryId &&
      validated.applicableCandidates.length > 0
    ) {
      await args.ports.applyValidated({
        jobId: claimed.jobId,
        executorInstanceId: claimed.executorInstanceId,
        bookmarkRevision: claimed.bookmarkRevision,
        categoryId: validated.applicableCategoryId,
        candidates: validated.applicableCandidates,
      })
      return {
        status: "APPLIED",
        jobId: claimed.jobId,
        acceptedCount: validated.acceptedCount,
        rejectedCount: validated.rejectedCount,
        debug,
      }
    }

    // 単発縦スライス: 3枠未実装のため quality-zero / technical は FAILED へ
    // （将来 DISPATCH_RESERVED で NEEDS_REVIEW 分岐）
    const budget = resolveDispatchBudgetTerminal([validated.outcome])
    const errorCode =
      validated.diagnosticReasonCodes[0] ??
      (validated.outcome === "TECHNICAL_FAILURE"
        ? "PROMPT_TECHNICAL_FAILURE"
        : "NO_VALID_CANDIDATE")
    const outcome =
      budget === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "FAILED"

    await args.ports.applyTerminal({
      jobId: claimed.jobId,
      executorInstanceId: claimed.executorInstanceId,
      bookmarkRevision: claimed.bookmarkRevision,
      outcome,
      errorCode,
    })
    return {
      status: "TERMINAL",
      jobId: claimed.jobId,
      outcome,
      errorCode,
      attemptOutcome: validated.outcome,
      debug,
    }
  } catch (error) {
    const code =
      error instanceof ClassificationProviderError
        ? error.code
        : "PROMPT_SESSION_FAILED"
    await args.ports.applyTerminal({
      jobId: claimed.jobId,
      executorInstanceId: claimed.executorInstanceId,
      bookmarkRevision: claimed.bookmarkRevision,
      outcome: "FAILED",
      errorCode: code,
    })
    return {
      status: "ERROR",
      code,
      message: error instanceof Error ? error.message : String(error),
      debug: null,
    }
  }
}

export function defaultPolicyFromJobPolicy(
  policy: unknown,
): ClassificationPolicySnapshotV2 {
  if (
    policy &&
    typeof policy === "object" &&
    (policy as { policyVersion?: number }).policyVersion === 2
  ) {
    return policy as ClassificationPolicySnapshotV2
  }
  return policyFromGranularity(2)
}
