# DBスキーマ

## 文書の位置づけ

- 状態: **提案・未実装・マイグレーション未検証**
- 保存先: ドメインデータはIndexedDB、設定はchrome.storage.local、同一ユーザー同期は明示接続したGoogle Drive appDataFolder
- 関連: [全体設計](./DESIGN.md) / [バックエンド](./BACKEND.md) / [セキュリティ](./SECURITY.md) / [技術的負債](./TECH-DEBT-TRACKER.md)

本書は関係を表形式で説明するが、RDB／SQLではない。IndexedDBを保存エンジンにし、Blob以外を版付きJSON互換ドキュメントとして保存する。TypeScript interfaceはJSON Schemaから生成または同時検証し、型注釈だけで永続データを信用しない。

## モデル上の判断

- 確定要件: Chrome既存ブックマークとは別のBookmation専用レコードを使う。
- 確定要件: 親子階層は持たず、分類ラベルはカテゴリ（`CATEGORY`）とタグ（`TAG`）の2種類だけにする。
- 確定要件: カテゴリを新規作成できるのはユーザーだけである。AIは既存カテゴリを選択できるが、作成・改名・削除はできない。
- 確定要件: タグはユーザー定義を優先して再利用し、適切な候補がない場合だけAIが細分化設定の範囲内で作成できる。
- 確定要件: カテゴリ名は正規化後に一意、タグ名は重複を許す。分類ラベルの同一性は名称ではなく `id` で判断する。
- 確定要件: 1件のBookmarkへカテゴリとタグをそれぞれ複数割り当てられ、同じ分類ラベルを複数のBookmarkで再利用できる。
- 設計判断: カテゴリとタグの間に親子関係を設けない。表示上の区分とAI作成権限だけを `Label.kind` で表す。
- P1確定要件: 訪問回数・最終訪問日時、文字列のアーカイブ状態、リマインダー、インポート、QR共有、Drive同期を本スキーマで扱う。

## 関係

| エンティティA | エンティティB | 多重度 | 規則 |
| --- | --- | --- | --- |
| Bookmark | Label | 多対多 | BookmarkLabelで関連付ける。同じ組は1件だけ |
| Bookmark | ClassificationJob | 1対多 | 再分類履歴をジョブ単位で残す |
| Bookmark | BookmarkRevision | 1対多 | AI・ユーザー変更の監査とUndo候補 |
| Bookmark / Label | SearchDocument | 1対0または1 | 再生成可能な検索用派生データ |

カテゴリとタグはどちらも0件以上である。件数上限はAI出力と一括操作の安全上限として別に検証し、ドメインを単一カテゴリに制限しない。

## 共通型

~~~ts
type Id = string
type EpochMs = number
type EntityOrigin = "USER" | "AI" | "IMPORT" | "SHARE"
type LabelKind = "CATEGORY" | "TAG"
type ArchiveState = "ACTIVE" | "ARCHIVED"
type ClassificationState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "NEEDS_REVIEW"
  | "CANCELED"
~~~

IDで保存するドメインJSONドキュメントは次の共通Envelopeを満たす。`schemaMeta` と設定等のkey-addressed documentは、固有keyと対応するschema versionを必須にする。

