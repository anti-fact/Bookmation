/**
 * Domain エラーコードと安全メッセージ変換
 *
 * - エラーコードは全て文字列定数として定義する。
 * - UIへ見せるメッセージは SAFE_MESSAGES で変換し、内部技術詳細を漏らさない。
 * - AI 出力・外部入力を受け取る層はこのモジュールのコードだけを使い、
 *   実装詳細を含むエラー文字列を直接 UI へ渡さない。
 */

// ---------------------------------------------------------------------------
// エラーコード一覧
// ---------------------------------------------------------------------------

export const DomainErrorCode = {
  // URL 検証
  INVALID_URL: "INVALID_URL",
  UNSAFE_URL_SCHEME: "UNSAFE_URL_SCHEME",
  URL_TOO_LONG: "URL_TOO_LONG",

  // Label 名前正規化
  LABEL_NAME_EMPTY: "LABEL_NAME_EMPTY",
  LABEL_NAME_TOO_LONG: "LABEL_NAME_TOO_LONG",
  LABEL_NAME_REJECTED_CHARACTER: "LABEL_NAME_REJECTED_CHARACTER",
  LABEL_NORMALIZER_ASSET_HASH_MISMATCH: "LABEL_NORMALIZER_ASSET_HASH_MISMATCH",

  // Label 不変条件
  CATEGORY_ORIGIN_MUST_BE_USER: "CATEGORY_ORIGIN_MUST_BE_USER",
  CATEGORY_PARENT_MUST_BE_NULL: "CATEGORY_PARENT_MUST_BE_NULL",
  TAG_REQUIRES_ACTIVE_CATEGORY_PARENT: "TAG_REQUIRES_ACTIVE_CATEGORY_PARENT",
  TAG_PARENT_CATEGORY_RECORD_MISSING: "TAG_PARENT_CATEGORY_RECORD_MISSING",
  TAG_TOMBSTONE_DELETED_PARENT_ALLOWED: "TAG_TOMBSTONE_DELETED_PARENT_ALLOWED",
  DUPLICATE_NORMALIZED_NAME: "DUPLICATE_NORMALIZED_NAME",
  LABEL_KIND_IMMUTABLE: "LABEL_KIND_IMMUTABLE",

  // Tag 親変更制約
  TAG_PARENT_CHANGE_FORBIDDEN_FOR_NON_USER: "TAG_PARENT_CHANGE_FORBIDDEN_FOR_NON_USER",
  TAG_PARENT_CHANGE_REQUIRES_UPDATE_TAG_COMMAND: "TAG_PARENT_CHANGE_REQUIRES_UPDATE_TAG_COMMAND",

  // Bookmark 不変条件
  BOOKMARK_CATEGORY_DIRECT_UPDATE_REJECTED: "BOOKMARK_CATEGORY_DIRECT_UPDATE_REJECTED",
  BOOKMARK_CLASSIFICATION_STATE_INVALID_TRANSITION: "BOOKMARK_CLASSIFICATION_STATE_INVALID_TRANSITION",
  BOOKMARK_TITLE_EMPTY: "BOOKMARK_TITLE_EMPTY",
  BOOKMARK_TITLE_TOO_LONG: "BOOKMARK_TITLE_TOO_LONG",
  BOOKMARK_TITLE_REJECTED_CHARACTER: "BOOKMARK_TITLE_REJECTED_CHARACTER",

  // Classification Job
  CLASSIFICATION_POLICY_INVALID: "CLASSIFICATION_POLICY_INVALID",
  CLASSIFICATION_POLICY_MAX_TAGS_EXCEEDED: "CLASSIFICATION_POLICY_MAX_TAGS_EXCEEDED",
  CLASSIFICATION_JOB_NOT_FOUND: "CLASSIFICATION_JOB_NOT_FOUND",
  CLASSIFICATION_JOB_CLAIM_CONFLICT: "CLASSIFICATION_JOB_CLAIM_CONFLICT",
  CLASSIFICATION_JOB_LEASE_INVALID: "CLASSIFICATION_JOB_LEASE_INVALID",
  CLASSIFICATION_JOB_APPLY_REJECTED: "CLASSIFICATION_JOB_APPLY_REJECTED",

  // LocalSettings
  SETTINGS_AI_GRANULARITY_OUT_OF_RANGE: "SETTINGS_AI_GRANULARITY_OUT_OF_RANGE",
  SETTINGS_ARCHIVE_AFTER_DAYS_INVALID: "SETTINGS_ARCHIVE_AFTER_DAYS_INVALID",
  SETTINGS_FREQUENT_VISIT_DAY_THRESHOLD_INVALID: "SETTINGS_FREQUENT_VISIT_DAY_THRESHOLD_INVALID",
  SETTINGS_FREQUENT_VISIT_WINDOW_INVALID: "SETTINGS_FREQUENT_VISIT_WINDOW_INVALID",

  // 冪等性
  REQUEST_ID_REUSED: "REQUEST_ID_REUSED",
  REQUEST_ID_NAMESPACE_INVALID: "REQUEST_ID_NAMESPACE_INVALID",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  TAG_UPDATE_CONFLICT: "TAG_UPDATE_CONFLICT",
  CATEGORY_DELETE_PREVIEW_STALE: "CATEGORY_DELETE_PREVIEW_STALE",

  // AI 入力境界
  AI_OUTPUT_DIRECT_CAST_FORBIDDEN: "AI_OUTPUT_DIRECT_CAST_FORBIDDEN",
  AI_CATEGORY_CREATION_FORBIDDEN: "AI_CATEGORY_CREATION_FORBIDDEN",
  AI_LABEL_ID_NOT_IN_CANDIDATES: "AI_LABEL_ID_NOT_IN_CANDIDATES",

  // 値オブジェクト
  INVALID_ID: "INVALID_ID",
  INVALID_EPOCH_MS: "INVALID_EPOCH_MS",
  INVALID_REVISION: "INVALID_REVISION",
  INVALID_JSON_VALUE: "INVALID_JSON_VALUE",
  INVALID_CURSOR: "INVALID_CURSOR",
} as const

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode]

