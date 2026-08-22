/**
 * Label Domain エンティティ
 *
 * DB-SCHEMA.md §labels の型定義と不変条件バリデーター。
 * カテゴリ (CATEGORY) とタグ (TAG) を統合した Label モデルを表す。
 *
 * 不変条件一覧 (DB-SCHEMA.md §不変条件):
 * - CATEGORY: parentCategoryId=null かつ origin='USER'
 * - TAG: parentCategoryId は物理的に存在する CATEGORY ID (非 null)
 * - active TAG は active CATEGORY 親のみ参照可
 * - tombstone TAG は deleted CATEGORY 参照を許すが、親 record 欠損は禁止
 * - categoryUniqueName = normalizedName (CATEGORY 全体で unique)
 * - tagUniqueName = normalizedName (TAG 全体で unique、親をまたいで)
 * - kind は変更不可
 * - TAG の parentCategoryId 変更は UpdateTagCommand 経路のみ
 */
import type { Id, EpochMs, EntityOrigin, LabelKind, JsonDocumentEnvelope } from "./types"
import { DomainError, DomainErrorCode } from "./errors"

// ---------------------------------------------------------------------------
// LabelRecord 型定義 (DB-SCHEMA.md §labels)
// ---------------------------------------------------------------------------

export interface LabelRecord extends JsonDocumentEnvelope {
  readonly schemaVersion: number
  readonly id: Id
  readonly name: string
  readonly normalizedName: string
  readonly nameNormalizationVersion: 1
  /** CATEGORY なら tombstone 後も保持。TAG では省略 */
  readonly categoryUniqueName?: string
  /** TAG なら tombstone 後も保持。CATEGORY では省略 */
  readonly tagUniqueName?: string
  readonly kind: LabelKind
  /**
   * CATEGORY は null。
   * TAG は物理的に存在する CATEGORY の ID (必須)。
   */
  readonly parentCategoryId: Id | null
  readonly origin: EntityOrigin
  /** 作成操作の冪等キー。一意 */
  readonly creationRequestId: string
  readonly sortOrder: number
  readonly createdAt: EpochMs
  readonly updatedAt: EpochMs
  readonly revision: number
  readonly deletedAt: EpochMs | null
  /**
   * Category 連鎖削除でのみ設定。
   * 通常作成・編集・単独 Tag 削除では null。
   */
  readonly cascadeDeleteRequestId: Id | null
}

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

/**
 * LabelRecord の不変条件を検証する。
 * 種別ごとのルールを全て確認し、違反があれば DomainError をスローする。
 *
 * @param record 検証対象レコード
 * @param parentCategory CATEGORY の場合は null。TAG の場合は親 LabelRecord (存在確認済み)
 */
export function assertLabelInvariants(
  record: LabelRecord,
  parentCategory: LabelRecord | null,
): void {
  if (record.kind === "CATEGORY") {
    assertCategoryInvariants(record)
  } else {
    assertTagInvariants(record, parentCategory)
  }
}

function assertCategoryInvariants(record: LabelRecord): void {
  // CATEGORY は parentCategoryId=null
  if (record.parentCategoryId !== null) {
    throw new DomainError(
      DomainErrorCode.CATEGORY_PARENT_MUST_BE_NULL,
      `CATEGORY must have parentCategoryId=null, got: ${record.parentCategoryId}`,
    )
  }

  // CATEGORY の origin は USER のみ
  if (record.origin !== "USER") {
    throw new DomainError(
      DomainErrorCode.CATEGORY_ORIGIN_MUST_BE_USER,
      `CATEGORY origin must be 'USER', got: ${record.origin}`,
    )
  }

  // categoryUniqueName = normalizedName を保持
  if (record.categoryUniqueName !== record.normalizedName) {
    throw new DomainError(
      DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
      `CATEGORY categoryUniqueName must equal normalizedName`,
    )
  }

  // TAG 専用フィールドは持たない
  if (record.tagUniqueName !== undefined) {
    throw new DomainError(
      DomainErrorCode.LABEL_KIND_IMMUTABLE,
      `CATEGORY must not have tagUniqueName`,
    )
  }
}

