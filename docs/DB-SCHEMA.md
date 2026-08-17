# DBスキーマ

## 文書の位置づけ

- 状態: **提案・未実装・マイグレーション未検証**
- 保存先: ドメインデータはIndexedDB、設定はchrome.storage.local、同一ユーザー同期は明示接続したGoogle Drive appDataFolder
- 関連: [全体設計](./DESIGN.md) / [バックエンド](./BACKEND.md) / [セキュリティ](./SECURITY.md) / [技術的負債](./TECH-DEBT-TRACKER.md)

本書は関係を表形式で説明するが、RDB／SQLではない。IndexedDBを保存エンジンにし、Blob以外を版付きJSON互換ドキュメントとして保存する。TypeScript interfaceはJSON Schemaから生成または同時検証し、型注釈だけで永続データを信用しない。

## モデル上の判断

- 確定要件: Chrome既存ブックマークとは別のBookmation専用レコードを使う。
- 確定要件: カテゴリを親、タグを子とする1段階の階層を持つ。全TAGレコードは物理的に存在するCATEGORYレコードを1件参照し、ACTIVE TAGはACTIVE CATEGORYを親に持つ。削除済みTAGだけは削除済みCATEGORYを参照できる。カテゴリを持たないタグやタグの子要素は許可しない。
- 確定要件: カテゴリを新規作成できるのはユーザーだけである。AIは既存カテゴリを選択できるが、作成・改名・削除はできない。
- 確定要件: タグはユーザー定義を優先して再利用し、適切な候補がない場合だけAIが細分化設定の範囲内で作成できる。
- 確定要件: カテゴリ名とタグ名はそれぞれ正規化後に全体で一意とする。タグ名は親カテゴリをまたいでも重複を許さず、分類ラベルの同一性は名称ではなく `id` で判断する。
- 確定要件: 1件のBookmarkへ複数のタグを割り当て、Category関連は割り当てられたACTIVE Tagの親Category集合としてのみ保持する。同じ分類ラベルは複数のBookmarkで再利用できるが、CategoryをBookmarkから独立して追加・解除する入力は持たない。
- 確定要件: `Label.kind` と `parentCategoryId` で1段階の親子関係を表す。カテゴリは `parentCategoryId=null`、タグは作成・編集時に選択した有効なカテゴリIDを必須とする。Tag編集では親Categoryを変更でき、全参照BookmarkのCategory edgeを同じtransactionで再計算する。[ISSUE-019](./ISSUES.md) はこの原子的な親更新を提供するルールで解決済みである。
- P1確定要件: 訪問回数・最終訪問日時、文字列のアーカイブ状態、リマインダー、インポート、QR共有、Drive同期を本スキーマで扱う。

## 関係

| エンティティA | エンティティB | 多重度 | 規則 |
| --- | --- | --- | --- |
| Category Label | Tag Label | 1対多 | TagのparentCategoryIdで関連付ける。Tagは親を1件だけ持つ |
| Bookmark | Label | 多対多 | BookmarkLabelで関連付ける。同じ組は1件だけ |
| Bookmark | ClassificationJob | 1対多 | 再分類履歴をジョブ単位で残す |
| Bookmark | BookmarkRevision | 1対多 | AI・ユーザーによる非削除変更の監査 |
| Bookmark / Label | SearchDocument | 1対0または1 | 再生成可能な検索用派生データ |

カテゴリとタグはどちらも0件以上であり、1件のBookmarkは複数Tagを通じて複数Categoryに所属できる。BookmarkのACTIVE Category edge集合は、ACTIVE Tag edgeが参照するTagの `parentCategoryId` の重複なし集合と常に完全一致させる。

## 共通型

~~~ts
type Id = string
type EpochMs = number
type EntityOrigin = "USER" | "AI" | "IMPORT" | "SHARE"
type LabelKind = "CATEGORY" | "TAG"
type ArchiveState = "ACTIVE" | "ARCHIVED"
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }
type ClassificationState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "NEEDS_REVIEW"
  | "CANCELED"
~~~

通常のID付きドメインJSONドキュメントは次の共通Envelopeを満たす。`ArchivedBookmarkRecord` だけは、トップレベルの `id` / `archiveState`、版を持つ `metadata`、最小利用者データの `payload` を分離し、時刻・revision等を `ArchiveOperationRecord` に持たせる。`schemaMeta` と設定等のkey-addressed documentは、固有keyと対応するschema versionを必須にする。

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
- 表示名とは別にnormalizedNameとnameNormalizationVersionを持つ。Label名の一意性用正規化は後述のv1へ固定し、検索token正規化と混同しない。
- 同期対象になり得るレコードにはupdatedAt、revision、deviceId、deletedAtを追加できる共通Envelopeを用意する。
- JSONに表現できない `undefined`、関数、循環参照、非有限数、BigIntを拒否する。日時は文字列化せずEpoch millisecondsへ統一する。
- `BlobRecord.data` だけはJSON外のstructured clone値であり、JSON側からID参照する。QR、Drive、exportへBlob本体を暗黙に含めない。

## Label名正規化v1

カテゴリ／タグの一意性判定には、project内へvendorしたUnicode 15.1.0データbundleだけを正本として、次の順序を固定する。bundleはNFKCに必要な正規化・composition data、`White_Space`、`Default_Ignorable_Code_Point`、General Category、`CaseFolding.txt` を含める。runtime ICU、`String.prototype.normalize()`、実行環境のUnicode property escapeを正本として使わない。

1. Unicode 15.1.0のvendored property tableで、raw入力にGeneral Category `Cs` または `Default_Ignorable_Code_Point` が1文字でもあれば変換前に拒否する。
2. vendored normalization dataでUnicode 15.1.0のNFKCを実行する。
3. vendored `White_Space` tableでTAB／LF等を含む連続文字をASCII space 1文字へ置換し、先頭末尾を除去する。
4. 空白処理後に残るGeneral Category `Cc` / `Cs` または `Default_Ignorable_Code_Point` を拒否する。したがってNUL、ゼロ幅空白、方向制御、BOM、ZWJ、variation selectorはv1で許可しない。
5. vendored Unicode 15.1.0 `CaseFolding.txt` のstatus CとFだけを使い、F mappingがある場合はF、なければCを適用するfull case foldを行う。status S / T、runtime locale、runtime lowercaseへ委ねない。
6. 結果を同じ `Cc` / `Cs` / `Default_Ignorable_Code_Point` 集合で再検証する。結果が空、長さ上限超過、または禁止文字を含む場合は保存しない。禁止集合を実行環境のUnicode更新へ追随させず、normalization versionの更新として明示的に変更する。

v1 fixtureは最低限次を固定し、Category／Tag作成、改名、Import、同期で同じ関数を使う。

| raw input | v1結果 |
| --- | --- |
| `  Ｐｙｔｈｏｎ　入門 ` | `python 入門` |
| `A\t\nB` | `a b` |
| `Straße` | `strasse` |
| `ab\u200Bcd` | reject |
| `ab\u202Ecd` | reject |
| `a\u0000b` | reject |
| `a\u200Db` | reject |
| `text\uFE0F` | reject |

検索tokenの表記揺れ、ngram、読み仮名等は `searchSchemaVersion` の派生規則であり、LabelのnormalizedNameや一意性を変更しない。検索規則を更新してもLabel IDの統合・改名を起こさない。vendored bundleのSHA-256は実assetから実装時に生成してschemaMetaとbuild定数へ固定する。本書ではasset未作成のためhash値を捏造・例示しない。

## Object Store一覧

| Store | Key path | MVP | 用途 |
| --- | --- | --- | --- |
| bookmarks | id | 必須 | 拡張機能専用ブックマーク |
| labels | id | P0必須 | 親カテゴリと、そのカテゴリに所属するタグ |
| tagMutationReceipts | id | P0必須 | Tag名称・親更新requestの冪等receipt |
| bookmarkLabels | id | P0必須 | BookmarkとCategory／Tagの整合した関連 |
| classificationJobs | id | 必須 | 中断・再試行可能なAIジョブ |
| bookmarkRevisions | id | 推奨 | 非削除変更の監査履歴 |
| searchDocuments | id | 必須 | BookmarkとCategory／Tagの再生成可能な検索用データ |
| blobs | id | 条件付き | サムネイル等のBlobとメタ情報 |
| schemaMeta | key | 必須 | DBバージョン、移行状態 |
| visitReminders | id | P1必須 | 訪問閾値到達後の通知と再通知抑止 |
| archiveOperations | id | P1必須 | アーカイブ理由・時刻・復元状態。最小payloadと分離 |
| importJobs | id | P1必須 | Chrome標準Bookmark取込の進捗と結果 |
| syncOutbox | id | P1必須 | Google Driveへの未同期操作 |
| syncSnapshots | id | P1必須 | 競合のbase／local／remoteを再現するimmutable snapshot |
| syncConflicts | id | P1必須 | 自動解決できない競合 |
| syncState | key | P1必須 | deviceId、接続状態、最終同期状態 |

## bookmarks

