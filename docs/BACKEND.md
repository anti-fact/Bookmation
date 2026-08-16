# バックエンド設計

## 文書の位置づけ

- 状態: **提案・未実装**
- MVP形態: リモートサーバーを持たない、Chrome拡張機能内のアプリケーション層
- 関連: [全体設計](./DESIGN.md) / [DBスキーマ](./DB-SCHEMA.md) / [フロントエンド](./FRONTEND.md) / [セキュリティ](./SECURITY.md) / [制約](./CONSTRAINTS.md)

独立したリモートサーバーは置かず、Manifest V3 Service Worker、アプリケーションサービス、Repository、トップレベル拡張ページ内のAIアダプターをTypeScriptで実装する。

## MVPでサーバーを置かない理由

- P0は端末内AIとローカル保存を中心にする。
- 拡張機能専用ブックマークをローカルで扱う確定要件と整合する。
- ハッカソンMVPでアカウント、認証、サーバー運用、データ保護範囲を増やさずに済む。
- AIが使えない場合も手動分類へフォールバックできる。

これは将来のサーバーを禁止する判断ではない。リアルタイム共同編集、組織管理、クロスブラウザ同期が必要になった場合に再検討する。

## レイヤー構成

| レイヤー | 主な責務 | 依存してよいもの |
| --- | --- | --- |
| Domain | エンティティ、不変条件、値オブジェクト | 標準TypeScriptのみ |
| Application | ユースケース、トランザクション、認可判断 | Domain、Port |
| Ports | Repository、AI、時計、ID生成、同期の契約 | Domain |
| Adapters | IndexedDB、Chrome API、Google Drive。Prompt APIアダプターはAI Host Documentだけ | Ports、外部API |
| Entrypoints | Service Workerのイベント、UIメッセージ、AI Host Document | Application |

外部APIのレスポンス型をDomainへ持ち込まない。Chrome固有エラーはアプリケーションエラーへ変換する。

## 主要ユースケース

| ユースケース | 入力 | 結果 |
| --- | --- | --- |
| SaveCurrentTab | URL、タイトル、ファビコン、任意サムネイル | 保存済みBookmarkと分類Job |
| SaveBookmarkByUrl | ユーザーが入力したURL、任意タイトル | 保存済みBookmarkと分類Job |
| OpenDashboardHome | popupまたはショートカットの要求 | 最近追加したBookmarkを表示する拡張機能ページ |
| CreateUserLabel | 名称、カテゴリ／タグ、作成要求ID | Label。カテゴリ作成はこのユーザー操作だけ |
| UpdateBookmark | bookmarkId、revision、名前、URL、Label ID集合 | 検証済みのBookmarkと関連 |
| DeleteBookmark | bookmarkId、revision、確認済み要求 | 論理削除結果 |
| ClassifyBookmark | bookmarkId、細分化設定 | 既存分類割当または検証済みの新規タグ |
| ReclassifyBookmark | bookmarkId、ユーザー指定のLabel ID集合 | 新しい分類と監査記録 |
| SearchAllNaturalLanguage | 自然言語、件数上限 | 無順位のLabel候補集合とBookmark候補集合 |
| SearchAllByKeyword | キーワード、カーソル | Label候補とBookmark候補。Labelを先に返す |
| ChangeArchiveState | bookmarkId、利用者が明示した状態 | P0の手動アーカイブまたは復元後のBookmark |
| EvaluateFrequentVisits | 履歴集約値、訪問閾値 | 未保存URLの重複しないReminder |
| HandleVisitReminder | reminderId、保存／あとで／表示しない | 保存結果または次回通知状態 |
| ArchiveInactiveBookmarks | 最終訪問日時、設定日数 | 文字列archiveStateを更新したBookmark集合 |
| ImportChromeBookmarks | 確認済み選択、Import Job | 元データを変えない取込結果 |
| SaveFromContextMenu | pageUrlまたはlinkUrl | 共通保存ユースケースの結果 |
| ExportQr / ImportQr | 確認済みBookmark集合／QR文字列 | 版付きpayloadまたは検証済み取込結果 |
| SyncGoogleDrive | 明示接続、Outbox、remote revision | 同一ユーザー端末間の同期状態と競合 |
| MergeLabels | sourceLabelId、targetLabelId | 付替え件数と結果 |
| DeleteLocalData | 確認済みスコープ | 削除結果 |

