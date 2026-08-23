/**
 * Domain 層の公開 API
 *
 * UI / Application / Adapter 層は本ファイルのエクスポートのみを通じて
 * Domain にアクセスする。src/domain 配下の個別ファイルを直接 import しない。
 */

// --- 共通型 ---
export type {
  Id,
  EpochMs,
  EntityOrigin,
  LabelKind,
  ArchiveState,
  ClassificationState,
  FrequentVisitWindow,
  JsonValue,
  JsonDocumentEnvelope,
  TagImportance,
  AiGranularity,
  ClassificationPolicySnapshot,
  ClassificationPolicySnapshotV1,
  ClassificationPolicySnapshotV2,
  UpdateTagCommand,
} from "./types"

// --- エラー ---
export {
  DomainError,
  DomainErrorCode,
  isDomainError,
  toSafeMessage,
  SAFE_MESSAGES,
} from "./errors"
export type {} from "./errors"

// --- 値オブジェクト ---
export {
  validateId,
  isValidId,
  validateAndNormalizeUrl,
  isAllowedUrl,
  validateEpochMs,
  isValidEpochMs,
  validateRevision,
  isValidRevision,
  nextRevision,
  validateJsonValue,
  isJsonValue,
  validateCursorValue,
  isValidCursorValue,
} from "./value-objects"
export type { NormalizedUrl, CursorValue, CursorScalar } from "./value-objects"

export {
  canonicalizeJsonValue,
  canonicalizeUnknown,
  utf8ByteLength,
  assertJsonValue,
} from "./canonical-json"

// --- LabelNormalizer ---
export {
  normalizeLabelName,
  getVendoredAssetSha256,
  assertAssetSha256,
} from "./normalizer"
export type { NormalizedLabelName } from "./normalizer"

// --- Label ---
export type { LabelRecord } from "./label"
export {
  assertLabelInvariants,
  assertTagParentChangeIsUserCommand,
  assertNoCategoryNameConflict,
  assertNoTagNameConflict,
  assertCategoryGcAllowed,
} from "./label"

// --- Bookmark ---
export type { BookmarkRecord, ActiveBookmarkRecord, ArchivedBookmarkRecord, BookmarkSource, BookmarkClassificationState } from "./bookmark"
export {
  assertActiveBookmarkInvariants,
  assertNoCategoryDirectUpdate,
  assertArchivedPayloadIsMinimal,
  isActiveBookmark,
  isArchivedBookmark,
} from "./bookmark"

// --- BookmarkLabel ---
export type { BookmarkLabelRecord } from "./bookmark-label"
export {
  assertBookmarkLabelInvariants,
  assertNoCategoryEdgeDirectMutation,
  assertNoBookmarkLabelDuplicate,
} from "./bookmark-label"

// --- ClassificationJob ---
export type { ClassificationJobRecord } from "./classification-job"
export {
  assertClassificationJobInvariants,
  assertValidStateTransition,
  assertClassificationPolicyValid,
  policyFromGranularity,
  policyV1FromGranularity,
  isPolicyV2,
  isCreateImportanceAllowed,
} from "./classification-job"
export {
  CLASSIFICATION_JOB_LEASE_MS,
  CLASSIFICATION_JOB_MAX_ATTEMPTS,
  proposalCreationRequestId,
  type ClassificationApplyOutcome,
} from "./classification-job-contract"

// --- Classification prompt / result (policy v2) ---
export {
  PROMPT_VERSION,
  RESPONSE_SCHEMA_VERSION,
  CANDIDATE_QUERY_VERSION,
  MAX_PROMPT_INPUT_BYTES,
  MAX_MODEL_RESPONSE_BYTES,
} from "./classification-constants"
export {
  GEMINI_NANO_TAG_CLASSIFIER_V2_SYSTEM_PROMPT,
  buildClassificationPromptInput,
  orderAllActiveLabelsV1,
} from "./classification-prompt"
export type {
  ClassificationPromptInput,
  ClassificationPromptCategory,
  ClassificationPromptTag,
  ClassificationRetryReasonCode,
} from "./classification-prompt"
export {
  validateClassificationModelResult,
  isQualityZeroOutcome,
  resolveDispatchBudgetTerminal,
} from "./classification-result"
export type {
  TagDecision,
  ModelDecisionCandidate,
  ApplicableCandidate,
  AttemptOutcome,
  ResponseDisposition,
  SnapshotTag,
  ValidateClassificationResultInput,
  ValidateClassificationResultOutput,
} from "./classification-result"

// --- LocalSettings ---
export type { LocalSettings } from "./local-settings"
export {
  DEFAULT_LOCAL_SETTINGS,
  assertLocalSettingsValid,
  migrateLocalSettings,
} from "./local-settings"

// --- SchemaMeta ---
export type { SchemaMetaRecord } from "./schema-meta"
export { assertSchemaMetaValid, assertSchemaMetaAssetHashValid } from "./schema-meta"

// --- Security ---
export {
  ALLOWED_IMAGE_MIME_TYPES,
  BUNDLED_FALLBACK_LOGO_PATH,
  MAX_BOOKMARK_TITLE_LENGTH,
  MAX_FAVICON_BYTES,
  MAX_HTML_FETCH_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  MAX_MESSAGE_JSON_DEPTH,
  MAX_THUMBNAIL_BYTES,
  isAllowedImageMimeType,
  jsonValueWithinBounds,
  resolveBookmarkTitle,
  validateBookmarkTitle,
} from "./security"
export type { AllowedImageMimeType } from "./security"

// --- AI 境界 ---
export type { AiTagSuggestion, AiClassificationResult } from "./ai-boundary"
export {
  parseAiClassificationResult,
  assertAiDoesNotCreateCategory,
  assertAiLabelIdsInCandidates,
} from "./ai-boundary"