~~~ts
interface ActiveBookmarkRecord {
  schemaVersion: number
  id: Id
  archiveState: "ACTIVE"
  rawUrl: string
  normalizedUrl: string
  urlHash: string
  urlNormalizationVersion: number
  title: string
  siteName: string | null
  faviconUrl: string | null
  faviconBlobId: Id | null
  thumbnailBlobId: Id | null
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
  lastVisitedAt: EpochMs | null
  visitCount: number | null
  revision: number
  deletedAt: EpochMs | null
}

interface ArchivedBookmarkRecord {
  id: Id
  archiveState: "ARCHIVED"
  metadata: {
    schemaVersion: number
  }
  payload: {
    title: string
    url: string
    categories: Array<{
      categoryId: Id
      name: string
    }>
    tags: Array<{
      tagId: Id
      name: string
      parentCategoryId: Id
    }>
  }
}

type BookmarkRecord = ActiveBookmarkRecord | ArchivedBookmarkRecord
~~~

`ARCHIVED` は保存制御用のトップレベルID／状態と `metadata`、利用者データの `payload` を構造上分離する。payloadにはカテゴリ、タグ、ページ名、URLだけを残す。アーカイブ理由、時刻、revision、同期状態は別の `archiveOperations` に分離する。アーカイブ時に `siteName`、favicon／thumbnail参照、訪問回数、最終訪問日時、分類状態、取得元をpayloadへ複製しない。

### 索引

| 索引 | keyPath | unique | 用途 |
| --- | --- | --- | --- |
| byUrlHash | urlHash | false | 重複候補の高速検索。取得後にnormalizedUrlを比較 |
| byArchiveState | archiveState | false | ACTIVE／ARCHIVEDの分離 |
| byClassificationState | classificationState | false | 未分類・要確認キュー |
| bySavedAt | savedAt | false | 追加読み込みカーソル |
| byUpdatedAt | updatedAt | false | 差分・同期候補 |

URL hashだけをuniqueにしない。hash衝突と、正規化規則の更新を考慮する。重複ポリシーはRepositoryでnormalizedUrlを比較して決める。

faviconUrlは取得元の記録または未キャッシュ時の候補であり、一覧表示のたびに外部URLへアクセスするための値ではない。取得・検証できた画像はfaviconBlobIdでローカルBlobを参照し、取得できなければ文字ベースの代替表示を使う。

`lastVisitedAt` と `visitCount` は、利用者が訪問機能を有効化して `history` 権限を許可した場合だけACTIVEレコードへ更新する。権限がない場合や履歴に該当URLがない場合は `null` とし、`savedAt` から推測しない。自動アーカイブは `lastVisitedAt=null` のBookmarkを変更しない。`MANUAL_URL` でも入力値をそのまま信用せず、許可スキーム、長さ、正規化結果を検証する。

Bookmarkの論理削除ではrevisionを1つ進め、`deletedAt` を必須にする。favicon／thumbnail参照はtombstoneへ残し、同期tombstone保持期間が終わり他の参照がないことを確認するまで参照Blobを回収しない。

## labels

~~~ts
interface LabelRecord {
  schemaVersion: number
  id: Id
  name: string
  normalizedName: string
  nameNormalizationVersion: 1
  categoryUniqueName?: string // CATEGORYなら論理削除後も保持。TAGでは省略
  tagUniqueName?: string // TAGなら論理削除後も保持。CATEGORYでは省略
  kind: "CATEGORY" | "TAG"
  parentCategoryId: Id | null // CATEGORYはnull、TAGは物理的に存在するCATEGORY IDが必須
  origin: "USER" | "AI" | "IMPORT" | "SHARE"
  creationRequestId: string
  sortOrder: number
  createdAt: EpochMs
  updatedAt: EpochMs
  revision: number
  deletedAt: EpochMs | null
  cascadeDeleteRequestId: Id | null // Category連鎖削除で新たにtombstone化したLabelだけに同じrequestIdを記録
}
~~~

### 不変条件

- `kind="CATEGORY"` なら `parentCategoryId=null` かつ `origin="USER"` とする。インポート等でカテゴリを作る場合も、ユーザーの明示確認後にユーザー作成操作として扱う。
- `kind="TAG"` なら `parentCategoryId` は物理的に存在する `CATEGORY` のIDを必須とし、`origin` は `USER`、`AI`、P1の `IMPORT` / `SHARE` を許す。ACTIVE TAGはACTIVE CATEGORYだけを参照できる。削除済みTAGはACTIVEまたは削除済みCATEGORYを参照できるが、親CATEGORY record自体が欠損してはならない。
- CATEGORYは論理削除状態を問わず `categoryUniqueName = normalizedName` を持ち、同じ正規化名の別IDを作らない。論理削除でもunique keyを外さず、物理回収後だけ名前を再利用できる。
- TAGは論理削除状態を問わず `tagUniqueName = normalizedName` を持ち、`categoryUniqueName` は持たない。親カテゴリが同じか異なるかを問わず、同じ正規化名の別IDを作らない。論理削除でもunique keyを外さない。
- AIは意味候補の並びではorigin USERを優先するが、`tagUniqueName` の競合判定はoriginを問わず全TAGを対象にする。同じ正規化名があれば既存TAGを再評価し、親カテゴリと意味が適合する場合だけそのIDを再利用する。親または意味が適合しなければ別IDを作らずNEEDS_REVIEWにする。
- AIはorigin USERのレコードを上書きしない。
- `kind` は変更しない。ACTIVE Tagの `parentCategoryId` は、期待Tag revisionと選択したACTIVE親Categoryの期待revisionを検証する専用 `UpdateTag` transactionでだけ変更できる。Import、AI出力、同期の暗黙merge、名称一致を親変更commandへ変換しない。
- `creationRequestId` は作成操作の冪等キーであり一意とする。同じ操作の再送は同じrequestIdを使い、別requestIdでも既存と同じ正規化タグ名なら新規作成を拒否する。AIは `jobId:proposalKey` から安定して生成する。
- 削除は初期段階でdeletedAtによる論理削除とし、参照中の即時物理削除を避ける。CATEGORYの物理回収は、ACTIVE／削除済みを問わず `parentCategoryId` がそのIDであるTAG recordが0件になるまでBLOCKする。
- 論理削除ではrevisionを1つ進め、`deletedAt` を必須にする。削除Undoや利用者向けのLabel復元は提供しない。
- 通常作成・編集・単独Tag削除では `cascadeDeleteRequestId=null` とする。Category連鎖削除では対象Categoryとその操作で新たに削除する子Tagへ同じrequestIdを記録し、再送判定と同期batch照合にだけ使う。Undoや復元tokenとして解釈しない。

### 索引

| 索引 | keyPath | unique |
| --- | --- | --- |
| byNormalizedName | normalizedName | false |
| byKindAndName | kind, normalizedName | false |
| byParentCategory | parentCategoryId | false |
| byParentCategoryAndName | parentCategoryId, normalizedName | false |
| byCategoryUniqueName | categoryUniqueName | true |
| byTagUniqueName | tagUniqueName | true |
| byKindAndSortOrder | kind, sortOrder | false |
| byOrigin | origin | false |
| byCreationRequestId | creationRequestId | true |
| byCascadeDeleteRequestId | cascadeDeleteRequestId | false |
| byUpdatedAt | updatedAt | false |

カテゴリ／タグの作成・改名・論理削除は、それぞれ `byCategoryUniqueName` / `byTagUniqueName` と同じtransactionで検証する。タグ作成は有効な親カテゴリも同時に再確認する。同名の論理削除済みLabelがあれば別ID作成を拒否し、物理GCまで別名だけを案内する。unique keyはtombstoneに予約し続ける。

Category編集画面へ返す値は永続Storeを増やさず、`labels` と `bookmarkLabels` の同一読取snapshotから次の形へ投影する。

~~~ts
interface CategoryEditDetail {
  category: Pick<LabelRecord, "id" | "name" | "revision">
  activeTags: Array<Pick<LabelRecord, "id" | "name" | "revision">>
  activeTagCount: number
  referencedActiveBookmarkCount: number // activeTagsのいずれかを参照するACTIVE BookmarkをIDで重複除外
  impactFingerprint: string
}

interface TagEditDetail {
  tag: Pick<LabelRecord, "id" | "name" | "revision">
  parentCategory: Pick<LabelRecord, "id" | "name" | "revision">
}
~~~

`activeTags` は実際の保存名を返し、削除済みTagを混ぜない。件数と一覧は同じsnapshotから算出し、Category削除警告の影響表示にも同じqueryを使う。`impactFingerprint` はCategoryのID／revision、物理的に存在する全子TagのID／revision／deletedAt、対象Labelを参照する全edgeのID／revision／deletedAt、影響ACTIVE BookmarkのID／revisionを固定順のJSON配列へ正規化してSHA-256した値とする。警告画面を開いた後のTag作成・削除、edge追加・解除、Bookmark更新を検知するための同意snapshotであり、秘密性や真正性の保証には使わない。

`TagEditDetail` はACTIVE Tagと現在のACTIVE親を同じsnapshotで返す。親Category候補queryはこれと同じID・name・revision型を最大8件返し、nested `CreateCategory` の結果も同じ型として選択できる。