~~~ts
interface JsonDocumentEnvelope {
  schemaVersion: number
  id: Id
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

- IDはUUID等の衝突しにくい文字列とする。生成方式は実装時に決定する。
- 時刻はUTCのEpoch millisecondsで保存し、表示時にローカル時刻へ変換する。
- 表示名とは別にnormalizedNameを持つ。Unicode正規化、前後空白除去、大小文字処理の規則をバージョン管理する。
- 同期対象になり得るレコードにはupdatedAt、revision、deviceId、deletedAtを追加できる共通Envelopeを用意する。
- JSONに表現できない `undefined`、関数、循環参照、非有限数、BigIntを拒否する。日時は文字列化せずEpoch millisecondsへ統一する。
- `BlobRecord.data` だけはJSON外のstructured clone値であり、JSON側からID参照する。QR、Drive、exportへBlob本体を暗黙に含めない。

## Object Store一覧

| Store | Key path | MVP | 用途 |
| --- | --- | --- | --- |
| bookmarks | id | 必須 | 拡張機能専用ブックマーク |
| labels | id | P0必須 | 平坦なカテゴリ／タグ |
| bookmarkLabels | id | P0必須 | BookmarkとLabelの関連 |
| classificationJobs | id | 必須 | 中断・再試行可能なAIジョブ |
| bookmarkRevisions | id | 推奨 | 直前分類のUndoと監査 |
| searchDocuments | id | 必須 | BookmarkとTagの再生成可能な検索用データ |
| blobs | id | 条件付き | サムネイル等のBlobとメタ情報 |
| schemaMeta | key | 必須 | DBバージョン、移行状態 |
| visitReminders | id | P1必須 | 訪問閾値到達後の通知と再通知抑止 |
| importJobs | id | P1必須 | Chrome標準Bookmark取込の進捗と結果 |
| syncOutbox | id | P1必須 | Google Driveへの未同期操作 |
| syncConflicts | id | P1必須 | 自動解決できない競合 |
| syncState | key | P1必須 | deviceId、接続状態、最終同期状態 |

## bookmarks

~~~ts
interface BookmarkRecord {
  schemaVersion: number
  id: Id
  rawUrl: string
  normalizedUrl: string
  urlHash: string
  urlNormalizationVersion: number
  title: string
  siteName: string | null
  faviconUrl: string | null
  faviconBlobId: Id | null
  thumbnailBlobId: Id | null
  archiveState: "ACTIVE" | "ARCHIVED"
  classificationState:
    | "UNCLASSIFIED"
    | "PENDING"
    | "CLASSIFIED"
    | "NEEDS_REVIEW"
    | "FAILED"
  source:
    | "CURRENT_TAB"
    | "MANUAL_URL"
    | "VISIT_REMINDER"
    | "CONTEXT_PAGE"
    | "CONTEXT_LINK"
    | "CHROME_IMPORT"
    | "QR_IMPORT"
  savedAt: EpochMs
  updatedAt: EpochMs
  archivedAt: EpochMs | null
  archiveReason: "USER" | "INACTIVE" | null
  lastVisitedAt: EpochMs | null
  visitCount: number | null
  revision: number
  deletedAt: EpochMs | null
}
~~~

### 索引

| 索引 | keyPath | unique | 用途 |
| --- | --- | --- | --- |
| byUrlHash | urlHash | false | 重複候補の高速検索。取得後にnormalizedUrlを比較 |
| byArchiveStateSavedAt | archiveState, savedAt | false | 一覧とアーカイブ |
| byClassificationState | classificationState | false | 未分類・要確認キュー |
| bySavedAt | savedAt | false | 追加読み込みカーソル |
| byUpdatedAt | updatedAt | false | 差分・同期候補 |

URL hashだけをuniqueにしない。hash衝突と、正規化規則の更新を考慮する。重複ポリシーはRepositoryでnormalizedUrlを比較して決める。

faviconUrlは取得元の記録または未キャッシュ時の候補であり、一覧表示のたびに外部URLへアクセスするための値ではない。取得・検証できた画像はfaviconBlobIdでローカルBlobを参照し、取得できなければ文字ベースの代替表示を使う。

`lastVisitedAt` と `visitCount` は、利用者が訪問機能を有効化して `history` 権限を許可した場合だけChrome履歴から更新する。権限がない場合や履歴に該当URLがない場合は `null` とし、`savedAt` から推測しない。自動アーカイブは `lastVisitedAt=null` のBookmarkを変更しない。`MANUAL_URL` でも入力値をそのまま信用せず、許可スキーム、長さ、正規化結果を検証する。

## labels

~~~ts
interface LabelRecord {
  schemaVersion: number
  id: Id
  name: string
  normalizedName: string
  categoryUniqueName?: string // 有効カテゴリだけに存在。タグ・論理削除カテゴリでは省略
  kind: "CATEGORY" | "TAG"
  origin: "USER" | "AI" | "IMPORT" | "SHARE"
  creationRequestId: string
  sortOrder: number
  createdAt: EpochMs
  updatedAt: EpochMs
  revision: number
  deletedAt: EpochMs | null
}
~~~

### 不変条件

- `kind` がカテゴリを表す `CATEGORY` なら `origin` は必ず `USER` とする。インポート等でカテゴリを作る場合も、ユーザーの明示確認後にユーザー作成操作として扱う。
- `kind` がタグを表す `TAG` なら `origin` は `USER`、`AI`、P1の `IMPORT` / `SHARE` を許す。P0で自動作成できる経路はAIだけであり、インポート・共有はユーザー確認を伴う別境界とする。
- 有効カテゴリは `categoryUniqueName = normalizedName` を必ず持ち、同じ正規化名の有効レコードを複数作らない。論理削除時は同じtransactionでこのプロパティを除去する。作成競合時は既存カテゴリを提示する。
- タグは `categoryUniqueName` プロパティ自体を持たない。IndexedDBの索引対象外となるため、同じ `normalizedName` の別IDを複数許可する。
- AIは既存のユーザー作成タグを優先して候補にし、適切な候補がない場合だけ `TAG` を作成する。タグの名称一致だけを理由に新規作成を禁止したり、自動統合したりしない。
- AIはorigin USERのレコードを上書きしない。
- `creationRequestId` は作成操作の冪等キーであり一意とする。意図した同名タグの追加は新しいrequestId、同じ操作の再送は同じrequestIdを使う。AIは `jobId:proposalKey` から安定して生成する。
- 削除は初期段階でdeletedAtによる論理削除とし、参照中の即時物理削除を避ける。

### 索引

| 索引 | keyPath | unique |
| --- | --- | --- |
| byNormalizedName | normalizedName | false |
| byKindAndName | kind, normalizedName | false |
| byCategoryUniqueName | categoryUniqueName | true |
| byKindAndSortOrder | kind, sortOrder | false |
| byOrigin | origin | false |
| byCreationRequestId | creationRequestId | true |
| byUpdatedAt | updatedAt | false |

カテゴリ一覧と検索は、同名タグを `id`、作成元、利用件数で区別する。カテゴリの作成・改名・論理削除・復元は `byCategoryUniqueName` と同じトランザクションで検証し、同名の有効カテゴリを許さない。復元時に同名カテゴリが存在すればCONFLICTとして利用者判断を求める。

## bookmarkLabels

~~~ts
interface BookmarkLabelRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  labelId: Id
  assignedBy: "USER" | "AI" | "IMPORT" | "SHARE"
  confidence: number | null
  classificationJobId: Id | null
  createdAt: EpochMs
  updatedAt: EpochMs
  revision: number
  deletedAt: EpochMs | null
}
~~~

