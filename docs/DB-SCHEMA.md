# DBスキーマ

## 文書の位置づけ

- 状態: **提案・未実装・マイグレーション未検証**
- 保存先: ドメインデータとAI分類用のversion付き設定snapshotはIndexedDB、一般設定とAI設定のUI mirrorはchrome.storage.local、同一ユーザー同期は明示接続したGoogle Drive appDataFolder
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
- P1確定要件: 訪問日数リマインダー・最終訪問日時、文字列のアーカイブ状態、インポート、QR／CSV共有、Drive同期を本スキーマで扱う。

## 関係

| エンティティA | エンティティB | 多重度 | 規則 |
| --- | --- | --- | --- |
| Category Label | Tag Label | 1対多 | TagのparentCategoryIdで関連付ける。Tagは親を1件だけ持つ |
| Bookmark | Label | 多対多 | BookmarkLabelで関連付ける。同じ組は1件だけ |
| Bookmark | ClassificationJob | 1対多 | 再分類履歴をジョブ単位で残す |
| Bookmark | BookmarkRevision | 1対多 | AI・ユーザーによる非削除変更の監査 |
| Bookmark / Label | SearchDocument | 1対0または1 | 再生成可能な検索用派生データ |

カテゴリとタグはどちらも0件以上であり、1件のBookmarkは複数Tagを通じて複数Categoryに所属できる。BookmarkのACTIVE Category edge集合は、ACTIVE Tag edgeが参照するTagの `parentCategoryId` の重複なし集合と常に完全一致させる。Gemini Nanoが1回のAI分類で選ぶCategoryは厳密に1件だが、これはその試行のAI Tag候補の親を制約する規則である。既存の手動Tagは保持するため、適用後のBookmark全体が複数Categoryを持つこととは矛盾しない。

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
type BookmarkClassificationState =
  | "UNCLASSIFIED"
  | "PENDING"
  | "CLASSIFIED"
  | "NEEDS_REVIEW"
  | "FAILED"
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
| classificationSettings | key | 必須 | AI分類Jobと同一transactionで読む設定正本 |
| bookmarkRevisions | id | 推奨 | 非削除変更の監査履歴 |
| searchDocuments | id | 必須 | BookmarkとCategory／Tagの再生成可能な検索用データ |
| blobs | id | 条件付き | サムネイル等のBlobとメタ情報 |
| schemaMeta | key | 必須 | DBバージョン、移行状態 |
| visitReminders | id | P1必須 | 訪問日数閾値到達後の通知、URL別reset、再通知抑止 |
| archiveOperations | id | P1必須 | アーカイブ理由・時刻・復元状態。最小payloadと分離 |
| archiveEvaluationIssues | id | P1必須 | 履歴なし等、archiveしなかった項目の利用者向け状態 |
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
  classificationState: BookmarkClassificationState
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

`ARCHIVED` は保存制御用のトップレベルID／状態と `metadata`、利用者データの `payload` を構造上分離する。payloadにはカテゴリ、タグ、ページ名、URLだけを残す。アーカイブ理由、時刻、revision、同期状態は別の `archiveOperations` に分離する。アーカイブ時に `siteName`、favicon／thumbnail参照、訪問統計、最終訪問日時、分類状態、取得元をpayloadへ複製しない。

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

`lastVisitedAt` は、利用者が履歴を使う機能を開始して `history` 権限を許可した場合だけACTIVEレコードへ更新する。権限がない場合、または権限はあっても該当URLの信頼できる訪問日時を得られない場合を「履歴なし」とし、`null` のまま `savedAt` から推測しない。自動アーカイブは `lastVisitedAt=null` のBookmarkを変更せず、後者では `ARCHIVE_HISTORY_NOT_FOUND` を永続化して設定画面にエラー表示する。訪問リマインダー用の日別件数はBookmarkへ保存せず、評価時に履歴の `visitTime` から再計算する。旧 `visitCount` fieldは判定に使わず、schema migrationまたは次回書込みで除去する。`MANUAL_URL` でも入力値をそのまま信用せず、許可スキーム、長さ、正規化結果を検証する。

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
- AIは候補提示ではorigin USERを優先するが、`tagUniqueName` の競合判定はoriginを問わず全TAGを対象にする。同じnormalizedNameがあれば、選択Category内のactive TAGだけを信頼側でそのIDのREUSEへ解決できる。親不一致またはtombstone競合はその候補だけを棄却し、別IDを作らない。normalizedNameが異なる同義語等の意味判断はGemini Nanoの品質責務であり、本番validatorが未定義のalias推測でIDへ変換・棄却しない。他に正常候補があれば全正常候補を適用してJobをSUCCEEDEDとし、正常候補0件の場合だけ再試行する。
- AIはorigin USERのレコードを上書きしない。
- `kind` は変更しない。ACTIVE Tagの `parentCategoryId` は、期待Tag revisionと選択したACTIVE親Categoryの期待revisionを検証する専用 `UpdateTag` transactionでだけ変更できる。Import、AI出力、同期の暗黙merge、名称一致を親変更commandへ変換しない。
- `creationRequestId` は作成操作の冪等キーであり一意とする。同じ操作の再送は同じrequestIdを使い、別requestIdでも既存と同じ正規化タグ名なら新規作成を拒否する。AIのCREATE候補を検証・正規化した後、信頼済みコードがCategory IDと正規化名から `proposalKey` を決定的に作り、`jobId:proposalKey` から安定生成する。モデルに `proposalKey` を生成させない。
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
- CATEGORY edgeは直接編集しない。Tag差分適用後、ACTIVEなTAG edgeの親CATEGORY ID集合を求め、その集合にないACTIVE CATEGORY edgeを論理削除し、不足するedgeを追加または復元する。同じ親の最後のTAG edgeを解除した時は親CATEGORY edgeも解除される。派生CATEGORY edgeの `assignedBy` は、同じ親へ寄与するactive TAG edgeにUSERがあればUSER、なければIMPORT、SHARE、AIの順で決め、`confidence` と `classificationJobId` は常にnullとする。
- 同じLabelを複数のBookmarkから参照できる。名称変更や同期後も関連は表示名ではなく `labelId` で維持する。
- AI適用の置換対象は `assignedBy=AI` のTAG edgeだけであり、派生CATEGORY edge、USER／IMPORT／SHAREのTAG edgeを暗黙に削除しない。置換操作は対象差分を明示し、BookmarkRevisionへ残す。
- Bookmarkの手動保存／編集で利用者が明示選択したTagのactive edgeが `assignedBy=AI` なら、同じtransactionで `assignedBy=USER`、`confidence=null`、`classificationJobId=null` へ昇格し、edge revisionを進める。後続AI適用はこれをAIへ戻さない。
- confidenceはAI割当のTAG edgeだけ0〜1の値を許し、それ以外と全CATEGORY edgeはnull。
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
type TagImportance = "CORE" | "MAJOR" | "SUPPORTING" | "DETAIL"

type ClassificationRetryReasonCode =
  | "RESPONSE_SCHEMA_INVALID"
  | "CANDIDATE_SCHEMA_INVALID"
  | "MODEL_TIMEOUT"
  | "MODEL_RESPONSE_INTERRUPTED"
  | "MODEL_RESPONSE_TRUNCATED"
  | "MODEL_RESPONSE_SIZE_EXCEEDED"
  | "MODEL_RESULT_LOST"
  | "MODEL_NEEDS_REVIEW"
  | "CATEGORY_INVALID"
  | "NO_VALID_CANDIDATE"
  | "REUSE_ID_INVALID"
  | "REUSE_PARENT_MISMATCH"
  | "EVIDENCE_INVALID"
  | "IMPORTANCE_NOT_ALLOWED"
  | "NAME_INVALID"
  | "DUPLICATE"

type LegacyClassificationPolicySnapshotV1 =
  | { policyVersion: 1; granularity: 0; maxNewTags: 0 }
  | { policyVersion: 1; granularity: 1; maxNewTags: 1 }
  | { policyVersion: 1; granularity: 2; maxNewTags: 2 }
  | { policyVersion: 1; granularity: 3; maxNewTags: 4 }
  | { policyVersion: 1; granularity: 4; maxNewTags: 6 }

type ClassificationPolicySnapshotV2 =
  | {
      policyVersion: 2
      granularity: 0
      reusePolicy: "STRONG_REUSE"
      allowedCreateImportance: readonly ["CORE"]
    }
  | {
      policyVersion: 2
      granularity: 1
      reusePolicy: "PREFER_REUSE"
      allowedCreateImportance: readonly ["CORE"]
    }
  | {
      policyVersion: 2
      granularity: 2
      reusePolicy: "BALANCED"
      allowedCreateImportance: readonly ["CORE", "MAJOR"]
    }
  | {
      policyVersion: 2
      granularity: 3
      reusePolicy: "NEAR_EXACT_REUSE"
      allowedCreateImportance:
        readonly ["CORE", "MAJOR", "SUPPORTING"]
    }
  | {
      policyVersion: 2
      granularity: 4
      reusePolicy: "EXACT_EQUIVALENT_REUSE"
      allowedCreateImportance:
        readonly ["CORE", "MAJOR", "SUPPORTING", "DETAIL"]
    }

type ClassificationDiagnosticReasonCode =
  | ClassificationRetryReasonCode
  | "INPUT_CONTEXT_TOO_LARGE"
  | "STALE_CLASSIFICATION_INPUT"
  | "AI_DISABLED"
  | "SETTINGS_RECONFIGURATION_REQUIRED"
  | "EXECUTION_ATTEMPT_LIMIT_EXCEEDED"
  | "CLASSIFICATION_JOB_INVARIANT_VIOLATION"

type ClassificationModelAttemptPhase =
  | "PREPARED"
  | "DISPATCH_RESERVED"
  | "VALIDATED"
  | "CLOSED"

interface ClassificationModelAttemptRecord {
  attemptId: Id
  ordinal: 1 | 2 | 3
  leaseNonce: string
  phase: ClassificationModelAttemptPhase
  outcome:
    | null
    | "GLOBAL_INVALID"
    | "ZERO_VALID"
    | "APPLIED"
    | "TECHNICAL_FAILURE"
    | "ABANDONED_PRE_DISPATCH"
    | "CANCELED_STALE"
    | "CANCELED_SETTINGS"
    | "CANCELED_USER"
  acceptedCount: number
  rejectedCount: number
  reasonCodes: ClassificationDiagnosticReasonCode[]
  preparedAt: EpochMs
  dispatchReservedAt: EpochMs | null
  closedAt: EpochMs | null
}