## tagMutationReceipts

~~~ts
interface UpdateTagResult {
  tagId: Id
  resultTagRevision: number
  affectedBookmarkCount: number
}

interface TagMutationReceiptRecord {
  schemaVersion: number
  id: `tag-update:${string}` // UpdateTag requestId
  tagId: Id
  requestFingerprint: string
  result: UpdateTagResult
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

`requestFingerprint` は `tagId`、expectedTagRevision、正規化前のname、parentCategoryId、expectedParentRevisionを版付きcanonical JSONにしてhash化する。requestIdは `tag-update:` namespaceで発行し、Category連鎖削除の `category-delete:` namespaceと衝突させない。同じrequestId・tagId・fingerprintの再送は期待revisionを再適用せず、receiptに保存した同一の `UpdateTagResult` へ収束する。同じnamespaceのrequestIdを別Tagまたは別payloadで使った場合は `REQUEST_ID_REUSED` として拒否する。receiptはTag tombstone、同期Outbox、未解決conflictから参照されなくなり、Tag本体を物理GCできるまで保持する。AIプロンプトやBookmark内容は含めず、Drive同期対象にはしない。

索引は `byTagCreatedAt: [tagId, createdAt]` を非uniqueで持つ。receipt作成はTag更新transactionの最後に行い、receiptだけが残る部分成功を許さない。

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
- 同じBookmarkには複数TAGを割り当てられる。TAG edgeを追加または復元する時は、その `parentCategoryId` のCATEGORY edgeも同じtransactionで追加または復元する。
- CATEGORY edgeは直接編集しない。Tag差分適用後、ACTIVEなTAG edgeの親CATEGORY ID集合を求め、その集合にないACTIVE CATEGORY edgeを論理削除し、不足するedgeを追加または復元する。同じ親の最後のTAG edgeを解除した時は親CATEGORY edgeも解除される。
- 同じLabelを複数のBookmarkから参照できる。名称変更や同期後も関連は表示名ではなく `labelId` で維持する。
- AI適用はユーザーが割り当てた関連を暗黙に削除しない。置換操作は対象差分を明示し、BookmarkRevisionへ残す。
- confidenceはAI割当時だけ0〜1の値を許し、それ以外はnull。
- edgeの論理削除ではrevisionを1つ進め、`deletedAt` を必須にする。

### 索引

| 索引 | keyPath | unique |
| --- | --- | --- |
| byBookmarkAndLabel | bookmarkId, labelId | true |
| byBookmark | bookmarkId | false |
| byLabel | labelId | false |
| byClassificationJob | classificationJobId | false |

`byBookmarkAndLabel` はLabel名の一意性を担う索引ではなく、同じ2つのIDを結ぶedgeの二重作成だけを禁止する。名称一意性はlabelsのkind別一意索引で扱う。tombstoneを同じレコードで再有効化するため、論理削除とも両立する。

## classificationJobs

~~~ts
type ClassificationPolicySnapshot =
  | { policyVersion: 1; granularity: 0; maxNewTags: 0 }
  | { policyVersion: 1; granularity: 1; maxNewTags: 1 }
  | { policyVersion: 1; granularity: 2; maxNewTags: 2 }
  | { policyVersion: 1; granularity: 3; maxNewTags: 4 }
  | { policyVersion: 1; granularity: 4; maxNewTags: 6 }

interface ClassificationJobRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  requestId: Id
  reason: "INITIAL_SAVE" | "USER_RECLASSIFY" | "CATEGORY_CASCADE_DELETE"
  triggerOperationId: Id | null
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
  policy: ClassificationPolicySnapshot
  maxCandidateCategories: number // Tag親候補の上限。Category edgeの直接割当上限ではない
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
- byRequestId: requestId（unique）

同じ入力fingerprintのSUCCEEDEDがある場合は再適用しない。通常Jobの `triggerOperationId` はnullとし、Category連鎖削除では削除requestIdを入れ、`requestId = categoryDeleteRequestId + ":" + bookmarkId` のようにBookmarkごとに安定生成して再送を1件へ収束させる。Job作成時に設定値から上記discriminated unionを生成し、`granularity` と `maxNewTags` の任意の組合せを受け付けない。policyVersionをfingerprintへ含め、後から設定や対応表が変わっても実行中Jobの上限を変えない。JobはService Worker内でAI実行しない。長時間RUNNINGのJobはAI Hostのトップレベル拡張ページが閉じた可能性があるため、lease期限後、attempt上限内でPENDINGへ戻せる。

## bookmarkRevisions

~~~ts
interface BookmarkRevisionRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  bookmarkRevision: number
  reason:
    | "USER_EDIT"
    | "AI_CLASSIFICATION"
    | "LABEL_MERGE"
    | "TAG_PARENT_CHANGE"
    | "TAG_DELETE"
    | "CATEGORY_CASCADE_DELETE"
    | "ARCHIVE"
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

完全なBookmarkスナップショットを無期限保存せず、非削除変更の監査に必要な分類差分だけを短期間保持する。CATEGORY／TAGの階層整合を検証し、`categoryIds` が `tagIds` に含まれる全ACTIVE Tagの親集合と完全一致する状態だけを記録する。保持件数と期間は実測後に決める。

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
  unicodeVersion: "15.1.0"
  unicodeDataAssetSha256: string
  searchSchemaVersion: number
  migrationState: "IDLE" | "RUNNING" | "FAILED"
  migrationId: string | null
  migrationCursor: {
    store: string
    lastKey: string | number | Array<string | number> | null
  } | null
  updatedAt: EpochMs
}
~~~

IndexedDBのversionとアプリ内部のschemaVersionを対応付ける。`normalizationVersion=1` は `unicodeVersion="15.1.0"` とproject-vendored data bundleの実SHA-256を必須とする。`unicodeDataAssetSha256` は実asset生成後にbuild工程で算出・固定し、読込時にbuild定数と照合する。本書やfixtureへ仮hashを置かない。不一致ならLabelの作成・改名・Import・同期を停止し、破壊的な自動再正規化を行わない。

途中失敗を検知できるよう、長いデータ変換は小さい段階に分ける。migrationCursor.lastKeyはJSON round-trip可能な文字列、有限数、またはそれらだけの配列に限定し、Date、ArrayBuffer、binary key、NaN、Infinity、undefined、入れ子配列を保存しない。対象Storeのkeyをこの型へ可逆変換できない移行は、別の明示的cursor形式をschema version付きで定義する。

## chrome.storage.localの設定

ドメインデータと混ぜず、次の設定オブジェクトだけを保存する。

~~~ts
interface LocalSettings {
  settingsSchemaVersion: number
  onboardingState: {
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
    currentStepId: string | null
    initializedBy: "INSTALL"
    updatedAt: EpochMs
  }
  aiEnabled: boolean
  aiGranularity: 0 | 1 | 2 | 3 | 4
  viewMode: "LIST" | "GRID"
  thumbnailEnabled: boolean
  contextMenuBookmarkEnabled: boolean
  frequentVisitReminderEnabled: boolean
  frequentVisitThreshold: number
  archiveAfterDays: number
  archiveHistoryAccess: "NOT_REQUESTED" | "GRANTED" | "DENIED"
}
~~~

- 不明なenum値は安全な既定値へ戻す。
- 設定の破損でBookmarkデータを初期化しない。
- `frequentVisitThreshold` と `archiveAfterDays` は数値入力から受けるが、有限の整数、安全な最小値・最大値、単位を保存前に検証する。空文字、指数表記、NaN、Infinity、範囲外を設定値へ変換しない。
- `aiGranularity` だけを0〜4のスライダー値として扱う。Job作成時にpolicyVersion 1の対応 `0→0`、`1→1`、`2→2`、`3→4`、`4→6` でmaxNewTagsを固定する。0でもAIによる既存カテゴリ／既存タグの自動割当は実行する。
- `frequentVisitReminderEnabled=false` の間は新規候補の生成と通知を行わない。端末固有表示設定は同期せず、行動履歴関連の設定を同期するかは同期Planで固定する。
- `contextMenuBookmarkEnabled` は端末固有設定としてDrive同期しない。旧settingsにfieldがない場合は既存の右クリック保存を維持するため `true` へ移行し、boolean以外の破損値は安全側の `false` として扱う。`true` はBookmation所有のpage／link menu IDを重複なく登録し、`false` はその2件を解除する。クリック処理も保存直前に現在値を再確認し、`false` なら保存しない。
- `onboardingState` は `runtime.onInstalled` の `reason="install"` でレコードがない時だけ初期化する。update、startup、Service Worker再起動で上書きせず、currentStepIdから途中再開し、完了後もCOMPLETEDを保持する。端末固有のためDrive同期しない。
- アーカイブは確定機能であり、`archiveAfterDays` の検証済み閾値に従って評価する。現行設定に別の有効化フラグを持たせない。初回開始または閾値確定時に目的説明後 `history` だけを要求し、拒否時も閾値を保持して `archiveHistoryAccess="DENIED"` とし判定を停止する。この値はUI表示と再要求導線用のcacheであり、実行前にChromeの実権限を再確認して取消も反映する。アーカイブを理由に `notifications` を要求しない。