P0はローカル保存・分類・検索を先に完成させる。訪問リマインダー、自動アーカイブ、QR共有、Drive同期、標準Bookmarkインポート、context menu保存はP1の確定ユースケースであり、採否は未決ではない。P1の既定値や競合UIだけを未決事項として扱う。

## Portインターフェース案

以下は責務を示す擬似TypeScriptであり、実装済みAPIではない。

~~~ts
interface BookmarkRepository {
  save(bookmark: Bookmark): Promise<void>
  findByNormalizedUrl(url: string): Promise<Bookmark | null>
  listRecent(query: RecentBookmarkQuery): Promise<CursorPage<Bookmark>>
}

interface LabelRepository {
  createUserLabel(command: CreateUserLabelCommand): Promise<Label>
  listCandidateLabels(): Promise<Label[]>
}

interface BookmarkLabelRepository {
  applyClassification(result: ValidatedClassification): Promise<void>
}

interface SearchRepository {
  findLexicalCandidates(query: ValidatedSearchPlan): Promise<SearchCandidate[]>
}

interface ClassificationProvider {
  capability(): Promise<AiCapability>
  classify(input: ClassificationInput): Promise<UnknownClassificationOutput>
}

interface NaturalLanguageSearchProvider {
  plan(input: NaturalLanguageQuery): Promise<unknown>
  selectLikely(input: SearchCandidateSet): Promise<unknown>
}

interface HistoryPort {
  searchVisits(query: HistoryQuery): Promise<UnknownHistoryItem[]>
}

interface NotificationPort {
  showVisitReminder(reminder: VisitReminder): Promise<void>
}

interface SyncPort {
  pull(cursor: SyncCursor | null): Promise<unknown>
  push(operations: SyncOperation[]): Promise<unknown>
}

interface UnitOfWork {
  run<T>(stores: StoreName[], operation: () => Promise<T>): Promise<T>
}
~~~

ClassificationProviderとNaturalLanguageSearchProviderはトップレベルのAI Host Document内だけで生成・呼び出す。戻り値はあえてUnknown相当として受け、ホスト側のアダプター境界で外形JSONスキーマを検証する。Service Worker側アプリケーション層でも候補IDとDomain不変条件を再検証し、AI出力を信頼済みDomainオブジェクトとして直接受け取らない。

## 保存処理

### 入力

Bookmark保存には2つの入力経路を設け、同じ検証・正規化ユースケースへ合流させる。

現在のタブから保存する場合は、ユーザー操作で許可された次の情報に限定する。

- URL
- ページタイトル
- サイト名
- ファビコンURLまたは取得済みBlob
- ユーザー設定で有効な場合のサムネイル

URL指定で保存する場合はURLと任意タイトルを受け取る。`http` / `https` 等の許可スキーム、文字数、構文、正規化結果を検証し、ページメタデータ取得のために広いhost permissionや暗黙の外部fetchを追加しない。取得できないタイトルは検証済みhost名等の安全な代替表示にする。

ページ本文をAIへ渡すことはMVPの既定動作にしない。分類精度のため本文が必要になった場合は、取得範囲、保存有無、権限、プライバシー表示を別途設計する。

### popupとショートカット

- 拡張アイコンのpopupは「今開いているページを保存」と「Bookmationホームを開く」の2操作を表示する。
- Manifestのcommandsには、現在タブ保存用とホーム表示用を別々に宣言する。受信したService Workerはコマンド名をallowlistで検証する。
- ホーム表示は拡張機能内URLを開き、既定で `savedAt` 降順の最近追加一覧を表示する。同じホームが既に開いている場合に再利用するか新規タブにするかはUI実装で固定する。
- popup、commands、DashboardのURL入力は別Entrypointだが、Bookmark作成、重複確認、Job永続化を重複実装しない。
- popupは `chrome.commands.getAll()` で2 commandの現在キーを取得し、空なら未割り当てとして返す。キー変更はChromeの管理画面で利用者が行い、拡張機能内に更新APIを仮定しない。

### 重複