// ---------------------------------------------------------------------------
// Domain エラークラス
// ---------------------------------------------------------------------------

export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message?: string) {
    super(message ? `${code}: ${message}` : code)
    this.name = "DomainError"
    this.code = code
  }
}

export function isDomainError(error: unknown): error is DomainError {
  if (error instanceof DomainError) {
    return true
  }
  if (typeof error !== "object" || error === null) {
    return false
  }
  const candidate = error as { name?: unknown; code?: unknown }
  return candidate.name === "DomainError" && typeof candidate.code === "string"
}

// ---------------------------------------------------------------------------
// UI 向け安全メッセージ変換
// ---------------------------------------------------------------------------

/**
 * DomainErrorCode を UI に表示しても安全な日本語メッセージへ変換する。
 * 内部実装詳細・ファイルパス・スタックトレースを含まない。
 */
export const SAFE_MESSAGES: Readonly<Record<DomainErrorCode, string>> = {
  INVALID_URL: "URLの形式が正しくありません",
  UNSAFE_URL_SCHEME: "保存できるURLはhttpまたはhttpsのみです",
  URL_TOO_LONG: "URLが長すぎます",

  LABEL_NAME_EMPTY: "名前を入力してください",
  LABEL_NAME_TOO_LONG: "名前が長すぎます（上限を超えています）",
  LABEL_NAME_REJECTED_CHARACTER: "名前に使用できない文字が含まれています",
  LABEL_NORMALIZER_ASSET_HASH_MISMATCH:
    "正規化データの整合性確認に失敗しました。サポートにお問い合わせください",

  CATEGORY_ORIGIN_MUST_BE_USER: "カテゴリはユーザーだけが作成できます",
  CATEGORY_PARENT_MUST_BE_NULL: "カテゴリに親カテゴリは設定できません",
  TAG_REQUIRES_ACTIVE_CATEGORY_PARENT: "タグには有効なカテゴリを選択してください",
  TAG_PARENT_CATEGORY_RECORD_MISSING: "指定された親カテゴリが見つかりません",
  TAG_TOMBSTONE_DELETED_PARENT_ALLOWED: "",
  DUPLICATE_NORMALIZED_NAME:
    "同じ名前がすでに存在します。別の名前を入力するか、既存の項目を選んでください",
  LABEL_KIND_IMMUTABLE: "カテゴリとタグの種別は変更できません",

  TAG_PARENT_CHANGE_FORBIDDEN_FOR_NON_USER:
    "タグの親カテゴリはユーザー操作からのみ変更できます",
  TAG_PARENT_CHANGE_REQUIRES_UPDATE_TAG_COMMAND:
    "タグの親カテゴリ変更には専用の更新操作が必要です",

  BOOKMARK_CATEGORY_DIRECT_UPDATE_REJECTED:
    "カテゴリはタグの親から自動で決まるため、直接変更はできません",
  BOOKMARK_CLASSIFICATION_STATE_INVALID_TRANSITION: "分類状態の遷移が正しくありません",
  BOOKMARK_TITLE_EMPTY: "タイトルを入力してください",
  BOOKMARK_TITLE_TOO_LONG: "タイトルが長すぎます",
  BOOKMARK_TITLE_REJECTED_CHARACTER: "タイトルに使用できない文字が含まれています",

  CLASSIFICATION_POLICY_INVALID:
    "AI分類ポリシーの設定が正しくありません",
  CLASSIFICATION_POLICY_MAX_TAGS_EXCEEDED:
    "新規タグの上限を超えています",
  CLASSIFICATION_JOB_NOT_FOUND: "分類ジョブが見つかりません",
  CLASSIFICATION_JOB_CLAIM_CONFLICT: "分類ジョブを取得できません",
  CLASSIFICATION_JOB_LEASE_INVALID: "分類ジョブの実行期限が切れています",
  CLASSIFICATION_JOB_APPLY_REJECTED: "分類結果を適用できません",

  SETTINGS_AI_GRANULARITY_OUT_OF_RANGE: "AI細分化度は0〜4の整数で設定してください",
  SETTINGS_ARCHIVE_AFTER_DAYS_INVALID:
    "アーカイブ日数は1以上の整数で入力してください",
  SETTINGS_FREQUENT_VISIT_DAY_THRESHOLD_INVALID:
    "訪問日数は選択した期間の範囲内で入力してください",
  SETTINGS_FREQUENT_VISIT_WINDOW_INVALID: "訪問集計期間の値が正しくありません",

  REQUEST_ID_REUSED: "操作IDが別の操作に使用されています",
  REQUEST_ID_NAMESPACE_INVALID: "操作IDの形式が正しくありません",
  REVISION_CONFLICT: "データが更新されています。画面を更新してください",
  TAG_UPDATE_CONFLICT: "タグの更新中に競合が発生しました。画面を更新してください",
  CATEGORY_DELETE_PREVIEW_STALE: "削除対象が変更されました。警告画面を開き直してください",

  AI_OUTPUT_DIRECT_CAST_FORBIDDEN: "AI出力の処理中にエラーが発生しました",
  AI_CATEGORY_CREATION_FORBIDDEN: "AIはカテゴリを作成できません",
  AI_LABEL_ID_NOT_IN_CANDIDATES: "AIが返したラベルIDが候補に含まれていません",

  INVALID_ID: "IDの形式が正しくありません",
  INVALID_EPOCH_MS: "日時の値が正しくありません",
  INVALID_REVISION: "リビジョン番号が正しくありません",
  INVALID_JSON_VALUE: "保存できない値が含まれています",
  INVALID_CURSOR: "カーソルの値が正しくありません",
} as const

/**
 * エラーコードから UI 向けメッセージを返す。
 * 未知のコードは汎用メッセージを返す。
 */
export function toSafeMessage(code: DomainErrorCode): string {
  return SAFE_MESSAGES[code] ?? "エラーが発生しました"
}