## visitReminders

完全な閲覧履歴を複製せず、リマインダーの重複抑止に必要な最小情報だけを保存する。

~~~ts
interface VisitReminderRecord {
  schemaVersion: number
  id: Id
  normalizedUrlHash: string
  normalizedUrl: string
  visitCountAtReminder: number
  state: "PENDING" | "SAVED" | "SNOOZED" | "DISMISSED" | "SUPPRESSED"
  remindedAt: EpochMs
  nextEligibleAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

同じ正規化URLに有効な `PENDING` を複数作らない。リマインダーの「次回以降表示しない」は候補URL単位で `SUPPRESSED` にし、グローバル設定 `frequentVisitReminderEnabled` は変更しない。履歴件数がさらに増えても同じ正規化URLの候補を再生成しない。`SAVED` へ変えるのは利用者が通知または確認UIの `保存` を選び、Bookmark保存がcommitした後だけとする。

## archiveOperations

アーカイブされたBookmarkの利用者データを最小に保つため、判定・復元・同期用メタデータを分離する。

~~~ts
interface ArchiveOperationRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  state: "ARCHIVED" | "RESTORED"
  reason: "USER" | "INACTIVE"
  sourceBookmarkRevision: number
  archivedAt: EpochMs
  restoredAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
  revision: number
}
~~~

設定内一覧は `ArchivedBookmarkRecord` の最小payloadとこの操作メタデータをIDで結合する。同期Envelopeやtombstoneも操作側で扱い、利用者payloadへ訪問統計等を戻さない。

### 索引

- byBookmarkCreatedAt: bookmarkId, createdAt
- byStateArchivedAt: state, archivedAt

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
2. 返却された既存Label IDがJob開始時に提示した候補内で、有効なレコードか確認する。表示名だけで特定せず、kind、ID、revisionを確認し、TAGは候補時点の `parentCategoryId` と一致することも確認する。
3. AIが選ぶCategoryはTag候補の親を制約する入力としてだけ扱い、Bookmarkへ独立したCategory edgeとして適用しない。新規作成候補はタグだけであり、TAGの親は有効なユーザー作成カテゴリに限定する。
4. JobのClassificationPolicySnapshotを検証し、granularity / maxNewTags / policyVersionが定義済みunionと完全一致することを確認する。上限0なら新規タグ出力を拒否する。上限1／2／4／6では新規 `TAG` の件数・文字列・親カテゴリを確認し、originを問わず論理削除済みを含む `tagUniqueName` と競合しない場合だけ `creationRequestId = jobId:proposalKey` で作成する。同じrequestIdの再送は同じ作成結果を再利用する。同名の有効TAGは親・意味が適合する時だけ再利用し、不適合または論理削除済みならNEEDS_REVIEWにする。
5. `byBookmarkAndLabel` を使って既存TAG edgeを差分更新する。適用後に残るACTIVE TAGの `parentCategoryId` を重複除外し、ACTIVE CATEGORY edge集合をその親集合へ完全一致させる。親edgeの追加・復元だけでなく、同じ親の最後のTagがなくなった場合の余分な親edge削除も同じtransactionで行う。ユーザー割当を暗黙に削除せず、同じedgeの再送は更新として扱う。
6. BookmarkのclassificationStateとrevisionを更新する。
7. bookmarkRevisionsを追加する。
8. classificationJobsをSUCCEEDEDへ更新する。

上記を単一トランザクションで行う。revisionが変わっていれば自動上書きせずCONFLICTまたはNEEDS_REVIEWにする。

### タグ統合

sourceTagの関連を同じ親CategoryのtargetTagへ移し、同じ `(bookmarkId, targetTagId)` が既にあればedgeを1件へまとめ、sourceTagを論理削除する。影響BookmarkのCategory edgeは残存Tag親集合から再計算する。Category統合、カテゴリとタグの間、および異なる親カテゴリに属するタグ同士の統合は拒否する。現行スキーマでは同名の有効タグを作れないため、重複が見つかった場合は旧データまたは破損として隔離し、名称一致だけで自動統合しない。

### カテゴリ／タグの作成・編集・削除

- カテゴリ作成とタグ作成は種類ごとの正規化名一意性を同じtransactionで検証する。Tag作成commandは `name`、ACTIVEな既存 `parentCategoryId`、`expectedParentCategoryRevision`、`creationRequestId` を必須とし、親CategoryのID・kind・deletedAt・revisionを保存直前にも確認する。作成モーダルから連続作成しても各送信に別 `creationRequestId` を使い、同じ送信の再送だけを冪等化する。既存Labelを選択して「作成済み」に数える操作や、既存と同名の新規作成は提供しない。
- Tag作成・編集の親カテゴリautocompleteはACTIVE CATEGORYだけを一致度順に最大8件返す。side-viewでCategoryを新規作成する場合はTag draftを永続正本へ書かずUI stateに保持し、`CreateCategory` 成功後に返ったIDとrevisionを選択状態へ設定する。その後の `CreateTag` / `UpdateTag` は別requestとしてcommitし、Category作成失敗・取消・再送でTag draftや親選択を別Categoryへすり替えない。
- Bookmark編集commandは `bookmarkId`、期待revision、`title`、`url`、`tagIds` だけを受け、`categoryIds` はschema上拒否する。TAG候補は親カテゴリID付きで最大8件返す。保存時は全tagIdsがACTIVEであることを確認し、Tag edge差分を適用した後、そのBookmarkのCategory edgeをACTIVE Tag親集合と完全一致するよう追加・復元・論理削除する。
- Label作成・改名の名称入力でもkind別候補を最大8件まで提示できるが、候補IDの選択を作成・改名・merge commandへ暗黙変換しない。同じkindの正規化名が一致すれば一意索引で拒否する。
- Category改名では `kind` や `parentCategoryId=null` を変えず、`byCategoryUniqueName` とrevisionで重複・競合を拒否する。Tag編集は次の専用transactionでnameと `parentCategoryId` を変更できるが、`kind` は変えない。Tag名は親に依存しない `byTagUniqueName` で論理削除済みを含むTAG全体の重複を拒否する。
- Category編集queryはACTIVE子Tagの実名一覧と件数、およびその子Tagを参照するACTIVE Bookmarkのunique件数を同一snapshotから返す。削除済みTagと削除済みBookmarkは件数から除く。
- Tag削除は追加確認なしで、対象Tagと全BookmarkLabel edgeを1 transactionで論理削除する。影響ACTIVE Bookmarkごとに残ったACTIVE Tag親集合からCategory edgeを再計算し、Bookmark revision、`reason="TAG_DELETE"` のBookmarkRevision、分類由来のSearchDocumentを同じtransactionで更新する。旧PENDING／RUNNING JobはCANCELEDにし、遅延結果をJob state、Bookmark revision、TagのACTIVE状態で拒否する。Category削除だけは警告確認済みの専用連鎖削除を使い、汎用Label削除へ変換しない。いずれも削除Undoを提供しない。

### Tag名・親Category更新

~~~ts
interface UpdateTagCommand {
  tagId: Id
  expectedTagRevision: number
  name: string
  parentCategoryId: Id
  expectedParentRevision: number
  requestId: `tag-update:${string}`
}
~~~

`tag-update:` 以外のnamespaceをschemaで拒否する。最初に `tagMutationReceipts.get(requestId)` を読み、同じtagIdとrequest fingerprintならreceiptの `UpdateTagResult` をそのまま返し、異なる対象またはpayloadなら `REQUEST_ID_REUSED` とする。新規requestでは次を `labels`、`bookmarkLabels`、`bookmarks`、`bookmarkRevisions`、`searchDocuments`、`tagMutationReceipts`、P1の `syncOutbox` にまたがる1 transactionで行う。

1. 対象がACTIVE TAGでrevisionが `expectedTagRevision` と一致することを確認し、現在の親Categoryを取得する。
2. 新しい `parentCategoryId` がACTIVE CATEGORYでrevisionが `expectedParentRevision` と一致することを確認する。現在の親も物理的に存在するACTIVE CATEGORYであることを再検証する。
3. `bookmarkLabels.byLabel` から対象Tagを参照する全ACTIVE edgeとACTIVE Bookmarkを固定し、各Bookmarkの全ACTIVE Tag／Category edge、revision、deletedAtを同じtransaction snapshotで再検証する。
4. nameをNormalizer v1で再計算し、親Categoryとは無関係な `tagUniqueName` でtombstoneを含む別TAGとの衝突を拒否する。Tagのname、normalizedName、parentCategoryId、revisionを更新し、Tag SearchDocumentを新revisionで再生成する。
5. 親が変わった場合、各参照Bookmarkの全ACTIVE Tag親IDを重複除外し、ACTIVE Category edge集合を完全一致させる。旧親配下の別ACTIVE Tagがあれば旧親edgeを残し、対象Tagが最後なら旧親edgeを論理削除し、新親edgeを追加または復元する。
6. 親が変わった場合だけ各参照Bookmarkのrevisionを進め、`reason="TAG_PARENT_CHANGE"` のBookmarkRevisionと新revisionのBookmark SearchDocumentを作る。分類由来文字列をBookmark文書へ複製しない設計でも、`sourceRevision` をBookmark本体と一致させるため再生成する。
7. 更新したTag、Bookmark、edgeを同じ `operationBatchId=requestId`、`cause="TAG_UPDATE"` の同期Outboxへ追加し、共通member count／fingerprintを固定する。最後にTagMutationReceiptを作り、全件成功時だけcommitする。名称だけの更新でも同じcauseを使い、親変更の有無はbatch memberとrevision差分から判定する。