type PersistedValidatedClassificationCandidate =
  | {
      action: "REUSE"
      tagId: Id
      importance: TagImportance
      confidence: number
    }
  | {
      action: "CREATE"
      name: string
      normalizedName: string
      proposalKey: string
      creationRequestId: string
      importance: TagImportance
      confidence: number
    }

interface PersistedClassificationApplyCommandV2 {
  validatorVersion: 2
  attemptId: Id
  modelAttempt: 1 | 2 | 3
  inputFingerprint: string
  categoryId: Id
  candidates: PersistedValidatedClassificationCandidate[]
}

type ClassificationJobState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "NEEDS_REVIEW"
  | "CANCELED"

interface LegacyClassificationJobRecordV1 {
  schemaVersion: 1
  id: Id
  bookmarkId: Id
  requestId: Id
  reason: "INITIAL_SAVE" | "USER_RECLASSIFY" | "CATEGORY_CASCADE_DELETE"
  triggerOperationId: Id | null
  state: ClassificationJobState
  inputFingerprint: string
  bookmarkRevision: number
  settingsVersion: number
  policy: LegacyClassificationPolicySnapshotV1
  maxCandidateCategories: number
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

interface ClassificationJobRecordV2 {
  schemaVersion: 2
  id: Id
  bookmarkId: Id
  requestId: Id
  reason: "INITIAL_SAVE" | "USER_RECLASSIFY" | "CATEGORY_CASCADE_DELETE"
  triggerOperationId: Id | null
  state: ClassificationJobState
  activeInputKey?: string // PENDING／RUNNINGだけに存在する一意なbookmarkId＋inputFingerprint key
  inputFingerprint: string
  bookmarkRevision: number
  bookmarkStateBeforeJob: Exclude<BookmarkClassificationState, "PENDING">
  settingsVersion: number
  promptVersion: "gemini-nano-tag-classifier-v2"
  responseSchemaVersion: 2
  candidateQueryVersion: "all-active-labels-v1"
  policy: ClassificationPolicySnapshotV2
  maxPromptInputBytes: 262144
  maxModelResponseBytes: 262144
  maxModelAttempts: 3
  modelAttempt: 0 | 1 | 2 | 3
  executionAttempt: number
  maxExecutionAttempts: 3
  provider: "CHROME_PROMPT"
  providerModel: string | null
  executionContext: "TOP_LEVEL_EXTENSION_DOCUMENT" | null
  executorInstanceId: string | null
  leaseExpiresAt: EpochMs | null
  leaseNonce: string | null
  appliedCandidateCount: number
  rejectedCandidateCount: number
  activeAttemptId: Id | null
  modelAttempts: ClassificationModelAttemptRecord[]
  pendingApply: PersistedClassificationApplyCommandV2 | null
  errorCode: string | null
  startedAt: EpochMs | null
  finishedAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
}

type PersistedClassificationJobRecord =
  | LegacyClassificationJobRecordV1
  | ClassificationJobRecordV2
~~~

新規作成・実行できるのは `ClassificationJobRecordV2` だけとする。version 1 recordはversion別decoderで読み、terminal recordは監査表示だけ、PENDING／RUNNING recordは移行処理による取消だけを許す。ページ本文、完全なプロンプト、AIの自由文応答は既定で保存しない。正常候補1件以上の時だけ、process loss後のDB再適用に必要な `pendingApply` を一時保存する。これは検証済みID、正規化済みCREATE名、proposalKey、importance、confidenceに限定し、evidenceText、生応答、title、URLを含めず、Job終端時に削除する。デバッグ用ログが必要な場合も個人データを除去し、開発ビルドに限定する。

全ての新規version 2 Jobは `state=PENDING`、`modelAttempt=0`、`executionAttempt=0`、`modelAttempts=[]`、`activeAttemptId=null`、`pendingApply=null`、`executorInstanceId=null`、`leaseExpiresAt=null`、`leaseNonce=null`、適用／棄却件数0、error／開始／終了時刻nullで作る。`executionAttempt` は整数0〜3に限定する。INITIAL_SAVE、CATEGORY_CASCADE_DELETE、USER_RECLASSIFY、stale差替え、version 1移行のいずれも、旧Jobのcounter、attempt、leaseを引き継がない。

復旧時はdurable migration gateがないことを確認してから、active Job、Bookmark、Label、classificationSettings正本を同じtransactionで読む。AI Host可用性、claim、executionAttempt上限より先に設定stateを判定し、RECONFIGURATION_REQUIREDまたはCONFIGUREDかつdisabledならpolicy必須のfingerprintを生成せず、未CLOSED attemptをCANCELED_SETTINGS／CLOSED、Jobを差替えなしのCANCELED、BookmarkをbookmarkStateBeforeJobへ戻す。CONFIGUREDかつenabledの場合だけcurrent base fingerprintを再計算し、不一致ならcounter非消費でstale差替えへ移る。一致して `pendingApply` があればService WorkerのDB-only経路で同じcommandを適用する。この経路ではexecutionAttempt／modelAttemptを増やさない。再試行不能なquota／schema破損だけをDB失敗のFAILEDとし、executionAttempt上限を理由にpendingApplyを破棄しない。一致かつpendingApplyなしの場合だけclaim／実行上限を判定する。

### 索引

- byStateUpdatedAt: state, updatedAt
- byBookmarkCreatedAt: bookmarkId, createdAt
- byFingerprint: inputFingerprint
- byActiveInputKey: activeInputKey（unique。terminal Jobはproperty自体を持たない）
- byRequestId: requestId（unique）

同じ入力fingerprintのSUCCEEDEDがある場合は再適用しない。PENDING／RUNNING Jobだけが `activeInputKey = "classification-active:" + bookmarkId + ":" + inputFingerprint` を持ち、terminal化と同じtransactionでpropertyを削除する。同一Bookmarkのactive Jobを作る時は `byBookmarkCreatedAt` を同じreadwrite transactionで確認し、同じinputFingerprintなら既存Jobを返し、異なるfingerprintなら旧active Jobを取消してからget-or-createする。`byActiveInputKey` の一意制約とtransactionの直列化により、別の旧Jobから同時にstaleを検出しても現在snapshotのactive Jobを1件へ収束させる。通常Jobの `triggerOperationId` はnullとし、Category連鎖削除では削除requestIdを入れ、`requestId = categoryDeleteRequestId + ":" + bookmarkId` のようにBookmarkごとに安定生成して再送を1件へ収束させる。Job作成時に設定値からpolicy version 2のdiscriminated unionを生成し、granularity、reusePolicy、allowedCreateImportanceの不一致を拒否する。

version 2 Jobをterminal化するtransactionでは、`activeAttemptId` と `pendingApply` をnull、`executorInstanceId`、`leaseExpiresAt`、`leaseNonce` をnullにし、`activeInputKey` propertyを削除する。current attemptがCLOSEDでなければ、stale差替えでは `CANCELED_STALE`、設定による差替えなし取消では `CANCELED_SETTINGS`、利用者取消では `CANCELED_USER` として `phase=CLOSED`、`closedAt=now` にする。実行上限finalizerはattempt phaseに応じて後述のABANDONED_PRE_DISPATCHまたはTECHNICAL_FAILUREを使う。DISPATCH_RESERVED済みordinalは旧JobのmodelAttempt監査に残すが、差替えJobへ引き継がない。Job state、attempt、token clear、差替えJobまたはBookmark状態復帰の一部だけをcommitしない。

`candidateQueryVersion="all-active-labels-v1"` は件数・意味shortlistをしない。全active USER CategoryをID順、それらを親とする全active TagをUSER／AI／IMPORT／SHAREの順かつorigin内ID順でpromptへ入れる。active Tagの親がこのCategory集合にない場合は入力不変条件違反としてFAILEDにする。各attemptのretryContext込み `ClassificationPromptInput` をcanonical JSON化したUTF-8 byte長が `maxPromptInputBytes=262144` を超える場合、または固定system prompt込みの実requestがProvider入力quotaを超える場合は、候補を切らずdispatch前にINPUT_CONTEXT_TOO_LARGEでFAILEDにする。base input fingerprintは、retryContextを除く別の `BaseFingerprintPayload` に `fingerprintVersion="classification-base-v1"`、bookmarkId、bookmarkRevision、settingsVersion、およびprompt／response schema version、candidateQueryVersion、maxPromptInputBytes、maxModelResponseBytes、policy、title／normalizedUrl、実際のprompt順のCategory／Tag全fieldを持つpromptInputを入れ、canonical JSON v1のSHA-256にする。`updatedAt`、Job state、lease、model／execution attemptも含めない。再試行入力の `retryContext` はallowlist済み理由コードだけを渡す。Tag出力には業務上の件数上限を持たせない。raw応答はJSON parse前にUTF-8で測り、`maxModelResponseBytes=262144` 超過なら部分採用せずMODEL_RESPONSE_SIZE_EXCEEDEDのtechnical failure、Providerの小さいquotaによる切断はMODEL_RESPONSE_TRUNCATEDとする。`modelAttempts.reasonCodes` にtitle、URL、Tag名、生のモデル応答を保存しない。JobはService Worker内でAI実行しない。

canonical JSON v1はJSON互換finite値だけを受け、`undefined`、sparse array、関数、symbol、BigInt、循環、NaN、Infinityを拒否する。object keyは `Object.keys(value).sort()` と同じUTF-16 code unit昇順、arrayは指定順を保持し、primitive／key escapeはwell-formed `JSON.stringify` に従う。`BaseFingerprintPayload` のcanonical UTF-8 bytesをSHA-256 lowercase hexへし、attemptごとの `ClassificationPromptInput` は同じalgorithmで別途canonicalizeしてモデルへ渡しbyte長を測る。retryContext込みpromptとretryContextなしfingerprint payloadを同じ文字列として扱わない。固定system promptを含む実request全体はProvider quotaでも別途検査する。この規則に合わない既存helperはv2実装時に更新し、別property順への再serializeを許さない。

`bookmarkStateBeforeJob` は取消後に実データと矛盾しない復帰先とする。INITIAL_SAVEでは保存transactionの手動Tag適用後、CATEGORY_CASCADE_DELETEでは連鎖削除後の残存active Tag計算後に、1件以上ならCLASSIFIED、0件ならUNCLASSIFIEDを保存する。USER_RECLASSIFYではPENDINGへ変える直前の非PENDING状態を保存し、既にactive Jobがある場合はそのJobの値を引き継ぐ。active Job中の手動Tag追加／解除transactionは、編集後のactive TAG edgeが1件以上ならCLASSIFIED、0件ならUNCLASSIFIEDへ旧JobのbookmarkStateBeforeJobを更新し、その値をstale差替えJobへ引き継ぐ。Tag差分を伴わないstaleは旧値を引き継ぐ。利用者が差替えなしで取消す時は、JobのCANCELED化、`activeInputKey` 削除、Bookmarkの `bookmarkStateBeforeJob` への復帰を同じtransactionで行う。version 1には旧fieldがないため、v2 Jobを作る場合も設定不明で作らない場合もactive Tag edgeがあればCLASSIFIED、なければUNCLASSIFIEDを取消復帰先とし、設定不明時は旧Job取消／AI無効化／Bookmark復帰を同じtransactionで行う。

AI HostはPrompt APIが利用可能な時だけclaimする。モデル未取得／download中／対応ページなしではJobをPENDINGに保ち、恒久非対応ならJob／BookmarkをFAILEDにして手動分類を案内する。各readwrite transactionの開始時に `now` を1回取得し、`leaseExpiresAt > now` だけを有効、`leaseExpiresAt <= now` を期限切れとする。所有者のないPENDING Jobまたは期限切れleaseから回収したJobの所有権を取得するclaim transactionが成功するたび、executorInstanceIdが前回と同じかを問わず `executionAttempt` を1増やして新しい `leaseNonce` を発行する。現在の有効なleaseNonceを提示したrenew、同lease内の結果再送、DB retryでは増やさない。`executionAttempt=3` でも3回目のleaseが有効な間は同ownerのrenew、結果受付、pendingApply適用を許す。ownerlessまたはlease失効により4回目の所有権取得が必要になった時だけ新しいclaimを拒否し、後述のfinalizerでインフラ失敗のFAILEDとする。

モデル呼出しでは、snapshot検証後に一意なattemptIdを `PREPARED` で保存する。PREPAREDのままleaseを失いexecutionAttemptが3未満なら、次にlease所有権を取得したexecutorが旧attemptを `ABANDONED_PRE_DISPATCH`／CLOSEDにしてactiveAttemptIdを外し、同じ次ordinalの新attemptIdを現在のleaseNonceで作る。executionAttempt=3の失効時は新ownerを作らずfinalizerが同じCLOSED化を行う。旧attemptIdを別leaseへ再bindせず、この回収ではmodelAttemptを消費しない。外部call直前の別readwrite transactionでは設定stateを先に確認し、CONFIGUREDかつenabledの場合だけ現在のJob／lease／PREPARED attemptを照合してall-active-labels-v1 queryからcurrent base fingerprintを再計算する。一致時だけ `DISPATCH_RESERVED`、ordinal、現在leaseNonceをcommitし、その後だけPrompt APIを1回呼ぶ。不一致ならmodelAttemptを増やさずstale差替えへ移る。同attemptIdを再dispatchしない。外部callとIndexedDBはatomicにできないため、reservation commit直後のHost停止でも安全側にそのmodelAttemptを消費済みとする。結果messageはjobId、attemptId、modelAttempt、inputFingerprint、leaseNonceを必須とし、結果受付transactionの同じ `now` で `leaseExpiresAt > now` かつ現在のactive attemptと完全一致する時だけ受理する。結果受付とfinalizerはreadwrite transaction順に直列化し、先にcommitした側の状態を正として後続側をterminal no-op、pendingApply回復、RUNNING Jobの実行上限finalize、またはlate response拒否へ収束させる。

結果受付とfinalizerの競合で結果側が先にcommitした場合、terminalはno-op、VALIDATED／pendingApplyはDB-only回復とする。一方、quality-zero／technical failureをCLOSEDで保存後もRUNNING、activeAttemptId=null、pendingApply=nullのJobはno-op対象ではない。`executionAttempt=3` なら次のfinalizer表に従い、新ownerや新attemptを作らずFAILEDへ収束させる。finalizer側が先にcommitした場合は、後続結果をlate responseとして拒否する。

4回目claimが必要な実行上限では、lease-expiry finalizerが設定取消、configured-enabled時のstale差替え、fingerprint一致済みpendingApply回復をこの順で先に評価し、いずれにも該当しない場合だけ次を1つのterminal transactionで行う。

| current attempt | finalizer処理 |
| --- | --- |
| なし／既にCLOSED | attempt recordを変更しない |
| PREPARED | `ABANDONED_PRE_DISPATCH`／CLOSED。modelAttemptは増やさない |
| DISPATCH_RESERVED | `TECHNICAL_FAILURE`、reason=`MODEL_RESULT_LOST`／CLOSED。modelAttemptは消費済みのまま |
| VALIDATEDかつpendingApplyあり | finalizerへ入らず先にDB-only適用 |
| VALIDATEDかつpendingApplyなし | `TECHNICAL_FAILURE`／CLOSED、reason=`CLASSIFICATION_JOB_INVARIANT_VIOLATION` |

finalizerはexecutionAttemptを3のまま、新attemptId／leaseNonceを発行せず、Job／BookmarkをFAILEDにする。errorCodeの優先順は、VALIDATEDなのにpendingApplyがなければ `CLASSIFICATION_JOB_INVARIANT_VIOLATION`、finalizerのattempt処理後にmodelAttempt=3かつTECHNICAL_FAILUREが1件以上あれば `AI_TECHNICAL_FAILURE`、それ以外は `EXECUTION_ATTEMPT_LIMIT_EXCEEDED` とする。第3 DISPATCH_RESERVEDの結果喪失でmodel／execution両枠が同時に枯渇する場合はdispatch枠枯渇を優先する。同じtransactionでactiveAttemptId、pendingApply、executor／lease fieldsをnull、activeInputKey propertyを削除し、全late responseを拒否する。

timeout、応答切断、truncated、応答byte上限超過、dispatch後の結果喪失はtechnical failureであり、dispatch枠は消費するがquality-zeroには数えない。結果喪失後のretryContextには `MODEL_RESULT_LOST` だけを渡せる。JSON／envelope／候補検証による正常候補0件だけをquality-zeroとする。3 dispatchすべてquality-zeroの場合だけNEEDS_REVIEWとし、technical failureを含んでdispatch枠を使い切ればFAILEDとする。all-active-labels-v1の全入力が固定byte予算／Provider quotaに収まらない時はdispatch前にINPUT_CONTEXT_TOO_LARGEでFAILEDとし、modelAttemptを消費しない。正常候補1件以上では `pendingApply` を先に永続化し、process loss後も再検証して同じcommandを適用する。旧policy version 1のterminal Jobは監査履歴として保持する。旧settingsはdurable migration gateに固定したraw schemaをversion allowlistで判定し、既知のLOCAL_SETTINGS_V1だけを暗黙enabledとして同じgranularity位置からv2 policyへ変換する。PENDING／RUNNINGのversion 1 Jobはversionを書き換えず、CONFIGUREDかつenabledなら旧Job取消と `classification-v2-migration:<legacyJobId>:<newInputFingerprint>` のversion 2 Job get-or-createを同じtransactionで行う。RECONFIGURATION_REQUIREDなら、旧Job取消とBookmarkをactive TAG edgeありならCLASSIFIED、なしならUNCLASSIFIEDへ戻す更新だけを同じtransactionで行い、version 2 Jobを作らない。

## classificationSettings

AI分類がJob作成、stale検出、適用直前検証で参照する設定正本を、関連Storeと同じIndexedDB transactionで読めるようにする。

~~~ts
type ClassificationSettingsRecord = {
  schemaVersion: 1
  key: "current"
  settingsRevision: number
  lastMutationRequestId: string | null
  lastMutationFingerprint: string | null
  updatedAt: EpochMs
} & (
  | {
      configurationState: "CONFIGURED"
      aiEnabled: boolean
      aiGranularity: 0 | 1 | 2 | 3 | 4
      policy: ClassificationPolicySnapshotV2
    }
  | {
      configurationState: "RECONFIGURATION_REQUIRED"
      aiEnabled: false
      aiGranularity: null
      policy: null
    }
)
~~~

`settingsRevision` は1から始まる単調増加safe integerとする。新規installのrevision 1は `configurationState="CONFIGURED"`、`aiEnabled=true`、`aiGranularity=2`、policy version 2の `BALANCED` とし、`lastMutationRequestId`／fingerprintはnullにする。モデル未取得や端末非対応はこの設定値を暗黙にOFFへ変えず、JobをPENDINGまたは規定のFAILEDへ遷移させる。configurationState、`aiEnabled` または `aiGranularity` の実効値が変わる成功commandだけが、`classificationSettings` の1つのreadwrite transactionでrevisionをちょうど1進め、CONFIGUREDでは同じtransactionでgranularityからpolicy version 2を導出する。旧値を確定できない移行では値0を補わずRECONFIGURATION_REQUIRED、null policyで保存する。commandは `expectedSettingsRevision`、`settings-update:` requestId、変更payloadのcanonical fingerprintを必須とする。同じ最新requestId／fingerprintの応答再送はrevisionを再加算せず同じ結果へ収束し、別payload再利用または古いexpected revisionを拒否する。

version 2 Jobの `settingsVersion` はJob作成transactionで読んだCONFIGUREDかつ `aiEnabled=true` の `ClassificationSettingsRecord.settingsRevision` のsnapshotである。RECONFIGURATION_REQUIREDまたは `aiEnabled=false` では新しい分類Jobを作らない。base fingerprint再計算、claim前stale判定、DISPATCH_RESERVED直前、pendingApply適用transactionも同じStoreを同じIndexedDB transactionで読み、`chrome.storage.local` をtransaction途中に参照しない。各transactionは設定stateを先に分岐し、disabled／再設定待ちはpolicy必須のBaseFingerprintPayloadを構築せず、未CLOSED attemptをCANCELED_SETTINGS／CLOSED、旧Jobを差替えなしでCANCELED、Bookmarkを `bookmarkStateBeforeJob` へ戻す。CONFIGUREDかつenabledの場合だけpolicyを導出してcurrent fingerprintを計算し、不一致ならstale差替え、一致かつpendingApplyありならDB-only適用、一致かつpendingApplyなしならclaim／上限判定へ進む。これによりnull policyのfingerprint構築不能と設定変更のTOCTOUを閉じる。

設定UIはService WorkerのcommandだけでAI設定を変更する。IndexedDB commit後に `LocalSettings` へconfiguration state、値、`classificationSettingsRevision` をmirrorするが、両保存先はatomicでないためIndexedDBを正本とする。mirror失敗はAI設定commitを巻き戻さず、UIはService Worker経由で正本を読み、通常時の起動／`storage.onChanged` でmirrorを修復する。durable migration gateが存在する間はmigration owner以外のmirror repairを停止し、gateやsnapshotの書込みを外部設定変更として処理しない。外部からchrome.storage.localだけを書き換えてもAI実効値に採用せず、正本値へ戻す。空DBの新規installではversionchange後に上記のrevision 1既定recordを作り、作成完了までcommand受付を開始しない。旧DBの移行では後述のdurable migration gateが固定した旧設定snapshotだけからrevision 1を作り、CONFIGUREDかつenabledの場合だけversion 2 Jobを作る。

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
type FrequentVisitWindow = "LAST_7_DAYS" | "LAST_30_DAYS" | "LAST_365_DAYS"

interface LocalSettings {
  settingsSchemaVersion: 2
  classificationSettingsRevision: number
  classificationConfigurationState:
    | "CONFIGURED"
    | "RECONFIGURATION_REQUIRED"
  onboardingState: {
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
    currentStepId: string | null
    initializedBy: "INSTALL"
    updatedAt: EpochMs
  }
  aiEnabled: boolean
  aiGranularity: 0 | 1 | 2 | 3 | 4 | null
  viewMode: "LIST" | "GRID"
  thumbnailEnabled: boolean
  contextMenuBookmarkEnabled: boolean
  frequentVisitReminderEnabled: boolean
  frequentVisitWindow: FrequentVisitWindow | null
  frequentVisitDayThreshold: number | null
  autoArchiveEnabled: boolean
  archiveAfterDays: number
  archiveHistoryAccess: "NOT_REQUESTED" | "GRANTED" | "DENIED"
}
~~~

旧設定からIndexedDB正本へ移す間だけ、`chrome.storage.local` に次のdurable gateを1値として置く。`CapturedLegacySetting` は移行判断に必要な型だけを固定し、破損値を有効値へ変換しない。旧実装の `schemaVersion` と現行mirrorの `settingsSchemaVersion` を別fieldで捕捉し、どちらを読んだかを曖昧にしない。

~~~ts
type CapturedLegacySetting =
  | { kind: "MISSING" }
  | { kind: "BOOLEAN"; value: boolean }
  | { kind: "FINITE_NUMBER"; value: number }
  | { kind: "INVALID"; valueType: string }

interface ClassificationSettingsMigrationGate {
  schemaVersion: 1
  state: "CAPTURED" | "IDB_COMMITTED"
  migrationId: string
  snapshot: {
    schemaVersion: CapturedLegacySetting
    settingsSchemaVersion: CapturedLegacySetting
    aiEnabled: CapturedLegacySetting
    aiGranularity: CapturedLegacySetting
  }
  snapshotSha256: string
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

Service Workerは起動時に移行と、classificationSettingsへ依存する全command／background処理を同じ排他キューへ入れる。旧DBを検出したら他commandを受理する前に、既存の `migrateLocalSettings` を通さずraw `LocalSettings` の `schemaVersion`、`settingsSchemaVersion`、`aiEnabled`、`aiGranularity` を上記表現へ変換し、canonical JSON v1のhashと `state=CAPTURED` を同じ `chrome.storage.local.set` で永続化する。

gateはCAPTURED／IDB_COMMITTEDのどちらでも、存在自体を排他barrierとする。全LocalSettings read／write commandと、classificationSettingsの値でcommit内容が変わるBookmark保存、Category cascade、USER_RECLASSIFY、Job作成／差替え／claim／DISPATCH_RESERVED／結果受付／pendingApply適用／lease回収は、処理開始前に同じキューでgateを確認する。gate存在中の利用者commandはIndexedDB／LocalSettingsへ何も書かずretryableな `SETTINGS_MIGRATION_IN_PROGRESS` を返し、設定readもmirror値を返さず同状態を返す。background処理はJob、attempt、lease、counterを変更せず再実行待ちにする。分類設定に依存しない検索、一覧、手動Tag編集等だけは継続できる。

gateまたは分類設定mirror 4項目を書けるのはmigration ownerだけとする。通常のmirror repair、`storage.onChanged` handler、他のLocalSettings mutationはgate中に待機し、gate自身の変更を外部設定変更として処理しない。versionchange後のdata migrationは保存済みsnapshotとhashだけを読み、hash不一致なら推測せずmigrationをFAILEDにする。IDB commit後だけ同じsnapshotのgateを `IDB_COMMITTED` にし、IDB正本から `classificationConfigurationState`、`classificationSettingsRevision`、`aiEnabled`、`aiGranularity` をmirrorへ書き戻して読取照合し、その後だけgateを削除して待機commandを解放する。`CAPTURED`／`IDB_COMMITTED` の途中停止は同じmigrationIdとsnapshotから再開し、外部によるstorage変更を移行入力へ取り込まず最終repairで上書きする。

- 不明なenum値は安全な既定値へ戻す。
- 設定の破損でBookmarkデータを初期化しない。
- `classificationConfigurationState`、`classificationSettingsRevision`、`aiEnabled`、`aiGranularity` は `classificationSettings` 正本のUI mirrorであり、AI Jobやfingerprintはこのmirrorを直接読まない。mirror欠損／不一致は正本から修復する。再設定待ちはaiEnabled=false、aiGranularity=nullで表し、値0へ変換しない。`settingsSchemaVersion` はデータ形式の版であり、AI設定変更検知には使わない。
- `frequentVisitDayThreshold` は新規installでも既定値を持たずnullとする。`frequentVisitWindow` は3 enumだけを許可し、当日を含む直近7／30／365暦日へ対応させる。期間選択を変更した時点でも `frequentVisitDayThreshold=null` とし、判定を `REMINDER_CONFIG_REQUIRED` で停止する。再入力値は期間ごとに1〜7／1〜30／1〜365の有限整数だけを許可する。`archiveAfterDays` は新規installと欠損／不正値migrationで30とし、それ以外は有限の正整数として検証する。空文字、指数表記、NaN、Infinity、範囲外を有効設定へ変換しない。
- 旧 `frequentVisitThreshold` は回数から日数へ暗黙変換しない。migrationでは旧fieldを除去し、`frequentVisitWindow=null`、`frequentVisitDayThreshold=null`、`frequentVisitReminderEnabled=false` として利用者の再設定を要求する。
- CONFIGURED時の `aiGranularity` だけを0〜4のスライダー値として扱う。Job作成時にpolicy version 2の `reusePolicy` と `allowedCreateImportance` を固定する。0／1は `CORE`、2は `MAJOR`まで、3は `SUPPORTING`まで、4は `DETAIL`までCREATEでき、0でも中心主題を表せる既存Tagがなければ必要最小限の `CORE` を作成できる。`maxNewTags` や `maxAssignedTags` へ変換しない。RECONFIGURATION_REQUIREDではsliderを未設定表示にし、利用者の明示選択までJobを作らない。
- `frequentVisitReminderEnabled=false` の間は新規候補の生成と通知を行わない。端末固有表示設定は同期せず、行動履歴関連の設定を同期するかは同期Planで固定する。
- `contextMenuBookmarkEnabled` は端末固有設定としてDrive同期しない。旧settingsにfieldがない場合は既存の右クリック保存を維持するため `true` へ移行し、boolean以外の破損値は安全側の `false` として扱う。`true` はBookmation所有のpage／link menu IDを重複なく登録し、`false` はその2件を解除する。クリック処理も保存直前に現在値を再確認し、`false` なら保存しない。
- `onboardingState` は `runtime.onInstalled` の `reason="install"` でレコードがない時だけ初期化する。update、startup、Service Worker再起動で上書きせず、currentStepIdから途中再開し、完了後もCOMPLETEDを保持する。端末固有のためDrive同期しない。
- カテゴリテンプレートcatalogはIndexedDBの正本Storeではなく、アプリに同梱する版付き参照データとする。ISSUE-022でcatalog schemaを決めるまでは仮の候補名をmigrationやseedへ埋め込まない。catalogを表示しただけではLabelを作らず、利用者の適用操作で通常のCategory作成transactionを呼ぶ。作成後は `kind="CATEGORY"`、`origin="USER"` とし、Normalizer、一意索引、creationRequestId、論理削除規則を例外なく適用する。stepは既存の `onboardingState.currentStepId` で追跡し、catalog versionの永続fieldとmigrationはISSUE-022決定後にschemaへ追加する。update／reloadだけで再適用しない。
- `autoArchiveEnabled` は新規installとfield欠損migrationでfalseとする。ON commandは利用者gesture内で目的説明後に `history` 実権限を確認・必要なら要求し、許可成功後だけtrueをcommitする。拒否、取消、例外ではfalseのままとし、後から権限が削除された場合もfalseへ戻してarchive alarmを止める。toggleをOFFにするだけでは、訪問リマインダーも利用し得る共有 `history` permissionを削除しない。`archiveHistoryAccess` はUI表示用cacheであり、実行前にChromeの実権限を再確認する。アーカイブを理由に `notifications` を要求しない。

## visitReminders

完全な閲覧履歴を複製せず、リマインダーの重複抑止に必要な最小情報だけを保存する。

~~~ts
interface VisitReminderRecord {
  schemaVersion: number
  id: Id
  normalizedUrlHash: string
  normalizedUrl: string
  window: FrequentVisitWindow
  windowStartedAt: EpochMs
  visitDaysAtReminder: number
  countingResetAt: EpochMs | null
  state: "PENDING" | "SAVED" | "DECLINED" | "DISMISSED" | "SUPPRESSED"
  remindedAt: EpochMs
  respondedAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

同じ正規化URLに有効な `PENDING` を複数作らない。評価時は `chrome.history.getVisits()` の各 `visitTime` を現在の端末ローカル暦日へ変換し、同じcanonical URL・同じ暦日を1件へまとめる。選択期間の開始時刻と、そのURLの最新 `countingResetAt` の遅い方より後だけを数える。`いいえ` はstateを `DECLINED`、`respondedAt` と `countingResetAt` を応答時刻へ更新し、次の候補はそれ以降の訪問日だけで再判定する。同日中でもreset後の訪問は新しい1日目になり得る。「次回以降表示しない」は候補URL単位で `SUPPRESSED` にし、resetより優先する。グローバル設定 `frequentVisitReminderEnabled` は変更せず、履歴がさらに増えても同じURLを再候補化しない。`SAVED` へ変えるのは利用者が `はい` を選び、Bookmark保存がcommitした後だけとする。OS通知を明示回答せず閉じた `DISMISSED` は `いいえ` と同じく `countingResetAt` を応答時刻へ更新する（ISSUE-D39）。

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

## archiveEvaluationIssues

background評価でarchiveしなかった理由を、設定画面で利用者へ表示できる最小状態として保持する。完全な履歴や訪問日の配列は保存しない。

~~~ts
interface ArchiveEvaluationIssueRecord {
  schemaVersion: number
  id: Id
  bookmarkId: Id
  bookmarkRevision: number
  code: "ARCHIVE_HISTORY_NOT_FOUND"
  state: "OPEN" | "RESOLVED"
  detectedAt: EpochMs
  lastCheckedAt: EpochMs
  resolvedAt: EpochMs | null
  createdAt: EpochMs
  updatedAt: EpochMs
}
~~~

同じBookmarkとcodeにOPEN recordを複数作らない。`history` 権限が許可済みでも正規化URLの信頼できる訪問日時を得られなければOPENへupsertし、Bookmarkは `lastVisitedAt=null` のままarchiveしない。後の検証で訪問日時を取得できた場合だけRESOLVEDへ進める。設定画面はBookmarkをjoinしてページ名／URLと `履歴がないためアーカイブできません` を表示する。実行頻度と利用者による再確認controlはISSUE-009で決める。

### 索引

- byBookmarkCode: bookmarkId, code（OPENは一意）
- byStateUpdatedAt: state, updatedAt

## importJobs

~~~ts
type ImportFolderTagResolution =
  | {
      mode: "REUSE"
      sourceFolderId: string
      sourceFolderName: string
      normalizedTagName: string
      tagId: Id
      expectedTagRevision: number
      parentCategoryId: Id
    }
  | {
      mode: "CREATE"
      sourceFolderId: string
      sourceFolderName: string
      normalizedTagName: string
      parentCategoryId: Id
      expectedParentCategoryRevision: number
      tagCreationRequestId: string
    }
  | {
      mode: "SKIP"
      sourceFolderId: string
      sourceFolderName: string
      reason: "FOLDER_NAME_INVALID" | "TAG_NAME_RESERVED"
    }

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
  selectionFingerprint: string
  folderTagResolutions: ImportFolderTagResolution[]
  createdAt: EpochMs
  updatedAt: EpochMs
  finishedAt: EpochMs | null
}
~~~

標準BookmarkのURL、title、Folder nodeはプレビュー時の未信頼入力として検証する。各URL nodeの `parentId` が指す直上Folderだけを `sourceFolderId`／`sourceFolderName` として解決し、祖先ID、full path、兄弟FolderをLabel作成入力へ含めない。`sourceFolderId` はImport Jobの再開とpreview照合にだけ使い、Bookmark／Labelの正本IDへ転用しない。同じ正規化名のactive Tagがあれば `REUSE` とし、Tag revisionと親Categoryをcommit時に再検証する。Tagが存在しない場合だけ、利用者が選んだactive Category revisionと安定したrequestIdを持つ `CREATE` を許す。CategoryをFolder名から自動作成しない。

commitは選択fingerprint、全Folder解決、URL、重複、Label revisionを再検証し、各Bookmarkへ解決済みTag edgeをちょうど1件 `assignedBy="IMPORT"` で作る。Category edgeはTag親集合から導出し、AI classification Jobは作らない。複数branchに同名の直上Folderがある場合はglobal uniqueな同じTag解決へ収束させる。Folder名が空／Normalizerで不正なら `FOLDER_NAME_INVALID`、同名tombstoneが名前を予約中なら `TAG_NAME_RESERVED` とし、自動rename、tombstone復元、placeholder Tagを行わない。元のChrome Bookmark IDを正本IDにせず、取り込んだBookmarkには `source="CHROME_IMPORT"` を記録する。元データを変更・削除しない。

## トランザクション

### 保存

Service Worker側のアプリケーション層がbookmarks、DashboardのBookmark追加で明示選択したTag edge、そのTag親から導出したCategory edge、classificationSettings正本を1トランザクションで扱う。設定がCONFIGUREDかつaiEnabled=trueなら同じtransactionでPENDING classificationJobを作り、BookmarkをPENDINGにする。disabled／再設定待ちならJobを作らず、active TAG edgeが1件以上ならBookmarkをCLASSIFIED、0件ならUNCLASSIFIEDにする。全Tag IDがACTIVE TAGで、その親がACTIVE CATEGORYであることを再検証し、自由入力文字列やクライアント指定`categoryIds`は保存しない。AI呼び出しはService WorkerでもDBトランザクション内でも行わず、対応を実証したトップレベル拡張ページで行う。

### 分類適用

AI Hostは生の結果と、jobId、attemptId、modelAttempt、inputFingerprint、leaseNonceをService Workerへメッセージ送信する。Service Worker側のアプリケーション層が次を実行する。固定プロンプト、出力型、候補検証の正本は [AI_GUIDE.md](AI_GUIDE.md) とする。

1. durable migration gateがないことを確認し、transaction開始時の `now` を1回取得してactive Job、Bookmark、Label、classificationSettings正本を同じtransactionで読む。RECONFIGURATION_REQUIREDまたはCONFIGUREDかつdisabledならfingerprintを生成せず、未CLOSED attemptを `CANCELED_SETTINGS`／CLOSED、Jobを差替えなしでCANCELED、Bookmarkを `bookmarkStateBeforeJob` へ戻し、activeAttemptId、pendingApply、executor／lease fields、activeInputKeyをclearする。CONFIGUREDかつenabledの場合だけ、`leaseExpiresAt > now`、現在のRUNNING Job、`activeAttemptId`、`phase=DISPATCH_RESERVED`、leaseNonce、inputFingerprint、modelAttemptがmessageと完全一致することを確認する。`leaseExpiresAt <= now`、古いlease、別attempt、CLOSED／VALIDATED attempt、terminal Jobへのlate responseは適用しない。同じ決定的候補queryからCategory／Tagの追加・復元・消滅を含むcurrent base fingerprintを再計算してJob.inputFingerprintと比較し、不一致なら `STALE_CLASSIFICATION_INPUT` としてcurrent attemptを未CLOSEDなら `CANCELED_STALE`／CLOSED、旧JobをCANCELEDにし、現在値からのversion 2 Job get-or-createとBookmarkのPENDINGを同じtransactionで行う。差替えrequest IDは `classification-stale:<oldJobId>:<newInputFingerprint>` とし、同じrequest IDまたは `(bookmarkId, newInputFingerprint)` のactive Jobを再利用する。選ばれた差替えJob以外の旧active Jobも同じterminal invariantで取消す。dispatch前のstaleでは `modelAttempt` を増やさず、dispatch後の回数は新Jobへ引き継がない。結果受付とlease-expiry finalizerが競合した時はIndexedDBのreadwrite transaction順に直列化し、先にcommitした側の状態を正とする。
2. 応答を受信できた時だけJSON、envelope schema、Category 1件、Jobのpolicy version 2 snapshotを全体検証する。JSON不正、top-level未知property、Category 0件／複数／snapshot候補外はattempt outcome=`GLOBAL_INVALID` のquality-zeroとする。正常envelopeの `outcome=NEEDS_REVIEW` はoutcome=`ZERO_VALID` とする。candidate itemの構造やREUSE IDはenvelopeのresponseConstraintで全体拒否しない。timeout、応答切断、truncated、応答byte上限超過、dispatch後の結果喪失は `TECHNICAL_FAILURE` としてattemptを閉じ、quality-zeroに数えない。GLOBAL_INVALID／ZERO_VALID／TECHNICAL_FAILUREのcloseは同じtransactionで `phase=CLOSED`、`closedAt=now`、`activeAttemptId=null` とし、次のPREPAREDだけが新しいactiveAttemptIdを設定する。
3. raw arrayの各要素をcandidate schemaへ個別に通してから、各REUSE／CREATE候補を独立にDomain検証する。field欠損、未知property、型不正、REUSE／CREATE混在はその候補だけを棄却する。REUSEはsnapshot候補内ID、選択Categoryとの親一致、根拠を確認する。候補外IDまたは別親はその候補だけを棄却し、snapshot内IDの現在revision／ACTIVE状態／親が変わった場合は手順1のstaleとする。CREATEはallowedCreateImportance、根拠、Normalizer、禁止値までを基礎検証し、同一試行内と全TAG／tombstoneのnormalizedName重複は手順5のcanonical化で解決する。重複し得ることだけを理由に、REUSEへ変換できるCREATEを先に棄却しない。重複候補は、重複以外の検証を先に行い、同じREUSE IDの先頭正常要素、同じnormalizedNameではREUSE優先、USER／AI／IMPORT／SHAREとID順、CREATEの先頭正常要素という決定的規則で1件へ収束させる。
4. 正常なCLASSIFIED envelopeでも配列が空または全candidate棄却ならattempt outcome=`ZERO_VALID`, phase=`CLOSED` とし、同じtransactionで `activeAttemptId=null` にする。GLOBAL_INVALID／ZERO_VALIDのどちらも残りdispatch枠があればallowlist済み理由コードだけを次の `retryContext` へ設定し、前試行の候補を結合せず次へ進む。3 dispatchすべてquality-zeroの場合だけJobとBookmarkをNEEDS_REVIEWへ移す。technical failureを含んで3 dispatchを使い切った場合はFAILEDにする。
5. CREATE名を全TAG／tombstoneと照合し、選択Category内のactive TAGとnormalizedNameが一致する候補は、重複棄却より先に必ずそのIDのREUSEへcanonical化する。選択Category外のactive TAGとnormalizedNameが一致する場合、またはtombstoneが同名を予約する場合はCREATEを棄却し、新規ID、REUSE、親変更を行わない。normalizedNameが異なる同義語等を本番validatorが未定義の意味推測で変換・棄却せず、その遵守は固定oracleの実モデル評価で測る。その後に正常候補が1件以上なら、その試行の全正常候補を適用集合にする。残ったCREATEには信頼済みコードが `proposalKey` と `creationRequestId = jobId:proposalKey` を安定生成する。生応答やevidenceTextを含まない `pendingApply` を先に短いtransactionで保存し、attemptをVALIDATEDにする。process loss後はmessageを待たず、このcommandを再検証して再開する。
6. `pendingApply` を使うwrite transactionの冒頭で、同じ候補queryとcurrent base fingerprintを再計算する。一致しなければedgeを1件も変更せず、手順1のstale差替えを同じtransactionで行う。一致した場合だけ `byBookmarkAndLabel` を読み、このJobの正常Tag候補を現在のAI割当集合とする。置換対象はTAG edgeだけとし、以前の成功Job由来で今も `assignedBy=AI` のTAG edgeは、今回の集合にないものだけ論理削除する。残るAI TAG edgeは現在JobのclassificationJobId／confidenceへ更新する。USER／IMPORT／SHAREおよびUSERへ昇格済みのTAG edgeは削除もprovenance上書きもせず、新規AI TAG edgeだけを `assignedBy=AI` とする。既付与REUSEは冪等な正常候補として数える。
7. 適用後に残る全ACTIVE TAGの `parentCategoryId` を重複除外し、ACTIVE CATEGORY edge集合をその親集合へ完全一致させる。派生CATEGORY edgeのprovenanceはUSER、IMPORT、SHARE、AIの寄与順で再計算し、confidence／classificationJobIdをnullにする。BookmarkをCLASSIFIEDにしてrevision、bookmarkRevisions、検索派生データ、accepted／rejected診断を更新し、attemptを `outcome="APPLIED"`, `phase="CLOSED"`、JobをSUCCEEDEDへ変更して `activeAttemptId`、`activeInputKey`、`pendingApply` とexecutor／lease fieldsをclearする。棄却候補が混在していても `PARTIAL_SUCCESS` は作らない。

6〜7を単一トランザクションで行う。途中失敗は全正常候補をrollbackし、JobをSUCCEEDEDにしない。同じlease内のtransaction retryと同じ `pendingApply` の再送では `executionAttempt` を増やさず、モデルも再呼出ししない。lease失効後、executionAttemptが3未満なら所有権再取得claimがexecutorInstanceIdを問わずcounterを増やし、3なら新ownerなしのfinalizerへ進む。どちらも設定state、snapshot stale、pendingApplyを上限判定より先に処理し、モデル出力不正の再試行とは区別する。

### タグ統合

sourceTagの関連を同じ親CategoryのtargetTagへ移し、同じ `(bookmarkId, targetTagId)` が既にあればedgeを1件へまとめ、sourceTagを論理削除する。影響BookmarkのCategory edgeは残存Tag親集合から再計算する。Category統合、カテゴリとタグの間、および異なる親カテゴリに属するタグ同士の統合は拒否する。現行スキーマでは同名の有効タグを作れないため、重複が見つかった場合は旧データまたは破損として隔離し、名称一致だけで自動統合しない。

### カテゴリ／タグの作成・編集・削除

- カテゴリ作成とタグ作成は種類ごとの正規化名一意性を同じtransactionで検証する。Tag作成commandは `name`、ACTIVEな既存 `parentCategoryId`、`expectedParentCategoryRevision`、`creationRequestId` を必須とし、親CategoryのID・kind・deletedAt・revisionを保存直前にも確認する。作成モーダルから連続作成しても各送信に別 `creationRequestId` を使い、同じ送信の再送だけを冪等化する。既存Labelを選択して「作成済み」に数える操作や、既存と同名の新規作成は提供しない。
- Tag作成の親Category autocompleteは空から、Tag編集では現在の親Category ID／revisionを選択済みで開始し、ACTIVE CATEGORYだけを一致度順に最大8件返す。正規化完全一致または候補選択時点で新しいID／revisionをdraftへ設定する。side-viewでCategoryを新規作成する場合はTag draftを永続正本へ書かずUI stateに保持し、`CreateCategory` 成功後に返ったIDとrevisionを選択状態へ設定する。その後の `CreateTag` / `UpdateTag` は別requestとしてcommitし、未知文字列、Category作成失敗・取消・再送でTag draftや親選択を別Categoryへすり替えない。
- Bookmark追加／編集commandは `title`、`url`、`tagIds` だけを分類入力として受け、編集ではさらに`bookmarkId`と期待revisionを必須にする。`categoryIds`とTag自由入力文字列はschema上拒否する。TAG候補は親Category ID付きで最大8件返す。保存時は全tagIdsがACTIVEであることを確認し、Tag edge差分を適用した後、そのBookmarkのCategory edgeをACTIVE Tag親集合と完全一致するよう追加・復元・論理削除する。
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

`warningAcknowledged` がtrueでないrequest、空または形式不正な `expectedImpactFingerprint`、`category-delete:` 以外のrequestId、AI出力、名称だけの指定は拒否する。use case別namespaceによりTag更新の `tag-update:` requestIdやbatch IDとの衝突を防ぐ。実行時は `labels.byParentCategory` から対象Categoryを親とする物理的に存在する全TAGを取得し、ACTIVE／削除済みを含む対象ID集合と、対象Labelを参照する全edge、影響するACTIVE Bookmark集合を固定する。次を `labels`、`bookmarkLabels`、`bookmarks`、`classificationJobs`、`classificationSettings`、`bookmarkRevisions`、`searchDocuments`、P1の `syncOutbox` にまたがる1 transactionで行う。

1. まず `byCascadeDeleteRequestId` でrequestIdの既存利用を確認する。同じCategoryの `cascadeDeleteRequestId` が同じ完了済みrequestなら、ACTIVE状態、期待revision、fingerprintを再検証する前に `alreadyCompleted=true` の冪等成功を返し、追加変更やJob作成を行わない。別CategoryのCategory／子Tagに同じrequestIdがあれば `REQUEST_ID_REUSED` として拒否する。対象Categoryが別requestIdで削除済みなら再削除しない。未完了requestだけCategoryのID・期待revision・ACTIVE状態を検証し、同じtransaction内で現在の影響集合をpreviewと同じcanonical規則で再計算する。`expectedImpactFingerprint` と一致しなければ `CATEGORY_DELETE_PREVIEW_STALE` で1件も変更せず、最新detailによる再警告を要求する。
2. 対象Categoryと全子TAGを同じ削除時刻のtombstoneにする。ACTIVE recordだけrevisionを進め、既に削除済みの子TAGは名前予約と元の削除情報を保つ冪等no-opにする。
3. Categoryまたは子TAGを参照するACTIVE edgeを論理削除し、既存tombstone edgeの再削除はno-opにする。名称一致だけの別Labelや別edgeを対象へ加えない。
4. 影響ACTIVE Bookmarkごとに残ったACTIVE Tag edgeを読み、その親集合へCategory edgeを完全一致させる。Bookmark本体は保持してrevisionを進め、`reason="CATEGORY_CASCADE_DELETE"` のBookmarkRevisionを追加する。classificationSettingsがCONFIGUREDかつaiEnabled=trueなら `classificationState="PENDING"`、それ以外は残存active TAG edgeが1件以上ならCLASSIFIED、0件ならUNCLASSIFIEDとする。
5. 影響Bookmarkの既存PENDING／RUNNING Jobをterminal invariantでCANCELEDにする。classificationSettingsがCONFIGUREDかつaiEnabled=trueの場合だけ、`reason="CATEGORY_CASCADE_DELETE"`、`triggerOperationId=requestId`、Bookmark別の安定 `requestId` を持つPENDING Jobを1件ずつ作る。disabled／再設定待ちは差替えJobを作らない。同一削除requestの再送でJobを増やさない。
6. Category／子TAGのSearchDocumentを無効化し、影響BookmarkのSearchDocumentを新revisionと残存Tag／親Categoryだけから再生成する。Category削除前の分類名を検索へ残さない。
7. 同期対象では同じrequestIdをoperation batch IDとするOutboxを作る。全更新とJob／Outbox作成が成功した時だけcommitし、期待revision不一致、quota、schema不正など1件でも失敗すれば全件rollbackする。

削除後の再分類は通常のAI Hostで処理し、AIをtransaction内やService Workerから呼ばない。モデル未取得／download中／AI Host不在ではPENDINGを保つ。3 dispatchすべてquality-zeroならJob／BookmarkをNEEDS_REVIEW、恒久非対応、executionAttempt上限、またはtechnical failure込みのdispatch枯渇ならFAILEDにする。どの場合もBookmark本体と手動Tagを保持して手動Tag編集を許す。削除前にRUNNINGだったJobの結果はJob state、Bookmark revision、候補LabelのACTIVE状態を再検証して拒否する。子TAG tombstoneは名称を予約したまま同期保持・edge参照・conflict参照が解消してから先に物理GCし、Category tombstoneは物理的な子TAG recordが0件になった後だけ回収する。

### Bookmark削除

`DeleteBookmark` は対象のACTIVE Bookmarkとその全BookmarkLabel edgeのrevisionを進め、`deletedAt` を設定する。同じtransactionで対応するSearchDocumentを削除または無効化し、削除済みBookmarkを通常検索から除外する。1件でも更新できない場合は全件をrollbackし、成功時はUndo tokenを作らず影響件数だけを返す。pending／running分類Jobの結果適用時はBookmarkの `deletedAt` とrevisionを再検証し、削除済みまたはrevision不一致なら正本変更を拒否する。

Bookmarkのfavicon／thumbnail IDはtombstoneに保持する。Blob回収は有効Bookmarkだけでなく未回収tombstoneの参照も数え、同期tombstone保持期間が満了し、全参照とOPEN／CANCELED syncConflictがなく物理回収可能になる前に参照Blobを削除しない。

### 訪問判定とアーカイブ

履歴照会はDB transaction外で行う。訪問リマインダーでは検証済みvisitTimeを期間とreset時刻でfilterして暦日集合へ縮約し、完全なvisit列を永続化しない。Reminderの作成／回答とURL別resetだけを短いtransactionで更新する。アーカイブ判定は `autoArchiveEnabled=true` と実際の `history` 権限を先に確認し、いずれかを満たさなければBookmark transactionを開始しない。権限取消を検出した場合は設定をfalseへ戻してalarmを止める。許可済みでも対象URLの信頼できる訪問日時がなく `lastVisitedAt=null` なら、Bookmarkを変更せず `archiveEvaluationIssues` の `ARCHIVE_HISTORY_NOT_FOUND` だけをupsertする。

訪問日時を得られた項目ではBookmark revisionを再確認し、検証済み `lastVisitedAt` が設定期間を超えた `ACTIVE` だけを `ArchivedBookmarkRecord` へ置換する。置換前に有効edgeからカテゴリ／タグのID・表示名・親カテゴリIDを固定し、ページ名とURLを加えた最小スナップショットだけを残す。既にARCHIVED、更新競合の項目は自動変更しない。Bookmark置換、関連edgeの論理削除、BookmarkRevision、archiveOperations、対応するOPEN evaluation issueのRESOLVED化、同期Outboxを同じtransactionへ含める。理由・時刻・revision等は利用者payloadではなくarchiveOperationsへ書く。

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
- Bookmark追加／編集のTag欄はACTIVE TAGだけ、Tag作成／編集の親Category欄はACTIVE CATEGORYだけをリアルタイム一致度順に最大8件返す。Category候補はID、name、revisionを持ち、nested side-viewの `CreateCategory` 成功結果も同じ選択型へ変換する。TAG候補には親Categoryを必ず含める。Bookmark追加／編集に独立したCategory入力欄は設けず、候補へ解決できない文字列をIDとして扱わない。
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

AI設定のsource allowlistは次だけとする。判定はraw objectのown propertyに対して行い、既存の `migrateLocalSettings` を通さない。同helperは欠損schemaVersionを1、不正aiGranularityを0へ補うため、移行判定に使うと欠損／破損の区別を失う。

| source形式 | 必須条件 | revision 1への変換 |
| --- | --- | --- |
| `LOCAL_SETTINGS_V1` | `schemaVersion` が数値1、`settingsSchemaVersion` と `aiEnabled` はMISSING、`aiGranularity` はown propertyの整数0〜4 | v1にAI無効化設定がなかったため暗黙enabled。下表で同じslider位置をv2へ移す |
| それ以外 | version欠損／未知、`settingsSchemaVersion` または `aiEnabled` の存在、granularity欠損／不正を含む | RECONFIGURATION_REQUIRED、aiEnabled=false、granularity／policy=null |

| v1 granularity | v2 reusePolicy | v2 allowedCreateImportance |
| ---: | --- | --- |
| 0 | `STRONG_REUSE` | `CORE` |
| 1 | `PREFER_REUSE` | `CORE` |
| 2 | `BALANCED` | `CORE`, `MAJOR` |
| 3 | `NEAR_EXACT_REUSE` | `CORE`, `MAJOR`, `SUPPORTING` |
| 4 | `EXACT_EQUIVALENT_REUSE` | `CORE`, `MAJOR`, `SUPPORTING`, `DETAIL` |

この対応はgranularityの相対的なslider位置だけを引き継ぎ、旧 `maxNewTags` の件数上限や値0のCREATE禁止をv2へ持ち込まない。正常なLOCAL_SETTINGS_V1でもgate snapshotのaiEnabledは `MISSING` のまま保存し、capture後にtrueへ書き換えない。

1. 破壊的変更前にエクスポートを用意し、旧Storeをただちに削除しない。
2. 旧平坦 `labels` を読める新旧両対応Readerを先に導入し、`parentCategoryId` と親索引を追加した新documentへ移す。Label名をproject-vendored Unicode 15.1.0 dataのv1で再正規化し、`nameNormalizationVersion=1`、`unicodeVersion="15.1.0"`、実assetから生成したSHA-256を記録する。`byCategoryUniqueName`、`byTagUniqueName`、一意な `byCreationRequestId` を作る前に、論理削除済みも含めた重複と禁止文字を検出する。
3. 旧カテゴリは `parentCategoryId=null` とする。同名カテゴリが複数ある場合は自動削除せず競合一覧を作り、利用者が正本を選ぶまで `NEEDS_REVIEW` とする。
4. 旧TAGには親が存在しないため、既存Bookmarkとの共起、旧データの由来、利用者選択から親カテゴリを1件決める。確定できないTAGは自動で架空カテゴリへ寄せず、隔離して `NEEDS_REVIEW` とする。同じnormalizedNameの旧TAGが複数ある場合も自動削除・統合せず、改名または正本選択まで隔離する。
5. BookmarkLabelは `Label.kind` で再判定し、Bookmarkごとに有効TAG edgeの親集合を求め、ACTIVE CATEGORY edgeをその集合へ完全一致するよう追加・復元・論理削除する。同じ `(bookmarkId, labelId)` が複数あれば最新の有効状態と監査情報を残して1件にまとめ、その後 `byBookmarkAndLabel` unique索引を作る。
6. 各Labelへ安定した `creationRequestId` を割り当てる。移行値は既存IDから `migration:<labelId>` のように決定的に生成し、再実行で変えない。空の `tagMutationReceipts` Storeを追加し、過去のTag編集requestIdを推測してreceiptを捏造しない。
7. 旧DBを検出したService Workerは、classificationSettingsに依存するcommand／background処理を受け付ける前に前述の排他キューを取得する。durable gateがなければ旧 `chrome.storage.local` のraw objectから `schemaVersion`、`settingsSchemaVersion`、`aiEnabled`、`aiGranularity` を1回だけ型付きcaptureし、canonical JSON v1 hash、migrationId、`state=CAPTURED` と同じstorage writeで保存する。既存gateがあれば現在の旧fieldを再読込せず、そのsnapshotから再開する。上記allowlistを満たすLOCAL_SETTINGS_V1だけをCONFIGURED候補とし、それ以外はRECONFIGURATION_REQUIRED候補にする。この時点では新Storeへ書けないため `classificationSettings` recordやv2 Jobをまだ作らない。gateが消えるまで分類設定に依存する処理は何もcommitしない。
8. version別decoderを先に導入してからIndexedDBのversionchangeを行い、`classificationSettings` Storeと `byActiveInputKey` unique indexを作る。既に試作版のv2 active recordがある場合は、重複した旧keyでindex作成がabortしないよう、同じversionchange transaction内で旧 `activeInputKey` propertyだけを外す。version 1 recordにはkeyを付けない。index／Store作成前にclassificationSettings recordや新しいv2 Jobを作らない。
9. upgrade完了後のdata migrationはdurable gateのsnapshot hashを再計算し、一致した場合だけreadwrite transactionを開始する。手順7の判定からrevision 1のclassificationSettings recordを作り、LOCAL_SETTINGS_V1はCONFIGURED、aiEnabled=true、captured granularity由来policyを保存し、それ以外はRECONFIGURATION_REQUIRED、aiEnabled=false、granularity／policy=nullとする。同じtransactionで試作版v2およびversion 1のPENDING／RUNNING JobをCANCELEDへ移し、terminal v1 Jobは監査専用で保持する。CONFIGUREDかつenabledの場合だけ、旧Job取消と、現在のBookmark revision、Label snapshot、classificationSettings正本からのversion 2 Job get-or-createを同じtransactionで行う。RECONFIGURATION_REQUIREDでは旧Job取消とBookmarkをactive TAG edgeありならCLASSIFIED、なしならUNCLASSIFIEDへ戻す更新だけを行い、v2 Jobを作らない。request IDは `classification-v2-migration:<legacyJobId>:<newInputFingerprint>` として安定生成し、classificationSettingsの `lastMutationRequestId` は `classification-settings-migration:<migrationId>`、`lastMutationFingerprint` はgateの `snapshotSha256` とする。再実行時にこのIDとfingerprintが一致する既存commitを再利用し、revisionやJobを増やさない。`byActiveInputKey` も照合して、別の旧Jobから同じBookmarkを移行しても現在snapshotのactive Jobを1件にする。IDB commit後だけgateをIDB_COMMITTEDへ進め、migration ownerが正本からchrome.storage.local mirrorを修復・照合してgateを削除するまで他の設定依存処理を解放しない。
10. 旧訪問回数閾値を訪問日数へ変換せず、`frequentVisitDayThreshold=null` とする。`archiveAfterDays` の欠損／不正値は30、`autoArchiveEnabled` の欠損はfalseへ移し、旧「toggleなし」状態や保存済みhistory権限だけから自動的にtrueへしない。
11. 旧ARCHIVED Bookmarkは `metadata` と `payload { title, url, categories, tags }` を構造上分けた最小スナップショットへ変換し、favicon、thumbnail、訪問統計等をpayloadへ残さない。理由・時刻・revision等はarchiveOperationsへ分離し、復元テストが通るまで旧値を回収しない。
12. `searchDocuments` を親カテゴリ情報付きでバッチ再構築し、`migrationCursor` に完了位置を保存する。lastKeyはJSON round-trip可能な文字列、有限数、またはそれらだけの一次元配列へ限定し、表現できないkeyには別のversion付きcursor形式を定義する。
13. 件数、参照整合、カテゴリ作成元、全TAGの親CATEGORY record存在、ACTIVE TAGのACTIVE親、BookmarkのACTIVE CATEGORY edgeとACTIVE Tag親集合の完全一致、edge一意性、activeInputKey一意性を確認してから新Readerへ切り替える。旧平坦フィールドは少なくとも1リリースの復旧期間後に別バージョンで削除する。

変換は冪等にし、Object Store・索引変更と大量レコード変換を分ける。失敗時はUIに状態と復旧方法を示し、旧バージョン、空DB、カテゴリ名競合、タグ名競合、親不明タグ、複数カテゴリ／タグ、最大想定件数、途中中断でテストする。

未実装のため、マイグレーション成功を保証するものではない。

## QR／CSV共有payload

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

QRとCSVは、export開始時に固定した同じBookmark ID集合と内容revisionのfingerprintを入力にする。QRはJSON payloadの実encoded bytesを選択済みversion／error-correction／文字modeのencoderで事前検査する。容量内でのみ1つのQRを生成し、容量超過またはencoder overflowでは `QR_CAPACITY_EXCEEDED` を返してQR fragmentを1つも生成しない。切捨てと分割QRは行わず、UIは同じselection fingerprintを保持した `CSVでエクスポート` commandへ誘導する。

CSV export v1はUTF-8、header付き、1 Bookmark 1行で、列順を次へ固定する。

~~~text
formatVersion,title,url,categoriesJson,tagsJson
~~~

- `formatVersion` は文字列 `BOOKMATION_CSV_1` とする。
- `categoriesJson` はCategory名のJSON配列、`tagsJson` は `{ "name": string, "parentCategoryName": string }` のJSON配列を、1つのCSV fieldとしてRFC 4180相当のquote規則でescapeする。
- titleと各出力fieldが `=`, `+`, `-`, `@`, tab, CR, LFの危険な先頭文字で始まる場合は、表計算ソフトの数式として評価されないようexport表示値をneutralizeする。元のBookmark正本は変更しない。
- ローカルID、訪問履歴、Blob、AI会話、OAuth情報、論理削除済みBookmarkを含めず、exportはブラウザ内で完結させる。CSV importはこの契約に含めない。

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
- AI経路からカテゴリを新規作成・改名・削除できず、1試行で既存Categoryを厳密に1件選ぶ。タグ新規作成はグローバルなタグ名一意性、選択Category、信頼側生成 `creationRequestId` の冪等性を満たす。policy version 2の5組以外を拒否し、Tag件数上限を設けない。選択Category内の同じnormalizedNameはoriginを問わず再評価してUSERを優先し、別Categoryの同じnormalizedNameはREUSE／CREATE／親変更しない。異なるnormalizedNameの同義語等はGemini NanoへREUSE／省略を指示し、固定oracleの実モデル評価で品質判定するが、本番validatorが未定義の意味推測でID操作しない。構造、親、revision、importance、根拠、名前の不正candidateだけを棄却し、正常候補1件以上なら全正常候補を原子的に適用してSUCCEEDEDとする。3 DISPATCH_RESERVEDすべてquality-zeroの場合だけNEEDS_REVIEW、technical failure込みのdispatch枯渇、executionAttempt枯渇、恒久非対応、input過大はFAILEDとなる。all-active-labels-v1の入力／応答byte境界と永続attempt tokenを検証する。
- 新規installのclassificationSettingsはrevision 1、CONFIGURED、AI有効、granularity 2、BALANCEDである。旧設定移行はraw LOCAL_SETTINGS_V1のschemaVersion=1、settingsSchemaVersion／aiEnabled欠損、整数granularity 0〜4だけをallowlistし、暗黙enabledと同じslider位置のv2 policyへ移す。それ以外はRECONFIGURATION_REQUIREDとする。durable gate存在中は全設定read／writeと分類設定依存command／background処理を無変更で待機させ、CAPTURED／IDB_COMMITTED各crash、mirror失敗、外部storage改変から同じsnapshotで冪等に回復する。Job.settingsVersionは常に同じIDB transactionで読んだ正本revisionと一致し、disabled／再設定待ちはfingerprintを作らず新規／差替えJobも作らない。
- autocompleteは種類・親情報付き候補を一致度順に最大8件だけ返す。1つの自然言語検索はLabel / Bookmarkの無順位候補集合を返し、AIが候補外ID、重複ID、古いrevisionを混入させても拒否する。
- favicon BlobはfaviconBlobIdから参照でき、参照中のBlobを回収しない。外部favicon URLを一覧表示のたびに自動読込しない。
- AI失敗時もBookmarkが残る。
- AI Hostを途中で閉じ、次の対応ページでJobを再開しても重複タグを作らない。
- Service WorkerからLanguageModelを実行せず、PENDING JobはAI Hostが開くまで保持される。
- URL hash衝突でも異なるURLを誤って同一扱いしない。
- Bookmark追加／編集で選択した0件以上のactive Tag IDだけがedgeになり、不在／非TAG／inactive IDまたは自由入力文字列が1件でも含まれる場合はBookmark、edge、Jobを部分保存しない。Category edgeは選択Tagのactive親集合と完全一致する。
- 設定破損でIndexedDBを初期化しない。onboardingStateはinstall時だけ初期化され、途中stepと完了状態をupdate／startup／Service Worker再起動後も保持する。
- Category template catalogを表示しただけではLabel件数が変わらない。明示適用した候補だけが `origin=USER` Categoryとして作成され、同じ適用request、onboarding再開、update／reloadで重複せず、既存／tombstone同名は通常の一意性エラーになる。
- `archiveState` が文字列 `ACTIVE` / `ARCHIVED` で保存され、ARCHIVEDはmetadataと `payload { title, url, categories, tags }` が分離され、設定から復元できる。`archiveAfterDays` の新規／移行既定は30、`autoArchiveEnabled` の既定はfalseである。history実権限がある時だけtoggleをONへcommitでき、拒否／取消時はfalseのまま、後発取消時もfalseへ戻ってalarmが停止する。履歴なし項目は変更せずOPENな `ARCHIVE_HISTORY_NOT_FOUND` として表示でき、notificationsを要求しない。
- 訪問日数閾値の既定値はnullであり、訪問期間3種と日数閾値の有効な組だけを受理する。期間変更時は閾値をnullへ戻して判定を停止する。同日複数訪問を1日にまとめ、同じURLのReminderを重複生成せず、利用者が `はい` を選ぶまでBookmarkを作らない。`いいえ` は応答前の訪問日を次回集計から除外し、「次回以降表示しない」はグローバル設定を変えずそのURLを再候補化しない。
- Bookmark／Tag削除は確認画面なし、Category削除は影響件数を示す警告確認済みrequestだけで対象IDと期待revisionを検証する。1件でも失敗したら全件をrollbackし、Undo tokenや利用者向け復元導線は作らない。削除済みLabelのunique keyは物理GCまで名称を予約し、その間は同名別IDを拒否して別名だけを許可する。Bookmark削除でSearchDocumentを同時に除外し、参照Blobは同期tombstone保持と参照解消が済むまで回収しない。
- Category連鎖削除requestIdは1つのCategoryだけに結び付ける。同じCategoryの完了済みrequest再送はACTIVE／revision／fingerprint検証より先にno-op成功へ収束し、別Categoryでの再利用を拒否する。新規requestでは警告snapshotの `impactFingerprint` をtransaction内で再計算し、不一致なら再警告して無変更とする。一致時だけCategory、ACTIVE／削除済み全子TAG、関連edgeを冪等にtombstone化し、影響ACTIVE Bookmarkを保持する。残存TagからCategory closureと検索文書を再計算し、Bookmark revisionを進め、旧RUNNING結果を拒否する。classificationSettingsがCONFIGUREDかつenabledの場合だけ削除request起点のPENDING再分類JobをBookmarkごとに1件作り、未準備時PENDING、3 quality-zeroでNEEDS_REVIEW、恒久非対応／technical／実行枯渇でFAILEDとする。disabled／再設定待ちはJobを作らず残存active Tag有無でCLASSIFIED／UNCLASSIFIEDとする。常に手動Tag編集を許し、子TAG tombstoneを先に、Category tombstoneを最後に物理GCする。
- QRとCSVは検索・チェック選択を同じ固定Bookmark集合へ展開する。QRは実encoderで容量検査し、超過時はfragmentを生成せず `QR_CAPACITY_EXCEEDED` とCSV actionを返し、分割・切捨てを行わない。CSV v1は固定header・1 Bookmark 1行・UTF-8で、構造列をJSON fieldとしてescapeし、数式注入をneutralizeして秘密情報を含めない。checksumを真正性保証に使わない。QR読取Importで破損、過大、カテゴリ／タグ名競合、親不明タグを適用前に拒否または確認へ送り、payload内部の同名TAG・複数親はpreview前に拒否する。既存の別親同名TAGは自動reuse／rename／moveせず、skip／cancelまたは明示別名後の全件再previewだけを許す。CSV importは要求しない。
- 標準Bookmarkインポートは、`A/B/ページ` から直上Folder `B` だけを1件のTagへ解決し、祖先／full path／AI Tagを付与しない。同名active Tagは再利用し、新規Tagは利用者が選択／作成したactive親Categoryでだけ作る。空／不正Folder名とtombstone同名はskip／cancelへ送り、元データを書き換えず、中断・再送後もBookmark／Tag／edgeの重複を抑止する。
- タグ統合と大量edge更新が途中失敗時に部分適用されない。
- Drive同期で同じscalar、同じTagの異なる親変更、同じedgeのadd/delete、update/delete、一意名競合をLWWせず、検証済みimmutable syncSnapshotsとsyncConflictsへ保存する。Tag親競合は `TAG_PARENT_DIVERGED` とし、採用する親を明示した後に全参照Bookmarkのclosureを原子的に再計算する。Category連鎖削除は同じoperationBatchIdの全変更を一括適用し、欠落または子Tag／関連Bookmarkの同時更新は `CATEGORY_CASCADE_DIVERGED` として部分適用しない。解決は期待conflict／snapshot revision・hashと非空の明示operation listを照合し、全不変条件再検証後だけatomic commitする。同名／異親TAGや競合したLabel IDを暗黙remapしない。OPEN／CANCELED conflictのsnapshotはGCされず、RESOLVED後も30日以上かつ全参照消滅まで保持される。削除、同時名称変更、オフライン復帰も再現できる。

すべて実装後に検証する項目であり、現時点では未確認である。
