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
  ClassificationPolicySnapshot,
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
  assertClassificationPolicyValid,
  assertClassificationJobInvariants,
  assertValidStateTransition,
  policyFromGranularity,
} from "./classification-job"
export {
  CLASSIFICATION_JOB_LEASE_MS,
  CLASSIFICATION_JOB_MAX_ATTEMPTS,
  proposalCreationRequestId,
  type ClassificationApplyOutcome,
} from "./classification-job-contract"

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

// --- AI 境界 ---
export type { AiTagSuggestion, AiClassificationResult } from "./ai-boundary"
export {
  parseAiClassificationResult,
  assertAiDoesNotCreateCategory,
  assertAiLabelIdsInCandidates,
} from "./ai-boundary"
