# DBスキーマ

## 文書の位置づけ

- 状態: **提案・未実装・マイグレーション未検証**
- MVP保存先: ドメインデータはIndexedDB、設定はchrome.storage.local
- 関連: [全体設計](./DESIGN.md) / [バックエンド](./BACKEND.md) / [セキュリティ](./SECURITY.md) / [技術的負債](./TECH-DEBT-TRACKER.md)

本書は関係を表形式で説明するが、MVPはRDBではなくIndexedDBのObject Storeとして実装する提案である。SQL DDLではない。

## モデル上の判断

- 確定要件: Chrome既存ブックマークとは別のBookmation専用レコードを使う。
- 確定要件: カテゴリ階層は持たず、タグは平坦な `MAIN` と `SUB` の2種類だけにする。
- 確定要件: `MAIN` タグを新規作成できるのはユーザーだけである。AIは既存の `MAIN` タグを選択できるが、作成・改名・削除はできない。
- 確定要件: `SUB` タグはユーザー定義を優先して再利用し、適切な候補がない場合だけAIが細分化設定の範囲内で作成できる。
- 確定要件: 同じ表示名・正規化名のタグを複数作成できる。タグの同一性は名称ではなく `id` で判断する。
- 確定要件: 1件のBookmarkへ `MAIN` と `SUB` をそれぞれ複数割り当てられ、同じTagを複数のBookmarkで再利用できる。
- 設計判断: `MAIN` と `SUB` の間に親子関係を設けない。表示上の区分とAI作成権限だけを `Tag.kind` で表す。
- PDF確定 p.8の訪問回数、最終訪問、QR、Drive同期向けフィールドは将来用とし、MVPで不要なデータは収集しない。

## 関係

| エンティティA | エンティティB | 多重度 | 規則 |
| --- | --- | --- | --- |
| Bookmark | Tag | 多対多 | BookmarkTagで関連付ける。同じ組は1件だけ |
| Bookmark | ClassificationJob | 1対多 | 再分類履歴をジョブ単位で残す |
| Bookmark | BookmarkRevision | 1対多 | AI・ユーザー変更の監査とUndo候補 |
| Bookmark / Tag | SearchDocument | 1対0または1 | 再生成可能な検索用派生データ |

`MAIN` と `SUB` はどちらも0件以上である。件数上限はAI出力と一括操作の安全上限として別に検証し、ドメインを単一 `MAIN` に制限しない。

## 共通型

~~~ts
type Id = string
type EpochMs = number
type EntityOrigin = "USER" | "AI" | "IMPORT" | "SHARE"
type TagKind = "MAIN" | "SUB"
type BookmarkState = "ACTIVE" | "ARCHIVED"
type ClassificationState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "NEEDS_REVIEW"
  | "CANCELED"
~~~

- IDはUUID等の衝突しにくい文字列とする。生成方式は実装時に決定する。
- 時刻はUTCのEpoch millisecondsで保存し、表示時にローカル時刻へ変換する。
- 表示名とは別にnormalizedNameを持つ。Unicode正規化、前後空白除去、大小文字処理の規則をバージョン管理する。
- 同期対象になり得るレコードにはupdatedAt、revision、deviceId、deletedAtを追加できる共通Envelopeを用意する。

## Object Store一覧

| Store | Key path | MVP | 用途 |
| --- | --- | --- | --- |
| bookmarks | id | 必須 | 拡張機能専用ブックマーク |
| tags | id | 必須 | 平坦なmain/subタグ |
| bookmarkTags | id | 必須 | BookmarkとTagの関連 |
| classificationJobs | id | 必須 | 中断・再試行可能なAIジョブ |
| bookmarkRevisions | id | 推奨 | 直前分類のUndoと監査 |
| searchDocuments | id | 必須 | BookmarkとTagの再生成可能な検索用データ |
| blobs | id | 条件付き | サムネイル等のBlobとメタ情報 |
| schemaMeta | key | 必須 | DBバージョン、移行状態 |
| syncOutbox | id | 将来 | 未同期操作 |
| syncConflicts | id | 将来 | 自動解決できない競合 |
| syncState | key | 将来 | deviceId、最終同期状態 |

