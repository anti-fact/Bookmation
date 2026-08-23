/**
 * ClassificationPromptInput 構築（policy / retryContext 注入）
 */
import { policyV2FromGranularity } from "./policy-v2"
import type {
  ClassificationEvaluationFixtureV3,
  ClassificationPromptInputV2,
  ClassificationRetryReasonCode,
  Granularity,
} from "./types"
import {
  CANDIDATE_QUERY_VERSION,
  MAX_MODEL_RESPONSE_BYTES,
  MAX_PROMPT_INPUT_BYTES,
  PROMPT_VERSION,
  RESPONSE_SCHEMA_VERSION,
} from "./types"

export const ALL_RETRY_REASON_CODES: ClassificationRetryReasonCode[] = [
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
]

export function buildPromptInput(
  fixture: ClassificationEvaluationFixtureV3,
  granularity: Granularity,
  retryContext: ClassificationPromptInputV2["retryContext"],
): ClassificationPromptInputV2 {
  return {
    ...fixture.baseInput,
    policy: policyV2FromGranularity(granularity),
    retryContext,
  }
}

export function emptyPromptMeta(): Pick<
  ClassificationPromptInputV2,
  | "promptVersion"
  | "responseSchemaVersion"
  | "candidateQueryVersion"
  | "maxPromptInputBytes"
  | "maxModelResponseBytes"
> {
  return {
    promptVersion: PROMPT_VERSION,
    responseSchemaVersion: RESPONSE_SCHEMA_VERSION,
    candidateQueryVersion: CANDIDATE_QUERY_VERSION,
    maxPromptInputBytes: MAX_PROMPT_INPUT_BYTES,
    maxModelResponseBytes: MAX_MODEL_RESPONSE_BYTES,
  }
}