### 不変条件

- 同じ `bookmarkId` と `labelId` の組は、論理削除済みも含めて1レコードだけとする。再割当時は既存レコードの `deletedAt` を戻し、別レコードを追加しない。
- 同じBookmarkにはカテゴリとタグをそれぞれ複数割り当てられる。種別は参照先 `Label.kind` から取得し、関連側に重複保持しない。
- 同じLabelを複数のBookmarkから参照できる。名称が同じ別タグは別の `labelId` として扱う。
- AI適用はユーザーが割り当てた関連を暗黙に削除しない。置換操作は対象差分を明示し、BookmarkRevisionへ残す。
- confidenceはAI割当時だけ0〜1の値を許し、それ以外はnull。

### 索引

| 索引 | keyPath | unique |
| --- | --- | --- |
| byBookmarkAndLabel | bookmarkId, labelId | true |
| byBookmark | bookmarkId | false |
| byLabel | labelId | false |
| byClassificationJob | classificationJobId | false |

`byBookmarkAndLabel` は名称重複を禁止する索引ではなく、同じ2つのIDを結ぶedgeの二重作成だけを禁止する。tombstoneを同じレコードで再有効化するため、論理削除とも両立する。

## classificationJobs

~~~ts
interface ClassificationJobRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  state:
    | "PENDING"
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "NEEDS_REVIEW"
    | "CANCELED"
  inputFingerprint: string
  bookmarkRevision: number
  settingsVersion: number
  granularity: 1 | 2 | 3 | 4 | 5
  maxNewTags: number
  maxAssignedCategories: number
  maxAssignedTags: number
  provider: "CHROME_PROMPT"
  providerModel: string | null
  executionContext: "TOP_LEVEL_EXTENSION_DOCUMENT" | null
  executorInstanceId: string | null
  leaseExpiresAt: EpochMs | null
  attempt: number
  errorCode: string | null
  startedAt: EpochMs | null
  finishedAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