- URLを正規化し、urlHashの索引で候補を探す。
- 完全一致があれば既存レコードを返し、無言で複製しない。
- hash衝突に備え、候補取得後にnormalizedUrlを比較する。
- URL正規化規則をバージョン管理し、規則変更だけで既存IDを変えない。
- 完全一致の既存Bookmarkへは複数のカテゴリ／タグを追加できるため、分類ごとにBookmark本体を複製しない。

### トランザクション

Bookmark保存とClassificationJob作成を同じIndexedDBトランザクションで行う。AI呼び出しはDBトランザクション外で実行し、長時間ロックしない。

1. Service Worker側でBookmarkとJobをpendingで保存する。
2. トランザクションを完了し、Bookmark保存成功を返す。
3. 対応を実証したトップレベル拡張ページが開いたとき、可用性を確認し、必要なユーザー操作とモデル準備を行う。
4. AI HostがJobをclaimし、そのページ内でAIを呼ぶ。
5. AI Hostが外形検証済み結果をService Workerへ送り、新しい短いトランザクションでDomain再検証、Tagと関連の更新を行う。
6. 失敗時はJobだけをfailedまたはneeds_reviewへ更新し、Bookmarkを残す。

## AI分類サービス

### Provider境界

Chrome Prompt API / Gemini Nano候補を、分類と自然言語検索で共有するChromePromptProvider境界の後ろに置く。Chrome Prompt APIのLanguageModelはWeb Workerから利用できないため、このProviderをManifest V3 Service Workerで生成・実行してはならない。

Providerは、対応を実証したトップレベル拡張機能ドキュメント内だけで生成する。DashboardとSide Panelを候補とし、正確なホスト、Prompt APIのメソッド、可用性、モデル準備、ユーザーアクティベーション、対象Chrome、配布要件は [ISSUE-001](./ISSUES.md) の技術スパイクで確認する。Offscreen Document対応を仮定せず、現時点では動作確認済みとしない。

将来、明示的なユーザー同意がある場合だけRemoteAiProviderを追加できる構造にする。MVPでは実装しない。

### AI Hostの実行手順

1. AI Host候補のトップレベル拡張ページが可視状態で開く。
2. LanguageModelの可用性を確認し、利用不可、モデル取得可能、準備中、利用可能をUI状態へ変換する。
3. モデル取得にユーザー操作が必要なら、説明付き操作から開始する。
4. CLAIM_CLASSIFICATION_JOBメッセージでPENDING Job、Bookmark入力、候補ID、設定を取得する。
5. Service Worker側がleaseとbookmarkRevisionを保存してJobをRUNNINGへ変更する。
6. AI Host内でセッションを作成し、分類を実行して外形スキーマを検証する。
7. APPLY_CLASSIFICATION_RESULTメッセージで結果、jobId、bookmarkRevision、requestIdを返す。
8. Service Worker側が候補IDとDomain規則を再検証し、短いIndexedDBトランザクションで適用する。
9. ページが閉じた場合はlease期限後にPENDINGへ戻し、次のAI Host起動時に再試行する。

AIセッション自体をIndexedDBやchrome.storage.localへシリアライズしない。

### 分類入力

- bookmarkIdではなく分類に必要な表示情報
- 選択可能なユーザー作成カテゴリのIDと表示名
- ユーザー作成タグを先頭にした既存タグ候補
- AI作成済みタグ候補
- 細分化度と新規タグ上限
- 出力JSONスキーマ

IDと名称を分け、AIが返した表示名だけで既存レコードを特定しない。同名候補は省略せず別IDで提示する。

### 優先順位

1. 意味が合う既存のユーザー作成カテゴリを0件以上選ぶ。
2. 正規化名または意味が合う既存のユーザー作成タグを優先する。
3. 適切なユーザー作成タグがなければ既存のAI作成タグを再利用する。
4. 適切な既存タグがなく、細分化設定で許可される場合だけ新しいタグを提案する。

AIはカテゴリを新規作成・改名・削除できない。既存カテゴリを選ぶ場合も列挙したID以外は拒否する。カテゴリの正規化名は一意とし、同名作成要求は既存カテゴリを返す。タグは同名の別IDを許し、名称一致だけで自動統合しない。

### 細分化