## bookmarks

~~~ts
interface BookmarkRecord {
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
  state: "ACTIVE" | "ARCHIVED"
  classificationState:
    | "UNCLASSIFIED"
    | "PENDING"
    | "CLASSIFIED"
    | "NEEDS_REVIEW"
    | "FAILED"
  source: "CURRENT_TAB" | "MANUAL_URL" | "IMPORT" | "SHARE"
  savedAt: EpochMs
  updatedAt: EpochMs
  archivedAt: EpochMs | null
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
| byStateSavedAt | state, savedAt | false | 一覧とアーカイブ |
| byClassificationState | classificationState | false | 未分類・要確認キュー |
| bySavedAt | savedAt | false | 追加読み込みカーソル |
| byUpdatedAt | updatedAt | false | 差分・同期候補 |

URL hashだけをuniqueにしない。hash衝突と、正規化規則の更新を考慮する。重複ポリシーはRepositoryでnormalizedUrlを比較して決める。

faviconUrlは取得元の記録または未キャッシュ時の候補であり、一覧表示のたびに外部URLへアクセスするための値ではない。取得・検証できた画像はfaviconBlobIdでローカルBlobを参照し、取得できなければ文字ベースの代替表示を使う。

lastVisitedAtとvisitCountはPDF確定 p.8の追加機能用である。history権限がないMVPではnullのままにし、推測値を入れない。`MANUAL_URL` でも入力値をそのまま信用せず、許可スキーム、長さ、正規化結果を検証する。

## tags

~~~ts
interface TagRecord {
  id: Id
  name: string
  normalizedName: string
  kind: "MAIN" | "SUB"
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

- `kind` が `MAIN` なら `origin` は必ず `USER` とする。インポート等でMAINを作る場合も、ユーザーの明示確認後にユーザー作成操作として扱う。
- `kind` が `SUB` なら `origin` は `USER`、`AI`、将来の `IMPORT` / `SHARE` を許す。P0で自動作成できる経路はAIだけであり、インポート・共有はユーザー確認を伴う別境界とする。
- `normalizedName` は検索と候補提示に使う派生値であり、一意キーではない。同じ `kind`、同じ `normalizedName` の有効レコードを複数許可する。
- AIは既存のユーザー作成Tagを優先して候補にし、適切な候補がない場合だけ `SUB` を作成する。名称一致だけを理由に新規作成を禁止したり、自動統合したりしない。
- AIはorigin USERのレコードを上書きしない。
- `creationRequestId` は作成操作の冪等キーであり一意とする。意図した同名Tagの追加は新しいrequestId、同じ操作の再送は同じrequestIdを使う。AIは `jobId:proposalKey` から安定して生成する。
- 削除は初期段階でdeletedAtによる論理削除とし、参照中の即時物理削除を避ける。

### 索引

| 索引 | keyPath | unique |
| --- | --- | --- |
| byNormalizedName | normalizedName | false |
| byKindAndName | kind, normalizedName | false |
| byKindAndSortOrder | kind, sortOrder | false |
| byOrigin | origin | false |
| byCreationRequestId | creationRequestId | true |
| byUpdatedAt | updatedAt | false |

タグ検索の結果と右サイドバーの操作は、同名Tagを `id`、種別、作成元、利用件数で区別する。Repositoryは `findByName` を単一件返却にせず、常に候補配列を返す。

## bookmarkTags

~~~ts
interface BookmarkTagRecord {
  id: Id
  bookmarkId: Id
  tagId: Id
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

- 同じ `bookmarkId` と `tagId` の組は、論理削除済みも含めて1レコードだけとする。再割当時は既存レコードの `deletedAt` を戻し、別レコードを追加しない。
- 同じBookmarkには `MAIN` と `SUB` をそれぞれ複数割り当てられる。種別は参照先 `Tag.kind` から取得し、関連側に重複保持しない。
- 同じTagを複数のBookmarkから参照できる。名称が同じ別Tagは別の `tagId` として扱う。
- AI適用はユーザーが割り当てた関連を暗黙に削除しない。置換操作は対象差分を明示し、BookmarkRevisionへ残す。
- confidenceはAI割当時だけ0〜1の値を許し、それ以外はnull。

### 索引

| 索引 | keyPath | unique |
| --- | --- | --- |
| byBookmarkAndTag | bookmarkId, tagId | true |
| byBookmark | bookmarkId | false |
| byTag | tagId | false |
| byClassificationJob | classificationJobId | false |

`byBookmarkAndTag` は名称重複を禁止する索引ではなく、同じ2つのIDを結ぶedgeの二重作成だけを禁止する。tombstoneを同じレコードで再有効化するため、論理削除とも両立する。

## classificationJobs

~~~ts
interface ClassificationJobRecord {
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
  maxNewSubtags: number
  maxAssignedMainTags: number
  maxAssignedSubtags: number
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
  id: Id
  bookmarkId: Id
  bookmarkRevision: number
  reason: "USER_EDIT" | "AI_CLASSIFICATION" | "TAG_MERGE" | "ARCHIVE"
  before: {
    mainTagIds: Id[]
    subTagIds: Id[]
    state: "ACTIVE" | "ARCHIVED"
  }
  after: {
    mainTagIds: Id[]
    subTagIds: Id[]
    state: "ACTIVE" | "ARCHIVED"
  }
  actor: "USER" | "AI" | "SYSTEM"
  createdAt: EpochMs
}
~~~

完全なBookmarkスナップショットを無期限保存せず、Undoに必要な分類差分だけを短期間保持する。保持件数と期間は実測後に決める。

## blobs

~~~ts
interface BlobRecord {
  id: Id
  kind: "THUMBNAIL" | "FAVICON"
  mimeType: string
  byteLength: number
  width: number | null
  height: number | null
  contentHash: string
  data: Blob
  createdAt: EpochMs
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
  viewMode: "LIST" | "GRID" | "BENTO"
  gridColumns: number
  bentoColumns: number
  defaultSearchTarget: "TAGS" | "BOOKMARKS"
  thumbnailEnabled: boolean
}
~~~

- 列数はUIが許可する範囲へclampする。
- 不明なenum値は安全な既定値へ戻す。
- 設定の破損でBookmarkデータを初期化しない。
- 将来の同期対象にするかは設定ごとに決め、端末固有表示設定は同期しない初期案とする。

## トランザクション

### 保存

Service Worker側のアプリケーション層がbookmarksとPENDING classificationJobsを1トランザクションで更新する。AI呼び出しはService WorkerでもDBトランザクション内でも行わず、対応を実証したトップレベル拡張ページで行う。

### 分類適用

AI Hostが外形検証した結果をService Workerへメッセージ送信し、Service Worker側のアプリケーション層が次を実行する。

1. requestId、lease、BookmarkのrevisionがJob開始時と一致するか確認する。
2. 返却された既存Tag IDがJob開始時に提示した候補内で、有効なレコードか確認する。同名候補を名称だけで特定しない。
3. 既存 `MAIN` はユーザー作成Tagだけ、新規作成候補は `SUB` だけであることを確認する。
4. 新規 `SUB` は件数・文字列・細分化上限を確認し、`creationRequestId = jobId:proposalKey` で作成または同じ作成結果を再利用する。
5. `byBookmarkAndTag` を使って既存edgeを差分更新する。ユーザー割当を暗黙に削除せず、同じedgeの再送は更新として扱う。
6. BookmarkのclassificationStateとrevisionを更新する。
7. bookmarkRevisionsを追加する。
8. classificationJobsをSUCCEEDEDへ更新する。

上記を単一トランザクションで行う。revisionが変わっていれば自動上書きせずCONFLICTまたはNEEDS_REVIEWにする。

### タグ統合

sourceTagの関連をtargetTagへ移し、同じ `(bookmarkId, targetTagId)` が既にあればedgeを1件へまとめ、sourceTagを論理削除する。`MAIN` と `SUB` の間の統合は拒否する。同名Tagは正当な別レコードであるため、名称一致だけで自動統合しない。

## 検索用データ

自然言語検索は「Tag候補」と「Bookmark候補」を別の検索対象として扱い、それぞれ複数件を順位付きで返す。検索語、AIが展開した語、自由文の理由は既定で永続化しない。

IndexedDBには全文検索がないため、正データから次の派生レコードを再生成する。規模計測前に外部全文検索ライブラリや埋め込みベクトルを導入しない。

~~~ts
interface SearchDocumentRecord {
  id: string // `${entityType}:${entityId}`
  entityType: "TAG" | "BOOKMARK"
  entityId: Id
  sourceRevision: number
  searchSchemaVersion: number
  normalizedText: string
  searchKeys: string[] // entityTypeを接頭辞に含む正規化token/ngram
  builtAt: EpochMs
}

interface RankedSearchCandidate {
  entityType: "TAG" | "BOOKMARK"
  entityId: Id
  entityRevision: number
  rank: number
  score: number
  source: "LEXICAL" | "AI_RERANKED"
  matchedFields: string[]
}
~~~

### 索引

| 索引 | keyPath | unique | オプション |
| --- | --- | --- | --- |
| byEntity | entityType, entityId | true | 通常索引 |
| byEntityType | entityType | false | 通常索引 |
| bySearchKey | searchKeys | false | `multiEntry: true` |

- Bookmark文書はtitle、siteName、URL host/path等の本体文字列だけを持つ。
- Tag文書はname、normalizedName、kind、originから生成する。同名Tagも別の `entityId` として別候補になる。
- タグ名に一致したBookmark候補は、Tag文書で得た `tagId` から `bookmarkTags.byTag` をたどって生成する。Bookmark文書へタグ名を複製しないため、Tag改名時に全Bookmark文書を再構築する必要がない。
- `sourceRevision` が正データと異なる文書は検索前または保守処理で再構築する。派生文書の欠損・破損を理由に正データを削除しない。
- 日本語の部分一致、分かち書き、表記揺れ、ngram長は検索スキーマのバージョンを付けて変更できるようにする。

### 自然言語検索の候補と検証

1. AI Hostは自然言語を固定スキーマの検索語・意図へ変換する。AIが使えない場合は入力文字列をそのまま正規化する。
2. Service Worker側で語数、文字数、対象種別を検証し、`searchDocuments` と `bookmarkTags` から上限付き候補集合を作る。
3. 必要な場合だけAI Hostが候補集合を再順位付けする。AIへは候補IDと最小限の表示情報だけを渡す。
4. AIが返せるのは提示済み候補IDの順序とスコアだけとし、Service Worker側でID、種別、revision、重複、件数上限を再検証する。
5. 同点は決定的な規則で並べ、Tag検索もBookmark検索も0件以上の候補を配列で返す。候補が複数ある場合に1件へ暗黙確定せず、該当が1件だけなら1件の配列を返す。名称一致を単一IDへ暗黙変換しない。

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
2. `tags` からカテゴリ参照と親Tag参照を読み飛ばせる新旧両対応Readerを先に導入する。名称のunique索引を削除し、`byKindAndName` 等の非unique索引と一意な `byCreationRequestId` を作る。
3. 旧カテゴリは、旧仕様でユーザー作成が保証された各レコードを同名の `MAIN` Tagへ1対1変換する。旧Bookmarkがそのカテゴリを参照していた場合は対応するBookmarkTag edgeを追加する。既存Tagと同名でも統合しない。
4. 旧 `MAIN` Tagのうち `origin=USER` は `MAIN` のまま残す。AI等が作った旧 `MAIN` は新規則に違反するため `SUB` へ変換し、影響Bookmarkを `NEEDS_REVIEW` にする。旧 `SUB` は `SUB` のまま残し、親参照は移行後の分類に使わない。
5. Bookmarkから旧カテゴリIDを除き、`source=CAPTURE` は取得経路が判定できる場合に `CURRENT_TAB`、判定できなければ互換値から安全な既定値へ変換する。
6. BookmarkTagは `role` をTag.kindで再判定し、同じ `(bookmarkId, tagId)` が複数あれば最新の有効状態と監査情報を残して1件にまとめる。その後 `byBookmarkAndTag` unique索引を作る。
7. 各Tagへ安定した `creationRequestId` を割り当てる。移行値は既存IDから `migration:<tagId>` のように決定的に生成し、再実行で変えない。
8. BookmarkRevisionの単一 `mainTagId` を配列 `mainTagIds` へ変換し、旧カテゴリから変換したMAIN edgeも必要に応じて含める。
9. `searchDocuments` を正データからバッチ再構築し、`migrationCursor` に完了位置を保存する。
10. 件数、参照整合、MAIN作成元、edge一意性を確認してから新Readerへ切り替える。旧カテゴリStoreと旧フィールドは少なくとも1リリースの復旧期間後に別バージョンで削除する。

変換は冪等にし、Object Store・索引変更と大量レコード変換を分ける。失敗時はUIに状態と復旧方法を示し、旧バージョン、空DB、同名Tag、複数MAIN/SUB、最大想定件数、途中中断でテストする。

未実装のため、マイグレーション成功を保証するものではない。

## 将来同期の競合設計

PDF確定 p.8のGoogle Drive同期向けの提案であり、MVPでは関連Storeも同期処理も実装しない。

### 同期Envelope

~~~ts
interface SyncEnvelope<T> {
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
| BookmarkTagの追加同士 | 集合和 | 不要 |
| 関連の追加と削除 | 操作時刻の新しい方。削除イベントを保持 | 不自然な結果なら必要 |
| レコード更新と削除 | 新しい操作を採用。削除tombstoneを保持 | 多数の関連へ影響する場合は必要 |
| 同名タグの同時作成 | 別IDの正当なTagとして両方を保持 | ユーザーが統合を選ぶ場合だけ必要 |
| 同じBookmarkTag edgeの同時追加 | `(bookmarkId, tagId)` で1件へ収束 | 不要 |
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
  id: Id
  entityType: string
  entityId: Id
  operation: "UPSERT" | "DELETE"
  baseRevision: number
  localRevision: number
  deviceId: Id
  createdAt: EpochMs
  attempts: number
  lastErrorCode: string | null
}
~~~

ローカル更新とOutbox追加を同一トランザクションで行う。Drive障害時もOutboxを失わず、再送を冪等にする。

## スキーマ受入条件

- カテゴリStore・カテゴリID・Tag間の親参照が現行モデルに存在しない。
- 同一Bookmarkに複数のMAIN、複数のSUBを割り当てられ、同じTag IDを複数Bookmarkで再利用できる。
- 同じkind・同じnormalizedNameのTagを複数作成でき、候補が別IDのまま表示される。
- 同じ `(bookmarkId, tagId)` edgeは再送や同期後も1件だけである。
- AI経路からMAIN Tagを新規作成・改名・削除できず、SUB新規作成は細分化上限と `creationRequestId` の冪等性を満たす。
- 自然言語のTag検索とBookmark検索が候補配列を返し、AIが候補外ID、重複ID、古いrevisionを混入させても拒否する。
- favicon BlobはfaviconBlobIdから参照でき、参照中のBlobを回収しない。外部favicon URLを一覧表示のたびに自動読込しない。
- AI失敗時もBookmarkが残る。
- AI Hostを途中で閉じ、次の対応ページでJobを再開しても重複タグを作らない。
- Service WorkerからLanguageModelを実行せず、PENDING JobはAI Hostが開くまで保持される。
- URL hash衝突でも異なるURLを誤って同一扱いしない。
- 設定破損でIndexedDBを初期化しない。
- タグ統合と大量edge更新が途中失敗時に部分適用されない。
- 将来同期で削除、同時名称変更、オフライン復帰を再現できる。

すべて実装後に検証する項目であり、現時点では未確認である。