途中でTag、新旧親Category、参照Bookmark、edgeの状態またはrevisionが変わった場合は1件もcommitせず `TAG_UPDATE_CONFLICT` とする。nameまたは親が現在値と同じでも、新規requestは差分なしのreceiptを返し不要なrevisionを進めない。同じrequestの再送はreceiptへ収束する。親変更後にAI再分類Jobは作らない。変更前のTag revision／parentCategoryIdまたはBookmark revisionを前提にしたPENDING／RUNNING AI結果は適用時検証で拒否し、親を自動的に巻き戻さない。

### Category連鎖削除と再分類

`DeleteCategoryCascade` は次のcommandだけを受ける。

~~~ts
interface DeleteCategoryCascadeCommand {
  categoryId: Id
  expectedCategoryRevision: number
  expectedImpactFingerprint: string
  requestId: `category-delete:${string}`
  warningAcknowledged: true
}
~~~

`warningAcknowledged` がtrueでないrequest、空または形式不正な `expectedImpactFingerprint`、`category-delete:` 以外のrequestId、AI出力、名称だけの指定は拒否する。use case別namespaceによりTag更新の `tag-update:` requestIdやbatch IDとの衝突を防ぐ。実行時は `labels.byParentCategory` から対象Categoryを親とする物理的に存在する全TAGを取得し、ACTIVE／削除済みを含む対象ID集合と、対象Labelを参照する全edge、影響するACTIVE Bookmark集合を固定する。次を `labels`、`bookmarkLabels`、`bookmarks`、`classificationJobs`、`bookmarkRevisions`、`searchDocuments`、P1の `syncOutbox` にまたがる1 transactionで行う。

1. まず `byCascadeDeleteRequestId` でrequestIdの既存利用を確認する。同じCategoryの `cascadeDeleteRequestId` が同じ完了済みrequestなら、ACTIVE状態、期待revision、fingerprintを再検証する前に `alreadyCompleted=true` の冪等成功を返し、追加変更やJob作成を行わない。別CategoryのCategory／子Tagに同じrequestIdがあれば `REQUEST_ID_REUSED` として拒否する。対象Categoryが別requestIdで削除済みなら再削除しない。未完了requestだけCategoryのID・期待revision・ACTIVE状態を検証し、同じtransaction内で現在の影響集合をpreviewと同じcanonical規則で再計算する。`expectedImpactFingerprint` と一致しなければ `CATEGORY_DELETE_PREVIEW_STALE` で1件も変更せず、最新detailによる再警告を要求する。
2. 対象Categoryと全子TAGを同じ削除時刻のtombstoneにする。ACTIVE recordだけrevisionを進め、既に削除済みの子TAGは名前予約と元の削除情報を保つ冪等no-opにする。
3. Categoryまたは子TAGを参照するACTIVE edgeを論理削除し、既存tombstone edgeの再削除はno-opにする。名称一致だけの別Labelや別edgeを対象へ加えない。
4. 影響ACTIVE Bookmarkごとに残ったACTIVE Tag edgeを読み、その親集合へCategory edgeを完全一致させる。Bookmark本体は保持し、revisionを進め、`classificationState="PENDING"` とし、`reason="CATEGORY_CASCADE_DELETE"` のBookmarkRevisionを追加する。
5. 影響Bookmarkの既存PENDING／RUNNING JobをCANCELEDにしてleaseを無効化し、`reason="CATEGORY_CASCADE_DELETE"`、`triggerOperationId=requestId`、Bookmark別の安定 `requestId` を持つPENDING Jobを1件ずつ作る。同一削除requestの再送でJobを増やさない。
6. Category／子TAGのSearchDocumentを無効化し、影響BookmarkのSearchDocumentを新revisionと残存Tag／親Categoryだけから再生成する。Category削除前の分類名を検索へ残さない。
7. 同期対象では同じrequestIdをoperation batch IDとするOutboxを作る。全更新とJob／Outbox作成が成功した時だけcommitし、期待revision不一致、quota、schema不正など1件でも失敗すれば全件rollbackする。

削除後の再分類は通常のAI Hostで処理し、AIをtransaction内やService Workerから呼ばない。AI不可・失敗・候補不足ではBookmarkを削除せず `classificationState="NEEDS_REVIEW"`、JobをNEEDS_REVIEWにして手動Tag編集を許す。削除前にRUNNINGだったJobの結果はJob state、Bookmark revision、候補LabelのACTIVE状態を再検証して拒否する。子TAG tombstoneは名称を予約したまま同期保持・edge参照・conflict参照が解消してから先に物理GCし、Category tombstoneは物理的な子TAG recordが0件になった後だけ回収する。

### Bookmark削除

`DeleteBookmark` は対象のACTIVE Bookmarkとその全BookmarkLabel edgeのrevisionを進め、`deletedAt` を設定する。同じtransactionで対応するSearchDocumentを削除または無効化し、削除済みBookmarkを通常検索から除外する。1件でも更新できない場合は全件をrollbackし、成功時はUndo tokenを作らず影響件数だけを返す。pending／running分類Jobの結果適用時はBookmarkの `deletedAt` とrevisionを再検証し、削除済みまたはrevision不一致なら正本変更を拒否する。

Bookmarkのfavicon／thumbnail IDはtombstoneに保持する。Blob回収は有効Bookmarkだけでなく未回収tombstoneの参照も数え、同期tombstone保持期間が満了し、全参照とOPEN／CANCELED syncConflictがなく物理回収可能になる前に参照Blobを削除しない。

### 訪問判定とアーカイブ

履歴照会はDB transaction外で行い、検証済みの `visitCount` / `lastVisitedAt` だけを短いtransactionで更新する。アーカイブ判定時はBookmarkのrevisionを再確認し、設定期間を超えた `ACTIVE` だけを `ArchivedBookmarkRecord` へ置換する。置換前に有効edgeからカテゴリ／タグのID・表示名・親カテゴリIDを固定し、ページ名とURLを加えた最小スナップショットだけを残す。`lastVisitedAt=null`、既にARCHIVED、更新競合の項目は自動変更しない。Bookmark置換、関連edgeの論理削除、BookmarkRevision、archiveOperations、同期Outboxを同じtransactionへ含める。理由・時刻・revision等は利用者payloadではなくarchiveOperationsへ書く。

設定内のアーカイブ一覧から復元する時は、URLを再検証・再正規化し、スナップショットのTag IDが現在も有効なら再利用する。削除済み／競合Labelは利用不可と表示してedgeの再有効化から除外し、別の有効Tagを利用者が選ぶ場合も名称だけで自動接続しない。削除済みLabel自体は復元しない。復元したActive recordではfavicon、thumbnail、訪問統計を `null` から再構築し、有効なTAG edgeだけを再有効化して、そのACTIVE Tag親集合からCATEGORY edgeを導出し、archiveOperationsをRESTOREDへ更新する。

## 検索用データ

通常検索はフルページの検索画面で扱い、どの画面から遷移しても1つの入力からカテゴリ／タグ候補とBookmark候補を同時に返す。入力中のキーワード候補はGoogle検索型のautocompleteとして一致度の高い順に最大8件を返す。一方、AI自然言語検索の最終候補集合は複数件を許すが、順位とスコアを契約に含めない。検索語、AIが展開した語、AI入力ポップアップ内の会話と自由文の理由は既定で永続化しない。

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

interface AutocompleteCandidate {
  entityType: "LABEL" | "BOOKMARK"
  entityId: Id
  entityRevision: number
  labelKind: "CATEGORY" | "TAG" | null
  parentCategoryId: Id | null
  displayText: string
  matchedFields: string[]
}

interface UnifiedSearchResult {
  schemaVersion: number
  queryId: Id
  labels: SearchCandidate[]
  bookmarks: SearchCandidate[]
  source: "KEYWORD" | "AI" | "LEXICAL_FALLBACK"
}