ページ本文、完全なプロンプト、AIの自由文応答は既定で保存しない。デバッグ用に必要な場合も個人データを除去し、開発ビルドに限定する。

### 索引

- byStateUpdatedAt: state, updatedAt
- byBookmarkCreatedAt: bookmarkId, createdAt
- byFingerprint: inputFingerprint

同じ入力fingerprintのSUCCEEDEDがある場合は再適用しない。JobはService Worker内でAI実行しない。長時間RUNNINGのJobはAI Hostのトップレベル拡張ページが閉じた可能性があるため、lease期限後、attempt上限内でPENDINGへ戻せる。

## bookmarkRevisions

~~~ts
interface BookmarkRevisionRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  bookmarkRevision: number
  reason: "USER_EDIT" | "AI_CLASSIFICATION" | "LABEL_MERGE" | "ARCHIVE"
  before: {
    categoryIds: Id[]
    tagIds: Id[]
    archiveState: "ACTIVE" | "ARCHIVED"
  }
  after: {
    categoryIds: Id[]
    tagIds: Id[]
    archiveState: "ACTIVE" | "ARCHIVED"
  }
  actor: "USER" | "AI" | "SYSTEM"
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

完全なBookmarkスナップショットを無期限保存せず、Undoに必要な分類差分だけを短期間保持する。保持件数と期間は実測後に決める。

## blobs

~~~ts
interface BlobRecord {
  schemaVersion: number // Blob metadata documentの版。data自体はJSON外
  id: Id
  kind: "THUMBNAIL" | "FAVICON"
  mimeType: string
  byteLength: number
  width: number | null
  height: number | null
  contentHash: string
  data: Blob
  createdAt: EpochMs
  updatedAt: EpochMs
  lastReferencedAt: EpochMs
}
~~~

- 許可MIME、最大バイト数、最大寸法を検証する。
- 同一contentHashを再利用できる。
- BookmarkのfaviconBlobIdまたはthumbnailBlobIdから参照されないBlobだけを、安全に回収する保守処理を用意する。
- 外部URLを画像表示のたびに読み込まず、追跡とリンク切れを避ける。

## schemaMeta

~~~ts
interface SchemaMetaRecord {
  key: "database"
  schemaVersion: number
  normalizationVersion: number
  searchSchemaVersion: number
  migrationState: "IDLE" | "RUNNING" | "FAILED"
  migrationId: string | null
  migrationCursor: { store: string; lastKey: IDBValidKey | null } | null
  updatedAt: EpochMs
}
~~~

IndexedDBのversionとアプリ内部のschemaVersionを対応付ける。途中失敗を検知できるよう、長いデータ変換は小さい段階に分ける。

## chrome.storage.localの設定

ドメインデータと混ぜず、次の設定オブジェクトだけを保存する。