- 細分化スライダーはAIが新規作成できるタグの上限と、割当候補の細かさへだけ影響する。どの値でもカテゴリは新規作成しない。
- 「既存のみ」では新規タグを作らず、既存Labelだけで分類する。適切な候補がなければneeds_reviewまたは分類なしで保存する。
- 新規タグ提案にはJob内で一意な `proposalKey` を持たせ、`creationRequestId = jobId:proposalKey` で再送を冪等にする。同名タグを意図して追加する別Jobは別IDとして作成できる。
- 既存Label割当数、新規タグ数、名称長を別々に上限検証する。上限値は設定バージョンとJobへ固定する。
- 低信頼度や候補が拮抗した場合は複数候補をneeds_reviewへ返し、名称だけで1件に決めない。

### 検証

- JSON以外を拒否する。
- 未知のプロパティを拒否または破棄する方針を固定する。
- 文字数、文字種、配列件数を制限する。
- URL、HTML、Markdownをタグ名として許可しない。
- 既存Label ID、Label.kind、Label.origin、Bookmark revision、件数上限をDomainで再検証する。
- 新規Labelはタグを表す `kind=TAG` だけを許し、カテゴリ作成を示す出力は拒否する。
- 同じ `(bookmarkId, labelId)` は1つのedgeへ収束させ、AI再送で関連を複製しない。
- AI出力からChrome API、ネットワーク、削除、共有を実行しない。

## 自然言語検索サービス

1つの自然言語入力からLabelとBookmarkを同時に検索し、`labels` と `bookmarks` の2集合をこの順で返す。候補は「可能性が高い集合」であり、順位、スコア、最上位という契約を持たない。候補が複数でも1件へ勝手に確定しない。各候補は `entityType`、`entityId`、`entityRevision`、照合項目を持つ。

### 実行手順

1. Dashboard内のAI Hostが自然言語と種類ごとの件数上限を検証する。
2. Prompt APIが利用可能なら、AI Host内で検索意図を固定JSONスキーマの語句へ展開する。利用できなければ入力文字列をそのまま正規化する。
3. Service Worker側が語数・長さを再検証し、LabelとBookmarkの字句候補集合を上限付きで取得する。Bookmark候補では一致Label IDからBookmarkLabel edgeもたどる。
4. AI Hostは提示された候補から可能性が高いID集合だけを選ぶ。AIへ候補外の作成・検索・外部アクセスを許可しない。
5. Service Worker側がID、対象種別、revision、重複、件数を再検証し、種類ごとの中立な決定的順序で最新レコードを返す。AIの配列順を関連度として保持しない。

検索語、展開語、AIの自由文理由は既定でIndexedDB、chrome.storage.local、ログへ保存しない。自然言語検索はDashboardが開いている間だけ実行し、永続Jobにはしない。ページを閉じた場合は安全に中断し、分類Jobや保存済みBookmarkを変更しない。

Prompt APIが利用不可、モデル準備中、不正出力の場合も、字句検索で複数候補を返せるようにする。AI検索を使えないことと、検索結果が0件であることを同じ状態にしない。

## 統合キーワード検索

ブックマーク一覧とカテゴリ一覧は同じ `SearchAllByKeyword` を呼ぶ。RepositoryはLabel候補とBookmark候補を別カーソルで取得し、レスポンスでは `labels` を先、`bookmarks` を後に固定する。入口画面によって対象を狭めない。AI検索も同じ結果Envelopeを使うため、UIは常にカテゴリ・タグを上、Bookmarkを下に表示できる。

## Service WorkerとAI Hostのライフサイクル

Manifest V3 Service Workerは処理の途中でも停止し得る。また、LanguageModelはWeb Workerで利用できない。このためService WorkerはBookmarkとPENDING Jobの永続化、lease管理、入力準備、結果のDomain検証・適用だけを担当し、可用性確認、モデル取得、AIセッション作成、prompt実行を行わない。

### 永続ジョブ

ClassificationJobは次の状態を持つ。

- pending
- running
- succeeded
- failed
- needs_review
- canceled

AI Hostがclaimしたときにpendingからrunningへ条件付き更新し、attemptとleaseを記録する。一定時間runningのままならAI Hostが閉じた可能性があるため中断と判断し、入力フィンガープリントとbookmarkRevisionが同じ場合だけ次のAI Hostで再試行できるようにする。

