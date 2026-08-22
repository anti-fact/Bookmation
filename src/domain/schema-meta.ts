/**
 * SchemaMeta Domain エンティティ
 *
 * DB-SCHEMA.md §schema_meta の型定義と asset hash 照合関数。
 * IndexedDB の DB バージョン管理と Unicode asset の整合性検証に使う。
 */
import type { Id, EpochMs } from "./types"
import { assertAssetSha256 } from "./normalizer"

// ---------------------------------------------------------------------------
// SchemaMetaRecord 型定義
// ---------------------------------------------------------------------------

export interface SchemaMetaRecord {
  readonly schemaVersion: number
  readonly id: "singleton"
  readonly dbVersion: number
  readonly createdAt: EpochMs
  readonly updatedAt: EpochMs
  /**
   * LabelNormalizer v1 vendored asset の SHA-256 ハッシュ。
   * `scripts/generate-unicode-data.mjs` が生成した asset-sha256.ts の値。
   * DB 作成時に記録し、以降の open で検証する。
   */
  readonly unicodeDataAssetSha256: string
  /**
   * Label 名正規化バージョン。
   * v1 = 1 固定。バージョンアップ時は DB migration が必要。
   */
  readonly labelNormalizationVersion: 1
}

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

/**
 * SchemaMeta の unicodeDataAssetSha256 が現在の vendored asset と一致するかを確認する。
 * 不一致の場合 LABEL_NORMALIZER_ASSET_HASH_MISMATCH をスローする。
 */
export function assertSchemaMetaAssetHashValid(meta: SchemaMetaRecord): void {
  assertAssetSha256(meta.unicodeDataAssetSha256)
}

/**
 * DB から読み込んだ SchemaMeta が有効かを確認する。
 */
export function assertSchemaMetaValid(meta: SchemaMetaRecord): void {
  if (meta.id !== "singleton") {
    throw new Error(`SchemaMeta id must be 'singleton', got: ${meta.id}`)
  }
  if (meta.labelNormalizationVersion !== 1) {
    throw new Error(
      `labelNormalizationVersion must be 1, got: ${meta.labelNormalizationVersion}. DB migration required.`,
    )
  }
  assertSchemaMetaAssetHashValid(meta)
}