~~~ts
interface LocalSettings {
  settingsSchemaVersion: number
  aiEnabled: boolean
  aiGranularity: 1 | 2 | 3 | 4 | 5
  viewMode: "LIST" | "GRID"
  thumbnailEnabled: boolean
  frequentVisitReminderEnabled: boolean
  frequentVisitThreshold: number
  autoArchiveEnabled: boolean
  archiveAfterDays: number
}
~~~

- 不明なenum値は安全な既定値へ戻す。
- 設定の破損でBookmarkデータを初期化しない。
- 閾値と日数は安全な整数範囲を検証する。端末固有表示設定は同期せず、行動履歴関連の設定を同期するかは同期Planで固定する。

## visitReminders

完全な閲覧履歴を複製せず、リマインダーの重複抑止に必要な最小情報だけを保存する。

~~~ts
interface VisitReminderRecord {
  schemaVersion: number
  id: Id
  normalizedUrlHash: string
  normalizedUrl: string
  visitCountAtReminder: number
  state: "PENDING" | "SAVED" | "SNOOZED" | "DISMISSED"
  remindedAt: EpochMs
  nextEligibleAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

同じ正規化URLに有効な `PENDING` を複数作らない。`SAVED` へ変えるのは利用者が通知または確認UIの `保存` を選び、Bookmark保存がcommitした後だけとする。

## importJobs

~~~ts
interface ImportJobRecord {
  schemaVersion: number
  id: Id
  source: "CHROME_BOOKMARKS"
  state: "PREVIEW" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "CANCELED"
  discoveredCount: number
  importedCount: number
  skippedCount: number
  failedCount: number
  cursor: string | null
  createdAt: EpochMs
  updatedAt: EpochMs
  finishedAt: EpochMs | null
}
~~~

標準BookmarkのURL、title、folder pathはプレビュー時の未信頼入力として検証する。元のChrome Bookmark IDを正本IDにせず、取り込んだBookmarkには `source="CHROME_IMPORT"` を記録する。元データを変更・削除しない。

## トランザクション

### 保存

Service Worker側のアプリケーション層がbookmarksとPENDING classificationJobsを1トランザクションで更新する。AI呼び出しはService WorkerでもDBトランザクション内でも行わず、対応を実証したトップレベル拡張ページで行う。

### 分類適用

AI Hostが外形検証した結果をService Workerへメッセージ送信し、Service Worker側のアプリケーション層が次を実行する。

1. requestId、lease、BookmarkのrevisionがJob開始時と一致するか確認する。
2. 返却された既存Label IDがJob開始時に提示した候補内で、有効なレコードか確認する。同名候補を名称だけで特定しない。
3. 既存カテゴリはユーザー作成Labelだけ、新規作成候補はタグだけであることを確認する。
4. 新規 `TAG` は件数・文字列・細分化上限を確認し、`creationRequestId = jobId:proposalKey` で作成または同じ作成結果を再利用する。
5. `byBookmarkAndLabel` を使って既存edgeを差分更新する。ユーザー割当を暗黙に削除せず、同じedgeの再送は更新として扱う。
6. BookmarkのclassificationStateとrevisionを更新する。
7. bookmarkRevisionsを追加する。
8. classificationJobsをSUCCEEDEDへ更新する。

上記を単一トランザクションで行う。revisionが変わっていれば自動上書きせずCONFLICTまたはNEEDS_REVIEWにする。

### タグ統合

sourceLabelの関連をtargetLabelへ移し、同じ `(bookmarkId, targetLabelId)` が既にあればedgeを1件へまとめ、sourceLabelを論理削除する。カテゴリとタグの間の統合は拒否する。同名タグは正当な別レコードであるため、名称一致だけで自動統合しない。

### 訪問判定とアーカイブ

履歴照会はDB transaction外で行い、検証済みの `visitCount` / `lastVisitedAt` だけを短いtransactionで更新する。アーカイブ判定時はBookmarkのrevisionを再確認し、設定期間を超えた `ACTIVE` だけを `archiveState="ARCHIVED"`、`archiveReason="INACTIVE"` へ変更する。`lastVisitedAt=null`、既にARCHIVED、更新競合の項目は自動変更しない。Bookmark更新、BookmarkRevision、同期Outboxを同じtransactionへ含める。

## 検索用データ

自然言語検索は1つの入力からカテゴリ／タグ候補とBookmark候補を同時に返す。候補集合は複数件を許すが、順位とスコアを契約に含めない。検索語、AIが展開した語、自由文の理由は既定で永続化しない。

IndexedDBには全文検索がないため、正データから次の派生レコードを再生成する。規模計測前に外部全文検索ライブラリや埋め込みベクトルを導入しない。

~~~ts
interface SearchDocumentRecord {
  schemaVersion: number
  id: string // `${entityType}:${entityId}`
  entityType: "LABEL" | "BOOKMARK"
  entityId: Id
  sourceRevision: number
  searchSchemaVersion: number
  normalizedText: string
  searchKeys: string[] // entityTypeを接頭辞に含む正規化token/ngram
  builtAt: EpochMs
  createdAt: EpochMs
  updatedAt: EpochMs
}

interface SearchCandidate {
  entityType: "LABEL" | "BOOKMARK"
  entityId: Id
  entityRevision: number
  source: "LEXICAL" | "AI_SELECTED"
  matchedFields: string[]
}

interface UnifiedSearchResult {
  schemaVersion: number
  queryId: Id
  labels: SearchCandidate[]
  bookmarks: SearchCandidate[]
  source: "KEYWORD" | "AI" | "LEXICAL_FALLBACK"
}
~~~

`labels` はカテゴリとタグを含み、レスポンス契約とUIで常に `bookmarks` より先に扱う。配列順はAI関連度を表さない。

### 索引

| 索引 | keyPath | unique | オプション |
| --- | --- | --- | --- |
| byEntity | entityType, entityId | true | 通常索引 |
| byEntityType | entityType | false | 通常索引 |
| bySearchKey | searchKeys | false | `multiEntry: true` |

- Bookmark文書はtitle、siteName、URL host/path等の本体文字列だけを持つ。
- Label文書はname、normalizedName、kind、originから生成する。同名タグも別の `entityId` として別候補になる。
- カテゴリ／タグ名に一致したBookmark候補は、Label文書で得た `labelId` から `bookmarkLabels.byLabel` をたどって生成する。Bookmark文書へ名称を複製しないため、Label改名時に全Bookmark文書を再構築する必要がない。
- `sourceRevision` が正データと異なる文書は検索前または保守処理で再構築する。派生文書の欠損・破損を理由に正データを削除しない。
- 日本語の部分一致、分かち書き、表記揺れ、ngram長は検索スキーマのバージョンを付けて変更できるようにする。

### 自然言語検索の候補と検証

1. AI Hostは自然言語を固定スキーマの検索語・意図へ変換する。AIが使えない場合は入力文字列をそのまま正規化する。
2. Service Worker側で語数、文字数、対象種別を検証し、`searchDocuments` と `bookmarkLabels` から上限付き候補集合を作る。
3. AI Hostは提示済み候補から可能性が高いID集合だけを選ぶ。AIへは候補IDと最小限の表示情報だけを渡す。
4. Service Worker側でID、種別、revision、重複、件数上限を再検証する。AIが返した順序は捨てる。
5. Label / Bookmarkごとの決定的な中立順で返す。候補が複数でも1件へ暗黙確定せず、名称一致を単一IDへ暗黙変換しない。

自然言語検索はDashboardが開いている間の対話操作であるため、分類Jobのような永続 `searchJobs` StoreはMVPでは設けない。AI Hostを閉じた場合は検索を中断でき、Bookmark保存や分類Jobへ影響させない。

## カーソルページング

追加読み込みは savedAt と id の組をカーソルにする初期案である。同一時刻でも順序を固定する。

~~~ts
interface BookmarkCursor {
  savedAt: EpochMs
  id: Id
}
~~~

並び替え項目ごとに対応索引とカーソルを定義し、offset走査を避ける。フィルター変更時はカーソルを破棄する。

## マイグレーション

現時点の文書は未実装であるため、新規実装では本スキーマを最初の正本として作る。旧設計を試作済みの環境が存在する場合だけ、次の順序で移行する。

1. 破壊的変更前にエクスポートを用意し、旧Storeをただちに削除しない。
2. 旧 `tags` Storeから親参照を読み飛ばせる新旧両対応Readerを先に導入し、新 `labels` Storeへ移す。`byCategoryUniqueName` と一意な `byCreationRequestId` を作る。
3. 旧階層の親カテゴリは、ユーザー作成が保証された各レコードだけを現行カテゴリへ変換する。同名カテゴリが複数ある場合は自動削除せず競合一覧を作り、利用者が正本を選ぶまで `NEEDS_REVIEW` とする。
4. 旧メイン種別のうち `origin=USER` はカテゴリへ変換する。AI等が作った旧メイン種別は現行規則に違反するためタグへ変換し、影響Bookmarkを `NEEDS_REVIEW` にする。旧サブ種別はタグへ変換し、親参照は移行後の分類に使わない。
5. Bookmarkから旧階層カテゴリIDを除き、`source=CAPTURE` は取得経路が判定できる場合に `CURRENT_TAB`、判定できなければ互換値から安全な既定値へ変換する。
6. BookmarkLabelは `role` を `Label.kind` で再判定し、同じ `(bookmarkId, labelId)` が複数あれば最新の有効状態と監査情報を残して1件にまとめる。その後 `byBookmarkAndLabel` unique索引を作る。
7. 各Labelへ安定した `creationRequestId` を割り当てる。移行値は既存IDから `migration:<labelId>` のように決定的に生成し、再実行で変えない。
8. BookmarkRevisionの旧単一分類IDを `categoryIds` / `tagIds` の配列へ変換する。
9. `searchDocuments` を正データからバッチ再構築し、`migrationCursor` に完了位置を保存する。
10. 件数、参照整合、カテゴリ作成元、edge一意性を確認してから新Readerへ切り替える。旧階層Storeと旧フィールドは少なくとも1リリースの復旧期間後に別バージョンで削除する。

変換は冪等にし、Object Store・索引変更と大量レコード変換を分ける。失敗時はUIに状態と復旧方法を示し、旧バージョン、空DB、カテゴリ名競合、同名タグ、複数カテゴリ／タグ、最大想定件数、途中中断でテストする。

未実装のため、マイグレーション成功を保証するものではない。

## Google Drive同期の競合設計

同一ユーザーの複数端末を、明示接続したGoogle Drive `appDataFolder` で同期するP1確定設計である。`syncOutbox`、`syncConflicts`、`syncState` はP1実装時に作成し、OAuth未接続でもローカル正本を利用できる。

### 同期Envelope

~~~ts
interface SyncEnvelope<T> {
  schemaVersion: number
  entityType: string
  entityId: Id
  revision: number
  updatedAt: EpochMs
  deviceId: Id
  deletedAt: EpochMs | null
  payload: T
}
~~~

各端末はdeviceIdを持ち、lastSyncedSnapshotまたはそのハッシュを保存する。Drive更新にはETag等の前提条件を使い、競合時は再取得して三者マージする。

### マージ規則

| 競合 | 自動処理案 | 人の確認 |
| --- | --- | --- |
| 別フィールドの編集 | 両方を統合 | 不要 |
| 同じスカラーの編集 | updatedAt、同値ならdeviceIdで決定 | 重要フィールドは履歴から戻せるようにする |
| BookmarkLabelの追加同士 | 集合和 | 不要 |
| 関連の追加と削除 | 操作時刻の新しい方。削除イベントを保持 | 不自然な結果なら必要 |
| レコード更新と削除 | 新しい操作を採用。削除tombstoneを保持 | 多数の関連へ影響する場合は必要 |
| 同名カテゴリの同時作成 | `categoryUniqueName` で1件だけ成立 | 競合側へ既存カテゴリを提示 |
| 同名タグの同時作成 | 別IDの正当なタグとして両方を保持 | ユーザーが統合を選ぶ場合だけ必要 |
| 同じBookmarkLabel edgeの同時追加 | `(bookmarkId, labelId)` で1件へ収束 | 不要 |
| スキーマ不明 | 適用せず隔離 | 必要 |

最終書き込みだけでデータを黙って失わない。自動解決できないものはsyncConflictsへ保存し、同期全体を破壊せずUIで解決する。

### tombstone

- 削除を一定期間tombstoneとして同期する。
- 全既知端末が削除を確認した後、または十分な保持期間後に回収する。
- 長期間オフライン端末による復活を防ぐ。
- tombstone回収前にエクスポートと復旧方針を決める。

### syncOutbox

~~~ts
interface SyncOperationRecord {
  schemaVersion: number
  id: Id
  entityType: string
  entityId: Id
  operation: "UPSERT" | "DELETE"
  baseRevision: number
  localRevision: number
  deviceId: Id
  createdAt: EpochMs
  updatedAt: EpochMs
  attempts: number
  lastErrorCode: string | null
}
~~~

ローカル更新とOutbox追加を同一トランザクションで行う。Drive障害時もOutboxを失わず、再送を冪等にする。

## スキーマ受入条件

- Blobを除く全正本documentがJSON stringify/parseで情報を失わずround-tripし、read/write時にschemaVersionとruntime schemaを検証する。
- 不明schemaVersion、非JSON値、過大documentを正本へ適用せず、Blob本体をQR／Drive JSONへ暗黙に含めない。
- 旧階層カテゴリStore・親参照が現行モデルに存在しない。
- 同一Bookmarkに複数のカテゴリ、複数のタグを割り当てられ、同じLabel IDを複数Bookmarkで再利用できる。
- 同じnormalizedNameの有効カテゴリは1件だけで、同名タグは別IDの複数候補として表示される。
- 同じ `(bookmarkId, labelId)` edgeは再送や同期後も1件だけである。
- AI経路からカテゴリを新規作成・改名・削除できず、タグ新規作成は細分化上限と `creationRequestId` の冪等性を満たす。
- 1つの自然言語検索がLabel / Bookmarkの無順位候補集合を返し、AIが候補外ID、重複ID、古いrevisionを混入させても拒否する。
- favicon BlobはfaviconBlobIdから参照でき、参照中のBlobを回収しない。外部favicon URLを一覧表示のたびに自動読込しない。
- AI失敗時もBookmarkが残る。
- AI Hostを途中で閉じ、次の対応ページでJobを再開しても重複タグを作らない。
- Service WorkerからLanguageModelを実行せず、PENDING JobはAI Hostが開くまで保持される。
- URL hash衝突でも異なるURLを誤って同一扱いしない。
- 設定破損でIndexedDBを初期化しない。
- `archiveState` が文字列 `ACTIVE` / `ARCHIVED` で保存され、自動アーカイブは最終訪問日時がない項目を変更せず、復元できる。
- 同じURLの訪問リマインダーを重複生成せず、利用者が保存を選ぶまでBookmarkを作らない。
- 標準Bookmarkインポートは元データを書き換えず、中断・再送後も重複を抑止する。
- タグ統合と大量edge更新が途中失敗時に部分適用されない。
- Drive同期で削除、同時名称変更、オフライン復帰を再現できる。

すべて実装後に検証する項目であり、現時点では未確認である。