### 冪等性

- SaveCurrentTabとSaveBookmarkByUrlはnormalizedUrlと保存要求IDで重複を抑止する。
- ClassifyBookmarkはbookmarkId、分類対象のupdatedAt、設定バージョンからfingerprintを作る。
- 同じfingerprintの成功済みJobを再適用しない。
- カテゴリ名は正規化名で一意、タグ名は重複可とする。同じユーザー操作または同じAI proposalの再送は同じLabelを返し、意図した同名タグの追加は新しい要求IDを使う。
- BookmarkLabelは `(bookmarkId, labelId)` の一意索引で1件へ収束させる。
- メッセージの再送をエラー扱いにしない。

### 状態復元

- Service WorkerまたはAI Host接続時に期限切れrunning Jobを少数ずつ確認する。Service Worker自身は再分類を実行せず、再試行可能なJobをpendingへ戻すだけにする。
- UI接続時にも該当Bookmarkの最新状態をRepositoryから返す。
- インメモリキュー、タイマー、シングルトンだけに重要状態を置かない。
- P0では定期実行を要求しない。P1の訪問／自動アーカイブでは名前付きalarmを起動時に冪等確認し、遅延や端末sleep後のまとめ実行を許容する。
- AI Hostが開いていなければpendingのまま保持し、手動保存・検索・編集を妨げない。

## 保存アダプター

### IndexedDB

ブックマーク、分類ラベル、関連、分類ジョブ、訪問リマインダー、Import Job、同期Outbox、検索用派生文書を、JSON互換ドキュメントとして保存する。Blobだけは別Storeへ分離する。スキーマと索引は [DBスキーマ](./DB-SCHEMA.md) に定義する。

### chrome.storage.local

以下の小さな設定だけを保存する。

- aiEnabled
- aiGranularity
- viewMode
- thumbnailEnabled
- frequentVisitReminderEnabled
- frequentVisitThreshold
- autoArchiveEnabled
- archiveAfterDays
- settingsSchemaVersion

ブックマーク本体をchrome.storage.localへ二重保存しない。

## Chrome権限

P0の初期候補は storage と activeTab である。commandsはManifest宣言として「現在タブを保存」「ホームを開く」の2ショートカットを定義する。IndexedDB自体に拡張権限は不要である。

- P1の右クリック保存では `contextMenus`、定期判定では `alarms` を宣言する。
- `history` と `notifications` は訪問／アーカイブ機能を有効化する説明UIから要求し、拒否時は機能をオフのままにする。
- `bookmarks` は標準Bookmarkインポート開始時だけ要求し、読取専用のアダプターから作成・更新・削除メソッドを公開しない。
- Google Drive接続では `identity` とOAuth設定を追加し、`drive.appdata` scopeだけを要求する。
- scripting、tabs、広いhost_permissionsは必要性を技術スパイクで実証してから追加する。
- サムネイル取得がactiveTabだけで成立するかを検証し、不足する場合は機能縮小を先に検討する。

