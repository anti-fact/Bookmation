/**
 * 評価 batch harness（fake / recorded Provider）。
 * 実 Gemini Nano batch は Provider Port 差し替え + 環境確定後に実行する。
 */
import { getVendoredAssetSha256 } from "~/domain"
import { restoreIsolatedEvalDb } from "./isolated-db"
import {
  assignSampleIndexes,
  canExcludeAndReplenish,
  cellKey,
  SampleBudgetError,
} from "./exclusion"
import {
  type FakeProvider,
  materializeAttemptFromScript,
} from "../control/fake-provider"
import {
  freezeFixtureSet,
  labelNormalizerDataSha256,
} from "../fixture-preflight"
import { buildPromptInput } from "../prompt-input"
import { policyV2FromGranularity } from "../policy-v2"
import { sealResultArtifact } from "../result-artifact"
import type {
  ClassificationEvaluationFixtureSetV3,
  ClassificationEvaluationResultArtifactV1,
  EvaluationCommittedResultV1,
  EvaluationEnvironmentV1,
  EvaluationExclusionReasonV1,
  EvaluationRunResultV1,
  Granularity,
} from "../types"
import {
  CANDIDATE_QUERY_VERSION,
  EVAL_SAMPLE_SIZE,
  FIXTURE_SCHEMA_VERSION,
  PROMPT_VERSION,
  RESPONSE_SCHEMA_VERSION,
  RESULT_SCHEMA_VERSION,
  SCORER_VERSION,
} from "../types"