function assertTagInvariants(record: LabelRecord, parentCategory: LabelRecord | null): void {
  // TAG は parentCategoryId が必須
  if (record.parentCategoryId === null) {
    throw new DomainError(
      DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT,
      `TAG must have non-null parentCategoryId`,
    )
  }

  // 親 CATEGORY record が存在しなければならない
  if (parentCategory === null) {
    throw new DomainError(
      DomainErrorCode.TAG_PARENT_CATEGORY_RECORD_MISSING,
      `TAG's parent CATEGORY record does not exist: ${record.parentCategoryId}`,
    )
  }

  // 親が CATEGORY であることを確認
  if (parentCategory.kind !== "CATEGORY") {
    throw new DomainError(
      DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT,
      `TAG's parent must be kind=CATEGORY, got: ${parentCategory.kind}`,
    )
  }

  // active TAG は active CATEGORY 親のみ参照可
  if (record.deletedAt === null) {
    // active TAG
    if (parentCategory.deletedAt !== null) {
      throw new DomainError(
        DomainErrorCode.TAG_REQUIRES_ACTIVE_CATEGORY_PARENT,
        `Active TAG must reference an active CATEGORY, but parent is deleted`,
      )
    }
  }
  // tombstone TAG は deleted CATEGORY を参照できるが、record 欠損は禁止 (上で確認済み)

  // tagUniqueName = normalizedName を保持
  if (record.tagUniqueName !== record.normalizedName) {
    throw new DomainError(
      DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
      `TAG tagUniqueName must equal normalizedName`,
    )
  }

  // CATEGORY 専用フィールドは持たない
  if (record.categoryUniqueName !== undefined) {
    throw new DomainError(
      DomainErrorCode.LABEL_KIND_IMMUTABLE,
      `TAG must not have categoryUniqueName`,
    )
  }
}

// ---------------------------------------------------------------------------
// UpdateTag コマンドの検証
// ---------------------------------------------------------------------------

/**
 * TAG の parentCategoryId 変更が許可された経路から来ているかを確認する。
 * AI / Import / 同期競合の暗黙処理から呼ばれた場合はエラーをスローする。
 *
 * 具体的には:
 * - requestId が `tag-update:` prefix を持つことを確認する (UpdateTagCommand 経路)
 */
export function assertTagParentChangeIsUserCommand(requestId: string): void {
  if (!requestId.startsWith("tag-update:")) {
    throw new DomainError(
      DomainErrorCode.TAG_PARENT_CHANGE_REQUIRES_UPDATE_TAG_COMMAND,
      `TAG parent change must use UpdateTagCommand (requestId must start with 'tag-update:'): ${requestId}`,
    )
  }
}

// ---------------------------------------------------------------------------
// ユニーク名競合チェック
// ---------------------------------------------------------------------------

/**
 * 新規 CATEGORY 名が既存 CATEGORY (tombstone 含む) と競合しないかを確認する。
 * 競合があれば DUPLICATE_NORMALIZED_NAME をスローする。
 */
export function assertNoCategoryNameConflict(
  normalizedName: string,
  existingRecords: readonly Pick<LabelRecord, "normalizedName" | "deletedAt" | "id">[],
  excludeId?: Id,
): void {
  for (const existing of existingRecords) {
    if (excludeId && existing.id === excludeId) continue
    if (existing.normalizedName === normalizedName) {
      throw new DomainError(
        DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
        `CATEGORY with normalizedName "${normalizedName}" already exists (tombstone reserved until GC)`,
      )
    }
  }
}

/**
 * 新規 TAG 名が既存 TAG (tombstone 含む) と競合しないかを確認する。
 * 親カテゴリをまたいでグローバルに一意。
 */
export function assertNoTagNameConflict(
  normalizedName: string,
  existingRecords: readonly Pick<LabelRecord, "normalizedName" | "deletedAt" | "id">[],
  excludeId?: Id,
): void {
  for (const existing of existingRecords) {
    if (excludeId && existing.id === excludeId) continue
    if (existing.normalizedName === normalizedName) {
      throw new DomainError(
        DomainErrorCode.DUPLICATE_NORMALIZED_NAME,
        `TAG with normalizedName "${normalizedName}" already exists (tombstone reserved until GC)`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Category 物理 GC ブロック確認
// ---------------------------------------------------------------------------

/**
 * CATEGORY の物理 GC が安全かを確認する。
 * `parentCategoryId` がこの ID を参照する TAG が1件でも残っていれば GC を拒否する。
 */
export function assertCategoryGcAllowed(
  categoryId: Id,
  childTagRecords: readonly Pick<LabelRecord, "parentCategoryId" | "id">[],
): void {
  const hasChild = childTagRecords.some((t) => t.parentCategoryId === categoryId)
  if (hasChild) {
    throw new DomainError(
      DomainErrorCode.TAG_PARENT_CATEGORY_RECORD_MISSING,
      `CATEGORY ${categoryId} cannot be GC'd: child TAG records still reference it`,
    )
  }
}