正確な権限は実装・Chrome公式仕様確認後に確定する。詳細は [セキュリティ](./SECURITY.md#最小権限) を参照する。

## P1確定機能の境界

### 訪問回数と保存リマインダー

機能を有効にした時だけ `history` を要求し、`HistoryItem.visitCount` と `lastVisitTime` を検証する。保存済み／非HTTP(S)／除外済みURLを落とし、設定閾値以上の未保存URLごとに永続Reminderを1件へ収束させる。通知の `保存` だけが `SaveBookmark` を呼び、`あとで` と `表示しない` は再通知状態だけを更新する。

### 休眠ブックマークのアーカイブ

名前付き `chrome.alarms` から評価する。履歴の最終訪問日時が設定日数より古いACTIVE項目だけを、文字列 `archiveState="ARCHIVED"`、理由 `INACTIVE` へ変更する。履歴なし、権限なし、revision競合はskipする。物理削除と分離し、手動復元を必須にする。

### Google Drive同期

SyncPortを実装し、Google Drive `appDataFolder` を保存先とする。版付きJSON snapshot／operationを使い、認証、差分、競合、削除tombstone、再試行を扱う。同期障害でもローカル編集を止めず、OAuth tokenはJSONやIndexedDBへ書かない。

### QR共有

ShareEncoder Portを通じ、選択されたレコードだけをバージョン付きJSON payloadへ変換する。インポート時はスキーマ検証、容量、checksum、重複、内容previewを必須にする。Drive appDataFolder内のファイルを他ユーザー共有へ流用しない。

### Chrome標準Bookmarkインポート

`chrome.bookmarks.getTree()` で読んだtreeを未信頼入力として走査し、preview後にImport Jobへ固定する。folder対応、URL検証、重複判定、部分失敗を記録し、Bookmation JSON documentだけを作る。標準Bookmarkのcreate/update/removeは呼ばない。

### 右クリック保存

install／startupでpage用とlink用のmenu IDを冪等に登録する。クリック情報から選んだ `pageUrl` / `linkUrl` を `http:` / `https:` allowlistで検証し、通常の保存ユースケースへ渡す。メニューを出せないURLでは無効化または安全な失敗通知にする。

## エラー設計

| コード例 | 意味 | retryable |
| --- | --- | --- |
| AI_UNAVAILABLE | AI機能を現在利用できない | 状況による |
| AI_MODEL_NOT_READY | モデル準備未完了 | yes、対応ページとユーザー操作が必要な場合あり |
| AI_HOST_REQUIRED | 対応するトップレベル拡張ページが開いていない | yes |
| AI_INVALID_OUTPUT | スキーマ不正 | yes、回数制限 |
| SEARCH_INVALID_OUTPUT | 検索計画または候補集合が不正 | no、字句検索へフォールバック |
| CATEGORY_NAME_CONFLICT | 同じ正規化名の有効カテゴリが存在 | no、既存カテゴリを選択 |
| HISTORY_PERMISSION_REQUIRED | 訪問判定に必要な権限がない | 利用者の再操作後 |
| IMPORT_PARTIAL | 標準Bookmark取込の一部が失敗 | yes、失敗分だけ |
| QR_INVALID_PAYLOAD | QRの形式、版、容量、checksumが不正 | no |
| DRIVE_REAUTH_REQUIRED | Drive認証が失効した | 利用者の再接続後 |
| INVALID_URL | URL指定保存の構文またはスキームが不正 | no、入力修正 |
| DB_QUOTA | 保存容量不足 | no、ユーザー対応 |
| DB_TRANSACTION | DB処理失敗 | yes |
| PERMISSION_REQUIRED | 任意機能の権限不足 | ユーザー操作後 |
| CONFLICT | 同時更新または同期競合 | no、自動統合または要確認 |

UI向けメッセージと診断情報を分ける。URL、ページタイトル、AI入力などの個人データをconsoleへ常時出力しない。

## テスト方針

- Domain単体: カテゴリのAI作成拒否、カテゴリ名一意、タグ同名許可、複数カテゴリ／タグ、edge一意性、上限
- Application単体: 現在タブ保存、URL指定保存、ホーム表示、AI失敗、再試行、重複要求
- Repository契約: IndexedDB各実装で同じテストを実行
- Service Worker結合: popupと2つのcommands、イベント途中の停止・再起動・メッセージ再送。Service WorkerからLanguageModelを呼ばないこと
- AI Host結合: 分類・共通AI検索の可用性、ユーザー操作、モデル取得、ページ終了、lease回収、結果再送
- AIアダプター契約: 不正JSON、候補外ID、重複ID、古いrevision、長すぎる名称・検索語、プロンプト注入文字列
- 検索: 両一覧からLabel／Bookmarkを返す、Labelが先、同名タグを別候補にする、AI候補は無順位、候補外ID拒否、AI利用不可時の字句フォールバック
- マイグレーション: 旧階層・旧分類名からの昇格、カテゴリ名競合、同名タグ、edge重複、失敗時のロールバック
- P1: 履歴閾値、Reminder重複、利用者確認前の保存禁止、最終訪問日時なしのskip、archive復元、標準Bookmark非変更、context menu、QR破損、Drive同時編集・オフライン復帰

現時点ではテストコードも実行結果も存在しない。