export interface BatchHarnessOptions {
  fixtureSet: ClassificationEvaluationFixtureSetV3
  provider: FakeProvider
  environment: EvaluationEnvironmentV1
  providerInputQuotaBytes: number
  /**
   * 実モデル未接続時は fake のみ。AVAILABLE 以外で実モデルを拒否する。
   */
  allowRealModel: boolean
  /** cell あたり最大試行（除外補充込み）。安全上限 */
  maxRunSequencePerCell?: number
  /**
   * 環境除外を注入するフック。undefined なら除外なし。
   * runSequence 開始時に呼ばれる。
   */
  exclusionHook?: (args: {
    fixtureId: string
    granularity: Granularity
    runSequence: number
  }) =>
    | {
        phase: "BEFORE_CLAIM" | "PREPARED"
        reason: EvaluationExclusionReasonV1
      }
    | null
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function buildCommitted(
  fixture: ClassificationEvaluationFixtureSetV3["fixtures"][number],
  attemptId: string,
  ordinal: 1 | 2 | 3,
  categoryId: string,
  candidates: EvaluationCommittedResultV1["candidates"],
): EvaluationCommittedResultV1 {
  const createdIds = candidates
    .filter((c) => c.action === "CREATE")
    .map((c) => `tag-created-${c.normalizedName.replace(/\s+/g, "-")}`)
  const reused = candidates
    .filter((c) => c.action === "REUSE")
    .map((c) => c.tagId)
  const activeTagIds = [
    ...new Set([...fixture.initialState.activeTagIds, ...reused, ...createdIds]),
  ].sort()

  return {
    sourceAttemptId: attemptId,
    sourceAttemptOrdinal: ordinal,
    categoryId,
    candidates,
    postState: {
      bookmarkClassificationState: "CLASSIFIED",
      bookmarkRevision: fixture.initialState.bookmarkRevision + 1,
      activeTagIds,
      existingTagStates: fixture.baseInput.existingTags
        .map((t) => ({
          tagId: t.id,
          parentCategoryId: t.parentCategoryId,
          revision: t.revision,
        }))
        .sort((a, b) => (a.tagId < b.tagId ? -1 : 1)),
    },
  }
}

/**
 * 1 cell を N=10 まで実行。除外は allowlist のみ補充。
 */
export async function runEvalCell(args: {
  fixtureSet: ClassificationEvaluationFixtureSetV3
  fixtureId: string
  granularity: Granularity
  provider: FakeProvider
  environment: EvaluationEnvironmentV1
  exclusionHook?: BatchHarnessOptions["exclusionHook"]
  maxRunSequencePerCell: number
}): Promise<EvaluationRunResultV1[]> {
  const fixture = args.fixtureSet.fixtures.find((f) => f.fixtureId === args.fixtureId)
  if (!fixture) throw new Error(`unknown fixture ${args.fixtureId}`)

  const collected: EvaluationRunResultV1[] = []
  let runSequence = 0
  let included = 0

  while (included < EVAL_SAMPLE_SIZE) {
    runSequence += 1
    if (runSequence > args.maxRunSequencePerCell) {
      throw new SampleBudgetError(
        `exceeded maxRunSequencePerCell for ${cellKey(args.fixtureId, args.granularity)}`,
      )
    }

    const exclusion = args.exclusionHook?.({
      fixtureId: args.fixtureId,
      granularity: args.granularity,
      runSequence,
    })

    const common = {
      runId: newId("run"),
      fixtureId: args.fixtureId,
      granularity: args.granularity,
      runSequence,
      policy: policyV2FromGranularity(args.granularity),
      environment: args.environment,
      executionAttempt: 1 as const,
    }

    if (exclusion) {
      const ok = canExcludeAndReplenish({
        modelAttempt: 0,
        dispatchReservedCommitted: false,
        modelResponseReceived: false,
        phase: exclusion.phase,
        reason: exclusion.reason,
      })
      if (!ok) {
        throw new Error(`exclusion not allowed: ${exclusion.reason}`)
      }
      collected.push({
        ...common,
        disposition: "EXCLUDED",
        sampleIndex: null,
        exclusionPhase: exclusion.phase,
        exclusionReason: exclusion.reason,
        modelAttempt: 0,
        attempts: [],
        finalJobState: null,
        terminalReasonCode: null,
        committed: null,
      })
      continue
    }

    const db = restoreIsolatedEvalDb(fixture, args.granularity)
    try {
      db.assertMatchesBaseInput()
      const attempts = []
      let committed: EvaluationCommittedResultV1 | null = null
      let finalJobState: "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW" | "CANCELED" =
        "FAILED"
      let terminalReasonCode:
        | "APPLIED"
        | "QUALITY_ZERO_EXHAUSTED"
        | "DISPATCH_BUDGET_EXHAUSTED_WITH_TECHNICAL_FAILURE"
        | "EXECUTION_ATTEMPT_LIMIT_EXCEEDED"
        | "CANCELED_STALE"
        | "CANCELED_SETTINGS"
        | "CANCELED_USER" = "DISPATCH_BUDGET_EXHAUSTED_WITH_TECHNICAL_FAILURE"

      for (let ordinal = 1; ordinal <= 3; ordinal++) {
        const previousCodes = attempts.flatMap((a) => a.diagnosticReasonCodes)
        const retryCodes = [
          ...new Set(
            previousCodes.filter((c) =>
              [
                "RESPONSE_SCHEMA_INVALID",
                "CANDIDATE_SCHEMA_INVALID",
                "MODEL_TIMEOUT",
                "MODEL_RESPONSE_INTERRUPTED",
                "MODEL_RESPONSE_TRUNCATED",
                "MODEL_RESPONSE_SIZE_EXCEEDED",
                "MODEL_RESULT_LOST",
                "MODEL_NEEDS_REVIEW",
                "CATEGORY_INVALID",
                "NO_VALID_CANDIDATE",
                "REUSE_ID_INVALID",
                "REUSE_PARENT_MISMATCH",
                "EVIDENCE_INVALID",
                "IMPORTANCE_NOT_ALLOWED",
                "NAME_INVALID",
                "DUPLICATE",
              ].includes(c),
            ),
          ),
        ] as import("../types").ClassificationRetryReasonCode[]

        const input = buildPromptInput(
          fixture,
          args.granularity,
          ordinal === 1
            ? null
            : {
                previousModelAttempt: (ordinal - 1) as 1 | 2,
                reasonCodes: retryCodes,
              },
        )
        const script = args.provider.next(input)
        const { attempt, rolledBack } = materializeAttemptFromScript({
          attemptId: newId("attempt"),
          ordinal: ordinal as 1 | 2 | 3,
          script,
        })
        attempts.push(attempt)

        if (rolledBack) {
          // DB rollback: no COMMITTED, treat as technical failure and continue if budget left
          if (ordinal === 3) {
            finalJobState = "FAILED"
            terminalReasonCode = "DISPATCH_BUDGET_EXHAUSTED_WITH_TECHNICAL_FAILURE"
          }
          continue
        }

        if (attempt.outcome === "APPLIED") {
          committed = buildCommitted(
            fixture,
            attempt.attemptId,
            attempt.ordinal,
            attempt.applicableCategoryId!,
            attempt.applicableCandidates,
          )
          finalJobState = "SUCCEEDED"
          terminalReasonCode = "APPLIED"
          break
        }

        if (
          attempt.outcome === "CANCELED_STALE" ||
          attempt.outcome === "CANCELED_SETTINGS" ||
          attempt.outcome === "CANCELED_USER"
        ) {
          finalJobState = "CANCELED"
          terminalReasonCode = attempt.outcome
          break
        }

        if (ordinal === 3) {
          const allQZ = attempts.every(
            (a) => a.outcome === "GLOBAL_INVALID" || a.outcome === "ZERO_VALID",
          )
          const anyTech = attempts.some((a) => a.outcome === "TECHNICAL_FAILURE")
          if (allQZ) {
            finalJobState = "NEEDS_REVIEW"
            terminalReasonCode = "QUALITY_ZERO_EXHAUSTED"
          } else if (anyTech) {
            finalJobState = "FAILED"
            terminalReasonCode =
              "DISPATCH_BUDGET_EXHAUSTED_WITH_TECHNICAL_FAILURE"
          }
        }
      }

      collected.push({
        ...common,
        disposition: "INCLUDED",
        sampleIndex: 0, // assign later
        exclusionPhase: null,
        exclusionReason: null,
        modelAttempt: attempts.length as 1 | 2 | 3,
        attempts,
        finalJobState,
        terminalReasonCode,
        committed,
      })
      included += 1
    } finally {
      db.destroy()
    }
  }

  return assignSampleIndexes(collected)
}

export async function runFakeEvalBatch(
  options: BatchHarnessOptions,
): Promise<{
  fixtureSetSha256: string
  artifact: ClassificationEvaluationResultArtifactV1
}> {
  if (options.allowRealModel) {
    throw new Error(
      "Real Gemini Nano batch is blocked until BE-08 runtime (#16) and Prompt API environment (#13) are ready",
    )
  }
  if (options.environment.promptApiState !== "AVAILABLE") {
    // fake batch では AVAILABLE を記録してよい（fake は環境に依存しない）
  }

  const { set, fixtureSetSha256 } = await freezeFixtureSet(options.fixtureSet, {
    providerInputQuotaBytes: options.providerInputQuotaBytes,
  })

  const maxSeq = options.maxRunSequencePerCell ?? 30
  const runs: EvaluationRunResultV1[] = []

  for (const fixture of set.fixtures) {
    for (const g of [0, 1, 2, 3, 4] as Granularity[]) {
      const cellRuns = await runEvalCell({
        fixtureSet: set,
        fixtureId: fixture.fixtureId,
        granularity: g,
        provider: options.provider,
        environment: options.environment,
        exclusionHook: options.exclusionHook,
        maxRunSequencePerCell: maxSeq,
      })
      runs.push(...cellRuns)
    }
  }

  const artifact = await sealResultArtifact({
    resultSchemaVersion: RESULT_SCHEMA_VERSION,
    fixtureSchemaVersion: FIXTURE_SCHEMA_VERSION,
    fixtureVersion: set.fixtureVersion,
    fixtureSetSha256,
    scorerVersion: SCORER_VERSION,
    promptVersion: PROMPT_VERSION,
    responseSchemaVersion: RESPONSE_SCHEMA_VERSION,
    candidateQueryVersion: CANDIDATE_QUERY_VERSION,
    labelNormalizerVersion: 1,
    labelNormalizerDataSha256: labelNormalizerDataSha256(),
    runs,
  })

  void getVendoredAssetSha256
  return { fixtureSetSha256, artifact }
}