interface AiAssistantResponse {
  schemaVersion: number
  requestId: Id
  intent: "SEARCH_LIBRARY" | "PRODUCT_HELP" | "OUT_OF_SCOPE"
  answerText: string
  searchResult: UnifiedSearchResult | null
  capabilityCatalogVersion: number
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
- Bookmark検索文書はACTIVEだけを対象にし、アーカイブtransactionで該当文書を削除する。Tag親変更では影響Bookmarkのrevisionに合わせて文書を再生成し、Category連鎖削除では影響Bookmarkの文書を残存するACTIVE Tagとその親Categoryだけから新revisionで再生成する。ARCHIVEDは設定内アーカイブ一覧からだけ検索・復元する。
- Label文書はname、normalizedName、kind、origin、TAGのparentCategoryIdから生成する。TAG候補では所属を確認できるよう親カテゴリ名を添える。
- カテゴリ／タグ名に一致したBookmark候補は、Label文書で得た `labelId` から `bookmarkLabels.byLabel` をたどって生成する。Bookmark文書へ名称を複製しないため、Label改名時に全Bookmark文書を再構築する必要がない。
- `sourceRevision` が正データと異なる文書は検索前または保守処理で再構築する。派生文書の欠損・破損を理由に正データを削除しない。
- 日本語の部分一致、分かち書き、表記揺れ、ngram長は検索スキーマのバージョンを付けて変更できるようにする。

### 入力中のautocomplete

- 検索画面の共通検索ボックスはカテゴリ、タグ、Bookmarkを対象にし、前方一致、完全一致、部分一致等の決定的規則で候補を並べ、最大8件で打ち切る。
- ブックマーク編集のタグ欄はTAGだけ、Tag作成・編集の親カテゴリ欄はACTIVE CATEGORYだけを最大8件返す。Category候補はID、name、revisionを持ち、nested side-viewの `CreateCategory` 成功結果も同じ選択型へ変換する。TAG候補には親カテゴリを必ず含める。Bookmark編集に独立したカテゴリ入力欄は設けない。
- autocompleteはAIを待たず字句索引だけで応答し、スコア自体はUIや永続データへ公開しない。選択後は表示名ではなくIDとrevisionを送る。

### 自然言語検索の候補と検証

1. AI Hostは自然言語を固定スキーマの検索語・意図へ変換する。AIが使えない場合は入力文字列をそのまま正規化する。
2. Service Worker側で語数、文字数、対象種別を検証し、`searchDocuments` と `bookmarkLabels` から上限付き候補集合を作る。
3. AI Hostは提示済み候補から可能性が高いID集合だけを選ぶ。AIへは候補IDと最小限の表示情報だけを渡す。
4. Service Worker側でID、種別、revision、重複、件数上限を再検証する。AIが返した順序は捨てる。
5. Label / Bookmarkごとの決定的な中立順で返す。候補が複数でも1件へ暗黙確定せず、名称一致後も種類、ID、revision、TAG親を検証する。

自然言語検索はAI入力ポップアップが開いている間の対話操作であり、入力とレスポンスを同じポップアップ内に表示する。AIアシスタントは検索に加え、アプリに同梱した版付きCapability Catalogを根拠としてBookmationの機能全般・使い方を説明できる。任意の外部知識検索、Chrome API操作、設定変更、削除、共有は回答生成から実行しない。

分類Jobのような永続 `searchJobs` / `conversation` StoreはMVPでは設けない。ポップアップまたはトップレベル拡張ページを閉じた場合は会話を破棄して安全に中断し、Bookmark保存や分類Jobへ影響させない。`SEARCH_LIBRARY` はsearchResult、`PRODUCT_HELP` はCapability Catalogに基づくanswerText、`OUT_OF_SCOPE` は対応範囲外の固定案内を返す。回答文中のIDやURLを実行指示として扱わない。

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
2. 旧平坦 `labels` を読める新旧両対応Readerを先に導入し、`parentCategoryId` と親索引を追加した新documentへ移す。Label名をproject-vendored Unicode 15.1.0 dataのv1で再正規化し、`nameNormalizationVersion=1`、`unicodeVersion="15.1.0"`、実assetから生成したSHA-256を記録する。`byCategoryUniqueName`、`byTagUniqueName`、一意な `byCreationRequestId` を作る前に、論理削除済みも含めた重複と禁止文字を検出する。
3. 旧カテゴリは `parentCategoryId=null` とする。同名カテゴリが複数ある場合は自動削除せず競合一覧を作り、利用者が正本を選ぶまで `NEEDS_REVIEW` とする。
4. 旧TAGには親が存在しないため、既存Bookmarkとの共起、旧データの由来、利用者選択から親カテゴリを1件決める。確定できないTAGは自動で架空カテゴリへ寄せず、隔離して `NEEDS_REVIEW` とする。同じnormalizedNameの旧TAGが複数ある場合も自動削除・統合せず、改名または正本選択まで隔離する。
5. BookmarkLabelは `Label.kind` で再判定し、Bookmarkごとに有効TAG edgeの親集合を求め、ACTIVE CATEGORY edgeをその集合へ完全一致するよう追加・復元・論理削除する。同じ `(bookmarkId, labelId)` が複数あれば最新の有効状態と監査情報を残して1件にまとめ、その後 `byBookmarkAndLabel` unique索引を作る。
6. 各Labelへ安定した `creationRequestId` を割り当てる。移行値は既存IDから `migration:<labelId>` のように決定的に生成し、再実行で変えない。空の `tagMutationReceipts` Storeを追加し、過去のTag編集requestIdを推測してreceiptを捏造しない。
7. 旧 `aiGranularity=1..5` は意味対応表を固定して0〜4へ変換する。単純な `value-1` とするかは旧段階の意味を確認してから決め、未確認値は安全に新規AIタグ作成なしへ倒す。
8. 旧ARCHIVED Bookmarkは `metadata` と `payload { title, url, categories, tags }` を構造上分けた最小スナップショットへ変換し、favicon、thumbnail、訪問統計等をpayloadへ残さない。理由・時刻・revision等はarchiveOperationsへ分離し、復元テストが通るまで旧値を回収しない。
9. `searchDocuments` を親カテゴリ情報付きでバッチ再構築し、`migrationCursor` に完了位置を保存する。lastKeyはJSON round-trip可能な文字列、有限数、またはそれらだけの一次元配列へ限定し、表現できないkeyには別のversion付きcursor形式を定義する。
10. 件数、参照整合、カテゴリ作成元、全TAGの親CATEGORY record存在、ACTIVE TAGのACTIVE親、BookmarkのACTIVE CATEGORY edgeとACTIVE Tag親集合の完全一致、edge一意性を確認してから新Readerへ切り替える。旧平坦フィールドは少なくとも1リリースの復旧期間後に別バージョンで削除する。

変換は冪等にし、Object Store・索引変更と大量レコード変換を分ける。失敗時はUIに状態と復旧方法を示し、旧バージョン、空DB、カテゴリ名競合、タグ名競合、親不明タグ、複数カテゴリ／タグ、最大想定件数、途中中断でテストする。

未実装のため、マイグレーション成功を保証するものではない。

## QR共有payload

設定の共有画面では検索とチェックボックスで、カテゴリ単位、タグ単位、個別Bookmarkを選択する。選択条件そのものではなく、生成操作開始時に固定したBookmark ID集合をpayloadへ展開する。

~~~ts
interface QrSharePayload {
  format: "BOOKMATION_QR"
  version: number
  payloadId: Id
  createdAt: EpochMs
  bookmarks: Array<{
    title: string
    url: string
    categories: Array<{ name: string }>
    tags: Array<{ name: string; parentCategoryName: string }>
  }>
  checksum: string
}
~~~

カテゴリ選択はそのカテゴリに関連するBookmark、タグ選択はそのタグに関連するBookmark、個別選択はそのBookmarkを集合へ加え、IDで重複排除する。QRにはローカルID、訪問履歴、サムネイル、AI会話、OAuth情報を含めない。checksumは搬送中の破損・欠落・切詰め検出だけに使い、送信者の真正性、改ざん耐性、認証を保証する値として表示しない。

読み取りImportはpayload全体を検証してpreviewを作り、カテゴリ／タグのkind別名称一意性、タグ親、URL重複を利用者が確認した後だけ通常のImport transactionへ渡す。Bookmarkへの分類関連はImportされた有効TAGだけを適用し、CATEGORY edgeはその親集合から導出する。payload内のCategoryはTag親の定義または共有選択情報として扱い、Bookmarkへ単独edgeを作らない。payload内部でv1正規化後に同名となるTAGが複数の `parentCategoryName` を持つ場合はpreview前に構造不正として拒否し、暗黙renameや親選択を行わない。Import Tagと同名の既存Tagが別parentCategoryIdを持つ場合も、既存Tagの自動reuse、rename、parent移動を行わない。利用者はその項目をskip、Import全体をcancel、または競合Tagへ別名を明示入力する。別名入力後はv1正規化と一意性を再検証し、新しいImport plan fingerprintと全件previewを再生成してからcommitする。

## Google Drive同期の競合設計

同一ユーザーの複数端末を、設定で明示選択したGoogleアカウントのDriveで同期するP1確定設計である。`syncOutbox`、`syncSnapshots`、`syncConflicts`、`syncState` はP1実装時に作成し、OAuth未接続でもローカル正本を利用できる。通常の同一アカウント同期は `appDataFolder` を使う。appDataFolder内の項目は共有できないため、別アカウント間で所有権／権限のあるデータセットを選ぶ要件は、通常Drive file、別接続mode、file capabilityとowner／permission検証を使う。両経路を同じfile IDやscopeとして扱わない。

~~~ts
interface SyncStateRecord {
  key: "google-drive"
  schemaVersion: number
  deviceId: Id
  selectedAccountSubjectHash: string | null
  datasetFileId: string | null
  datasetOwnerSubjectHash: string | null
  connectionMode: "APP_DATA_SAME_ACCOUNT" | "OWNED_DATASET" | null
  state: "DISCONNECTED" | "CONNECTED" | "REAUTH_REQUIRED" | "ERROR"
  lastSyncCursor: string | null
  lastSyncedAt: EpochMs | null
  updatedAt: EpochMs
}
~~~

OAuth tokenはこのレコードへ保存しない。アカウント表示名やメールアドレスを永続化する場合は目的を追加で定義し、既定ではOAuth subjectの不可逆な識別値だけを保存する。接続先を切り替える時は未送信Outboxと対象データセットを確認し、別アカウントへ無言でpushしない。

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

### syncSnapshots

競合の再現と利用者previewに必要なbase／local／remoteを、検証済み・immutableなJSON snapshotとして保存する。

~~~ts
interface SyncSnapshotRecord {
  schemaVersion: number
  id: Id
  datasetIdentityHash: string
  entityType: string
  entityId: Id
  revision: number
  updatedAt: EpochMs
  deletedAt: EpochMs | null
  canonicalJsonVersion: 1
  contentHash: string
  document: JsonValue
  capturedAt: EpochMs
}
~~~

snapshotは生成前にentity別schemaとJSON上限を検証し、canonical JSONのcontentHashを計算する。保存後に上書きせず、同じIDで内容が変われば破損として隔離する。OAuth token、Blob、AI会話、検索履歴を含めない。

索引は `byEntityRevision: [entityType, entityId, revision]`、`byContentHash: contentHash`、`byCapturedAt: capturedAt` を非uniqueで持つ。同じrevisionでも内容が異なる競合を保存できるよう、entity／revisionだけをuniqueにしない。

### syncConflicts

~~~ts
interface SyncVersionReference {
  snapshotId: Id
  entityType: string
  entityId: Id
  revision: number
  operationId: Id | null
  contentHash: string
  deleted: boolean
}

type SyncResolutionOperation =
  | {
      kind: "APPLY_SNAPSHOT"
      snapshotId: Id
      targetEntityType: string
      targetEntityId: Id
      expectedTargetRevision: number | null
    }
  | {
      kind: "RENAME_LABEL"
      labelId: Id
      expectedLabelRevision: number
      newName: string
    }
  | {
      kind: "REASSIGN_BOOKMARK_LABEL"
      bookmarkId: Id
      fromLabelId: Id
      toLabelId: Id
      expectedFromEdgeRevision: number
      expectedToEdgeRevision: number | null
    }
  | {
      kind: "APPLY_TOMBSTONE"
      targetEntityType: string
      targetEntityId: Id
      expectedTargetRevision: number
    }

interface SyncConflictRecord {
  schemaVersion: number
  id: Id
  entityType: string
  entityId: Id
  reason:
    | "SCALAR_DIVERGED"
    | "EDGE_ADD_DELETE"
    | "UPDATE_DELETE"
    | "CATEGORY_NAME_CONFLICT"
    | "TAG_NAME_CONFLICT"
    | "TAG_PARENT_INVALID"
    | "TAG_PARENT_DIVERGED"
    | "CATEGORY_CASCADE_DIVERGED"
    | "SCHEMA_UNSUPPORTED"
  base: SyncVersionReference | null
  local: SyncVersionReference
  remote: SyncVersionReference
  status: "OPEN" | "RESOLVED" | "CANCELED"
  revision: number
  resolution: null | {
    expectedConflictRevision: number
    expectedBase: { snapshotId: Id; revision: number; contentHash: string } | null
    expectedLocal: { snapshotId: Id; revision: number; contentHash: string }
    expectedRemote: { snapshotId: Id; revision: number; contentHash: string }
    operations: [SyncResolutionOperation, ...SyncResolutionOperation[]]
    committedOperationIds: Id[]
  }
  createdAt: EpochMs
  updatedAt: EpochMs
  resolvedAt: EpochMs | null
  snapshotRetainUntil: EpochMs | null
}
~~~

各SyncVersionReferenceは実在する `syncSnapshots` recordを指し、entity、revision、contentHashが一致しなければ競合を表示・解決しない。解決要求はconflict revisionとbase／local／remoteのsnapshot ID・revision・hashをすべて照合し、allowlist済みの明示operationsだけを実行する。`RENAME_LABEL` はNormalizer v1で再計算し、`REASSIGN_BOOKMARK_LABEL` は利用者が選んだ既存TAG ID間のedge差替えだけを行い、CATEGORY edgeの直接差替えは拒否してTag差分後に親集合から再計算する。同名／異親TAGを名称だけで同一視し、負けたIDを勝ったIDへ暗黙remapしてはならない。

全operationへLabel名一意性、TAG親の存在・状態、BookmarkLabel edge、delete marker、期待revisionを再適用した後だけ、ローカル正本、Outbox、conflict resolution／statusを1 transactionでcommitする。TagのparentCategoryIdを採用する解決は、対象Tagを参照する全ACTIVE BookmarkのCategory edge、revision、BookmarkRevision、SearchDocumentも同じtransactionで再計算し、AI再分類Jobは作らない。不一致なら1件も適用せずOPENのまま再読込する。RESOLVED commit時に `resolvedAt` と `snapshotRetainUntil = resolvedAt + 30日` を保存する。

OPEN conflictが参照するbase／local／remote snapshotはGC禁止とする。RESOLVED後も最低30日保持し、保持期限を過ぎ、他のOPEN conflict、Outbox、復旧処理から参照されず、hash検証が完了したsnapshotだけを回収できる。CANCELEDは未解決として参照snapshotを保持し、別の明示的な破棄方針なしにGCしない。

### マージ規則

| 競合 | 自動処理案 | 人の確認 |
| --- | --- | --- |
| 別フィールドの編集 | 両方を統合 | 不要 |
| 同じスカラーの編集 | `SCALAR_DIVERGED` としてsyncConflictsへ | 必須 |
| BookmarkLabelのTAG追加同士 | TAG edgeを集合和にしてCategory edgeを親集合へ一致 | 不要 |
| 同じedgeの追加と削除 | `EDGE_ADD_DELETE` としてsyncConflictsへ | 必須 |
| レコード更新と削除 | `UPDATE_DELETE` としてsyncConflictsへ | 必須 |
| Category連鎖削除batchと子Tag／関連Bookmarkの同時更新 | `CATEGORY_CASCADE_DIVERGED` としてbatch全体をsyncConflictsへ | 必須 |
| 同名カテゴリの同時作成 | unique keyを予約したまま `CATEGORY_NAME_CONFLICT` | 必須 |
| 同名タグの同時作成 | unique keyを予約したまま `TAG_NAME_CONFLICT` | 必須 |
| 同じTagの親Categoryを異なる親へ同時変更 | `TAG_PARENT_DIVERGED` としてsyncConflictsへ | 必須 |
| 同じBookmarkLabel edgeの同時追加 | `(bookmarkId, labelId)` で1件へ収束 | 不要 |
| TAGの親とBookmarkのCATEGORY edge | ACTIVE Tag親集合を正とし、CATEGORY edgeを追加・解除して完全一致 | 親削除・親不明なら必要 |
| スキーマ不明 | 適用せず隔離 | 必要 |

同じscalar、Tag親、edge add/delete、update/delete、一意名競合へupdatedAt/deviceIdによるLWWを適用しない。同じTagの異なる親変更は `TAG_PARENT_DIVERGED` とし、人が採用する親を選んだ後に全参照BookmarkのCategory closureを再計算する。負けたCategory／Tag IDのBookmarkLabelを勝ったIDへ暗黙付替えず、syncConflictsで明示解決する。Category連鎖削除は同じoperationBatchIdのCategory・全子Tag・edge・Bookmark再計算を1単位として検証し、欠落batchや同時更新があれば一部だけ適用せず `CATEGORY_CASCADE_DIVERGED` にする。別フィールドの自動統合も、統合後の名前一意性・TAG親・Bookmark Category closureを再検証できた場合だけcommitする。

### tombstone

- 削除を一定期間tombstoneとして同期する。
- 全既知端末が削除を確認した後、または十分な保持期間後に回収する。
- 長期間オフライン端末による復活を防ぐ。
- tombstone回収前にエクスポートと復旧方針を決める。
- CATEGORY tombstoneはACTIVE／削除済みを問わず子TAG recordが1件でもあれば物理回収しない。
- Category連鎖削除では子TAG tombstoneを先に回収し、最後の物理子TAGがなくなってからCategory tombstoneを回収する。offline端末や未解決batchから子TagまたはCategoryだけを復活させない。
- OPEN／CANCELED syncConflictが参照するsnapshotとtombstoneは回収しない。RESOLVED conflictのsnapshotは解決後30日と他参照の消滅を両方満たしてから回収する。

### syncOutbox

~~~ts
interface SyncOperationRecord {
  schemaVersion: number
  id: Id
  operationBatchId: Id
  operationBatchMemberCount: number
  operationBatchFingerprint: string
  entityType: string
  entityId: Id
  operation: "UPSERT" | "DELETE"
  cause: "NORMAL_WRITE" | "TAG_UPDATE" | "CATEGORY_CASCADE_DELETE"
  baseRevision: number
  localRevision: number
  deviceId: Id
  createdAt: EpochMs
  updatedAt: EpochMs
  attempts: number
  lastErrorCode: string | null
}
~~~

ローカル更新とOutbox追加を同一トランザクションで行う。通常writeは単独batch ID、Tag親更新とCategory連鎖削除はそれぞれのrequestIdを全関連operationの `operationBatchId` に使う。全memberは共通の件数と、`entityType`、`entityId`、operation、base／local revisionをcanonical順に並べて得たfingerprintを持つ。既存tombstoneを再主張するDELETEもmemberへ含める。Drive障害時もOutboxを失わず、再送を冪等にする。受信側は複数record batchの全record、件数、fingerprint、期待revisionが揃うまで正本へ適用せず、Tag親やCategory closureの部分更新、またはCategoryや子Tagの単独削除として扱わない。

## スキーマ受入条件

- Blobを除く全正本documentがJSON stringify/parseで情報を失わずround-tripし、read/write時にschemaVersionとruntime schemaを検証する。
- 不明schemaVersion、非JSON値、過大documentを正本へ適用せず、Blob本体をQR／Drive JSONへ暗黙に含めない。
- 全TAGが物理的に存在するCATEGORYの `parentCategoryId` を1件だけ持ち、ACTIVE TAGの親はACTIVE、削除済みTAGの親はACTIVEまたは削除済みであり、CATEGORYのparentCategoryIdはnullである。
- 同一Bookmarkに複数のタグを割り当てられ、ACTIVE CATEGORY edge集合がACTIVE TAG edgeの親集合と完全一致する。Bookmark更新入力にcategoryIdsがなく、Tag追加で親edgeが増え、同じ親の最後のTag解除で親edgeも外れる。
- Label名正規化v1がproject-vendored Unicode 15.1.0 dataだけでNFKC、`White_Space` collapse、残存 `Cc` / `Cs` / `Default_Ignorable_Code_Point` 拒否、`CaseFolding.txt` status C+F full mapping、最終再検証を実行し、作成、改名、Import、同期で同じfixture結果になる。runtime ICU／localeを変えても結果が変わらず、検索token正規化の変更でも一意性判定が変わらない。
- schemaMetaの `unicodeVersion="15.1.0"` と `unicodeDataAssetSha256` がbuildへvendorした実assetと一致する。hashは実装時に実assetから生成・固定し、仮値や文書上の偽hashを受け入れない。asset改変・hash不一致時はLabel writeを停止する。
- 同じnormalizedNameのカテゴリは論理削除状態を問わずCATEGORY内で1件だけ、同じnormalizedNameのタグは論理削除状態と親カテゴリを問わずTAG内で1件だけである。CategoryとTag相互の同名は禁止しない。tombstoneの物理回収前は同名別IDを作れず、別名だけを選べる。
- 同じ `(bookmarkId, labelId)` edgeは再送や同期後も1件だけである。
- Tag作成・編集は既存ACTIVE Categoryの選択を必須とし、親候補は最大8件である。side-viewのCategory作成後もTag draftを保持して新Categoryを選択できる。UpdateTagはexpectedTagRevision、expectedParentRevision、submit開始時に1回発行する `tag-update:` requestIdを検証し、Tag名と親Categoryを原子的に変更できる。
- Tag親変更はTag、新旧親Category、全参照ACTIVE Bookmark・edgeを単一transactionで再検証する。各BookmarkのCategory edgeを全ACTIVE Tag親集合へ完全一致させ、Bookmark revision、`TAG_PARENT_CHANGE` のBookmarkRevision、SearchDocument、`TAG_UPDATE` Outboxを更新し、AI再分類Jobを作らない。Tag名の一意性は親Categoryに依存しない。
- 同じUpdateTag requestId・fingerprintの再送はTagMutationReceiptに保存した同じ `UpdateTagResult` へ収束し、別対象／別payloadでの再利用を拒否する。`tag-update:` とCategory連鎖削除の `category-delete:` namespaceを相互に受理しない。Tag／親／Bookmark／edgeの競合または途中失敗ではTag、edge、Bookmark、検索文書、Outbox、receiptのいずれも部分commitしない。
- AI経路からカテゴリを新規作成・改名・削除できず、タグ新規作成はグローバルなタグ名一意性、親カテゴリ、`creationRequestId` の冪等性を満たす。policyVersion 1は `0→0 / 1→1 / 2→2 / 3→4 / 4→6` のdiscriminated union以外を拒否し、細分化0でも既存Labelの自動割当は継続する。同名TAGはoriginを問わず再評価し、USER候補を優先する一方、親・意味不適合はNEEDS_REVIEWにする。
- autocompleteは種類・親情報付き候補を一致度順に最大8件だけ返す。1つの自然言語検索はLabel / Bookmarkの無順位候補集合を返し、AIが候補外ID、重複ID、古いrevisionを混入させても拒否する。
- favicon BlobはfaviconBlobIdから参照でき、参照中のBlobを回収しない。外部favicon URLを一覧表示のたびに自動読込しない。
- AI失敗時もBookmarkが残る。
- AI Hostを途中で閉じ、次の対応ページでJobを再開しても重複タグを作らない。
- Service WorkerからLanguageModelを実行せず、PENDING JobはAI Hostが開くまで保持される。
- URL hash衝突でも異なるURLを誤って同一扱いしない。
- 設定破損でIndexedDBを初期化しない。onboardingStateはinstall時だけ初期化され、途中stepと完了状態をupdate／startup／Service Worker再起動後も保持する。
- `archiveState` が文字列 `ACTIVE` / `ARCHIVED` で保存され、ARCHIVEDはmetadataと `payload { title, url, categories, tags }` が分離され、設定から復元できる。自動アーカイブは最終訪問日時がない項目を変更しない。archive専用toggleを持たず、history拒否時もarchiveAfterDaysを保持して判定を権限待ち停止し、notificationsを要求しない。
- 同じURLの訪問リマインダーを重複生成せず、利用者が保存を選ぶまでBookmarkを作らない。「次回以降表示しない」にしたURLはグローバル設定を変えず再候補化しない。
- Bookmark／Tag削除は確認画面なし、Category削除は影響件数を示す警告確認済みrequestだけで対象IDと期待revisionを検証する。1件でも失敗したら全件をrollbackし、Undo tokenや利用者向け復元導線は作らない。削除済みLabelのunique keyは物理GCまで名称を予約し、その間は同名別IDを拒否して別名だけを許可する。Bookmark削除でSearchDocumentを同時に除外し、参照Blobは同期tombstone保持と参照解消が済むまで回収しない。
- Category連鎖削除requestIdは1つのCategoryだけに結び付ける。同じCategoryの完了済みrequest再送はACTIVE／revision／fingerprint検証より先にno-op成功へ収束し、別Categoryでの再利用を拒否する。新規requestでは警告snapshotの `impactFingerprint` をtransaction内で再計算し、不一致なら再警告して無変更とする。一致時だけCategory、ACTIVE／削除済み全子TAG、関連edgeを冪等にtombstone化し、影響ACTIVE Bookmarkを保持する。残存TagからCategory closureと検索文書を再計算し、Bookmark revisionを進め、旧RUNNING結果を拒否し、削除request起点のPENDING再分類JobをBookmarkごとに1件だけ作る。AI失敗時はNEEDS_REVIEWと手動Tag編集へ移り、子TAG tombstoneを先に、Category tombstoneを最後に物理GCする。
- QRは検索・チェック選択を固定集合へ展開し、checksumを真正性保証に使わない。読取Importで破損、過大、カテゴリ／タグ名競合、親不明タグを適用前に拒否または確認へ送り、payload内部の同名TAG・複数親はpreview前に拒否する。既存の別親同名TAGは自動reuse／rename／moveせず、skip／cancelまたは明示別名後の全件再previewだけを許す。
- 標準Bookmarkインポートは元データを書き換えず、中断・再送後も重複を抑止する。
- タグ統合と大量edge更新が途中失敗時に部分適用されない。
- Drive同期で同じscalar、同じTagの異なる親変更、同じedgeのadd/delete、update/delete、一意名競合をLWWせず、検証済みimmutable syncSnapshotsとsyncConflictsへ保存する。Tag親競合は `TAG_PARENT_DIVERGED` とし、採用する親を明示した後に全参照Bookmarkのclosureを原子的に再計算する。Category連鎖削除は同じoperationBatchIdの全変更を一括適用し、欠落または子Tag／関連Bookmarkの同時更新は `CATEGORY_CASCADE_DIVERGED` として部分適用しない。解決は期待conflict／snapshot revision・hashと非空の明示operation listを照合し、全不変条件再検証後だけatomic commitする。同名／異親TAGや競合したLabel IDを暗黙remapしない。OPEN／CANCELED conflictのsnapshotはGCされず、RESOLVED後も30日以上かつ全参照消滅まで保持される。削除、同時名称変更、オフライン復帰も再現できる。

すべて実装後に検証する項目であり、現時点では未確認である。
