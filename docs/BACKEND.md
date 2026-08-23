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
| SaveCurrentTab | URL、タイトル、ファビコン、任意サムネイル | 保存済みBookmark。AI設定がCONFIGUREDかつenabledの場合だけ分類Job |
| SaveBookmarkByUrl | ユーザーが入力したURL、任意タイトル、明示選択した0件以上のactive Tag ID（fetch タイトル / ホスト名は非同期更新可） | Tag／導出Category関連を含む保存済みBookmark。AI設定がCONFIGUREDかつenabledの場合だけ分類Job |
| OpenDashboardHome | popupまたはショートカットの要求 | 最近追加したBookmarkを表示する拡張機能ページ |
| OpenOnboardingAfterInstall | runtime.onInstalledのinstall理由 | 初回だけ表示する拡張機能内ウェルカムページ |
| GetCategoryTemplateCatalog | 同梱catalog version、locale | 初回用Category候補。具体的なsetはISSUE-022で決定する |
| ApplyCategoryTemplates | 利用者が明示したtemplate項目、catalog version、requestId | 通常のUSER Category作成規則を満たす適用結果 |
| CreateCategory / CreateTag | 名称、Tagでは選択済みのACTIVE親カテゴリID・revision、作成要求ID | 親子整合を満たす新規Label。Tag作成中のCategory side-view作成も別要求として冪等化する |
| UpdateCategory | categoryId、expectedRevision、name、requestId | CATEGORY内の名称一意性を満たす更新 |
| UpdateTag | tagId、expectedTagRevision、name、parentCategoryId、expectedParentRevision、`tag-update:` requestId | TAG全体の名称一意性と親子整合を満たす名称・親Category更新 |
| GetTagEditDetail | tagId | Tagのname・revisionと現在のACTIVE親Category ID・name・revision |
| GetCategoryEditDetail | categoryId、revision | ACTIVEな子Tagの実名一覧・件数と、そのTagを参照するACTIVE Bookmarkのunique件数 |
| UpdateBookmark | bookmarkId、expectedRevision、title、url、tagIds | Tag関連と、ACTIVE Tagの親集合から正確に導出したCategory関連 |
| DeleteBookmark | bookmarkId、revision、明示要求 | Bookmarkと関連edgeの論理削除結果、影響件数 |
| DeleteTag | tagId、revision、明示要求 | Tagと関連edgeの確認なし論理削除結果 |
| DeleteCategoryCascade | categoryId、expectedCategoryRevision、expectedImpactFingerprint、`category-delete:` requestId、warningAcknowledged=true | Category、全子Tag、関連edgeの論理削除。AI有効時だけ影響Bookmarkごとの再分類Job |
| ClassifyBookmark | bookmarkId、細分化設定 | 既存分類割当または検証済みの新規タグ |
| ReclassifyBookmark | bookmarkId、ユーザー指定のTag ID集合 | 親Category集合を導出した新しい分類と監査記録 |
| SuggestAll / SuggestCategories / SuggestTags | 入力中キーワード、種類、親カテゴリ | 一致度順・最大8件の選択候補 |
| AskAiAssistant | 自然言語、件数上限、Capability Catalog版 | 検索結果またはBookmation機能の説明 |
| SearchAllByKeyword | キーワード、カーソル | Label候補とBookmark候補。Labelを先に返す |
| ChangeArchiveState | bookmarkId、利用者が明示した状態 | P0の手動アーカイブまたは復元後のBookmark |
| EvaluateFrequentVisits | URL別の訪問日時、集計期間、訪問日数閾値、URL別reset時刻 | 未保存URLの重複しないReminder |
| UpdateContextMenuBookmarkSetting | desired boolean、requestId | 永続化済みの実効値とpage／link menuの整合結果 |
| HandleVisitReminder | reminderId、はい／いいえ、次回以降表示しない | 保存結果、URL別の訪問日数resetまたは抑止状態 |
| SetAutoArchiveEnabled | desired boolean、利用者gesture由来のhistory権限結果 | 永続化済みの実効値、権限状態、schedule整合結果 |
| ArchiveInactiveBookmarks | 有効化済み設定、最終訪問日時、設定日数 | archive済みBookmark集合と項目別履歴なしエラー |
| ImportChromeBookmarks | 確認済み選択、Import Job | 元データを変えない取込結果 |
| SaveFromContextMenu | pageUrlまたはlinkUrl | 共通保存ユースケースの結果 |
| ExportQr / ExportCsv / ImportQr | 検索・チェックで固定したカテゴリ／タグ／Bookmark集合、またはQR読取値 | QR／CSV export、容量超過fallback、preview、検証済みQR取込結果 |
| SyncGoogleDrive | 明示選択したアカウント、Outbox、remote revision | 同一アカウントまたは所有権確認済みデータセットの同期状態と競合 |
| MergeLabels | 同じ親Categoryを持つsourceTagId、targetTagId | Tag関連の付替え件数と結果。Category統合は提供しない |
| DeleteLocalData | 確認済みスコープ | 削除結果 |

P0はローカル保存・分類・検索を先に完成させる。訪問リマインダー、自動アーカイブ、QR／CSV共有、Drive同期、標準Bookmarkインポート、context menu保存はP1の確定ユースケースであり、採否は未決ではない。P1の実行頻度や競合UI等だけを未決事項として扱う。

カテゴリテンプレート機能はP0オンボーディングの確定ユースケースである。ただしcatalog内容と選択導線はISSUE-022の決定待ちであり、未決の候補名をDomainやmigrationへ埋め込まない。

## Portインターフェース案

以下は責務を示す擬似TypeScriptであり、実装済みAPIではない。

~~~ts
interface BookmarkRepository {
  save(bookmark: Bookmark): Promise<void>
  findByNormalizedUrl(url: string): Promise<Bookmark | null>
  listRecent(query: RecentBookmarkQuery): Promise<CursorPage<Bookmark>>
}

interface LabelRepository {
  createCategory(command: CreateCategoryCommand): Promise<Label>
  createTag(command: CreateTagCommand): Promise<Label>
  updateTag(command: UpdateTagCommand): Promise<UpdateTagResult>
  getTagEditDetail(tagId: Id): Promise<TagEditDetail>
  listCandidateLabels(query: LabelCandidateQuery): Promise<Label[]>
  listChildren(parentCategoryId: Id): Promise<Label[]>
  getCategoryEditDetail(query: CategoryEditDetailQuery): Promise<CategoryEditDetail>
}

interface BookmarkLabelRepository {
  applyClassification(result: ValidatedClassification): Promise<void>
}

interface SearchRepository {
  findLexicalCandidates(query: ValidatedSearchPlan): Promise<SearchCandidate[]>
  suggest(query: AutocompleteQuery, limit: 8): Promise<AutocompleteCandidate[]>
}

interface ClassificationProvider {
  capability(): Promise<AiCapability>
  classify(input: ClassificationInput): Promise<UnknownClassificationOutput>
}

interface AiAssistantProvider {
  respond(input: AiAssistantInput): Promise<unknown>
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

ClassificationProviderとAiAssistantProviderはトップレベルのAI Host Document内だけで生成・呼び出す。戻り値はあえてUnknown相当として受け、ホスト側のアダプター境界で外形JSONスキーマを検証する。Service Worker側アプリケーション層でも候補ID、TAGの親カテゴリID、Domain不変条件を再検証し、AI出力を信頼済みDomainオブジェクトとして直接受け取らない。

## 保存処理

### 入力

Bookmark保存には2つの入力経路を設け、同じ検証・正規化ユースケースへ合流させる。

現在のタブから保存する場合は、ユーザー操作で許可された次の情報に限定する。

- URL
- ページタイトル
- サイト名
- ファビコンURLまたは取得済みBlob
- 保存時に `og:image` を第一候補として取得するサムネイル

URL指定で保存する場合はURL、任意タイトル、DashboardのBookmark追加画面で明示選択した0件以上のTag IDを受け取る。`http:` / `https:` だけを許可し、文字数、構文、正規化結果を検証する。タイトル優先順位は **ユーザー入力（あれば） → fetch タイトル → ホスト名** とする。保存時の手入力タイトルは任意であり、dashboard / 編集 modal では常に編集できる。Tag入力文字列はcommandへ渡さず、リアルタイム候補または明示的な新規作成の結果から解決したIDだけを渡す。

URL が valid なら、メタデータ取得の成否に関わらず Bookmark と ClassificationJob を先に同一トランザクションで保存する。favicon / thumbnail と、title fetch が未完了の場合の title 更新は、保存成功後に非同期 Job として後追いする。後追い失敗時は faviconBlobId / thumbnailBlobId を null のままにし、一覧はプレースホルダー表示とする。

URL 指定保存専用のメタデータ fetch は、Manifest の `host_permissions: ["https://*/*", "http://*/*"]` を使い、対象 URL へ HTTP GET する。HTML から `<title>`、favicon link、`og:image` / `twitter:image` 等を parse し、画像は Blob 化して IndexedDB の blobs Store へ保存する。一覧描画で外部画像 URL を直接参照しない。

現在タブ保存（popup / ショートカット）は `activeTab` 由来の `tab.title` / `tab.favIconUrl` を優先し、上記 fetch 経路は URL 指定保存専用とする。画像 MIME、最大サイズ、リサイズ、`thumbnailEnabled` 既定、fetch 失敗時 UI は ISSUE-002 / TASK-010 で詰める。

サムネイルは保存処理の一部として `og:image` を第一候補に取得し、MIME、寸法、容量、content hashを検証してlocal Blobへ保存する。取得・検証・Blob保存の失敗時は画像参照を残さず、同梱の `assets/icon.png` を表示する。保存後の一覧表示で外部画像URLへ接続せず、画面キャプチャや認証後画面の取得も行わない。

ページ本文をAIへ渡すことはMVPの既定動作にしない。分類精度のため本文が必要になった場合は、取得範囲、保存有無、権限、プライバシー表示を別途設計する。

### popupとショートカット

- `chrome.runtime.onInstalled` の `reason="install"` だけで拡張機能内オンボーディングURLを開く。update、Chrome起動、Service Worker再起動では再表示せず、通常ホームの最近追加一覧とは別routeにする。
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
- 完全一致の既存Bookmarkへは複数Tagを追加できるため、分類ごとにBookmark本体を複製しない。Tag差分適用後は、BookmarkのCategory関連を残ったACTIVE Tagの親集合へ同じtransactionで完全一致させる。

### トランザクション

Bookmark保存、Bookmark追加画面で明示選択したTag edge、そのactive Tag親から導出するCategory edge、IndexedDBのclassificationSettings正本を同じIndexedDBトランザクションで扱う。処理開始前にdurable migration gateを確認し、存在中はBookmark／edge／Jobを何も書かず `SETTINGS_MIGRATION_IN_PROGRESS` を返す。全Tag IDの存在、kind、ACTIVE状態と親Categoryの存在／ACTIVE状態を再検証し、1件でも不正ならBookmarkを部分保存しない。AI設定がCONFIGUREDかつenabledの場合だけ同じtransactionでClassificationJobを作る。AI呼び出しはDBトランザクション外で実行し、長時間ロックしない。

1. Service Worker側でBookmark、選択Tag edge、導出Category edgeを保存する。AI設定がCONFIGUREDかつenabledならJobをPENDINGで保存し、disabled／再設定待ちはJobを作らずactive Tag有無からBookmarkをCLASSIFIED／UNCLASSIFIEDにする。
2. トランザクションを完了し、Bookmark保存成功を返す。
3. 対応を実証したトップレベル拡張ページが開いたとき、可用性を確認し、必要なユーザー操作とモデル準備を行う。
4. AI HostがJobをclaimし、そのページ内でAIを呼ぶ。
5. AI Hostがattempt token付きの生結果をService Workerへ送り、Service Workerが外形とDomainを検証する。正常候補があれば検証済み `pendingApply` を先に保存し、別の短いtransactionでTagと関連を更新する。
6. 正常適用はJob=`SUCCEEDED`／Bookmark=`CLASSIFIED`、3 dispatchすべてquality-zeroは両方=`NEEDS_REVIEW`、恒久非対応・実行上限・technical failure込みのdispatch枯渇は両方=`FAILED` として、対応するJob／Bookmark状態を同じtransactionで更新する。モデル未取得、download中、AI Host不在はclaimせずPENDINGを保つ。いずれもBookmark本体と手動Tagを残す。

## AI分類サービス

### Provider境界

Chrome Prompt API / Gemini Nano候補を、分類とAIアシスタントで共有するChromePromptProvider境界の後ろに置く。Chrome Prompt APIのLanguageModelはWeb Workerから利用できないため、このProviderをManifest V3 Service Workerで生成・実行してはならない。

Providerは、対応を実証したトップレベル拡張機能ドキュメント内だけで生成する。DashboardとSide Panelを候補とし、正確なホスト、Prompt APIのメソッド、可用性、モデル準備、ユーザーアクティベーション、対象Chrome、配布要件は [ISSUE-001](./ISSUES.md) の技術スパイクで確認する。Offscreen Document対応を仮定せず、現時点では動作確認済みとしない。

将来、明示的なユーザー同意がある場合だけRemoteAiProviderを追加できる構造にする。MVPでは実装しない。

### AI Hostの実行手順

1. AI Host候補のトップレベル拡張ページが可視状態で開く。
2. LanguageModelの可用性を確認し、利用不可、モデル取得可能、準備中、利用可能をUI状態へ変換する。
3. モデル取得にユーザー操作が必要なら、説明付き操作から開始する。
4. Service Workerはdurable migration gateがないことを確認してから、transaction開始時の `now` を1回取得し、active Job、Bookmark、Label、IndexedDBの `classificationSettings` 正本を同じtransactionで読む。AI Host可用性、claim、executionAttempt上限より先に設定stateを分岐し、disabled／再設定待ちはfingerprintを作らずCANCELED_SETTINGSへ進む。CONFIGUREDかつenabledの場合だけcurrent base fingerprintを計算し、不一致ならcounter非消費でstale差替えへ移る。一致してpendingApplyがあればDB-onlyで適用し、一致かつpendingApplyがない場合だけclaim／上限判定へ進む。`leaseExpiresAt > now` だけを有効、`leaseExpiresAt <= now` を失効とする。所有者なし／lease期限切れJobの所有権取得transactionが成功するたびexecutorInstanceIdが前回と同じでも `executionAttempt` を増やして新しいleaseNonceを発行し、有効な同じleaseNonceによるrenew、結果再送、DB retryでは増やさない。
5. Service Workerはsnapshotを再検証し、一意なattemptIdと次のordinalを `PREPARED` で保存する。この段階ではmodelAttemptを増やさない。PREPAREDのままleaseを失いexecutionAttemptが3未満なら、旧attemptをABANDONED_PRE_DISPATCH／CLOSEDにして同じ次ordinalの新attemptIdを新leaseで作る。executionAttempt=3のlease失効では新ownerを作らず実行上限finalizerがattemptを閉じる。旧attemptIdを再bindしない。
6. AI Hostへdispatch許可を返す直前のtransactionでattemptを `DISPATCH_RESERVED` にし、modelAttempt、jobId、attemptId、inputFingerprint、leaseNonceを結び付ける。commit後だけ、そのattempt専用の新しいLanguageModel sessionからPrompt APIを1回呼び、同attemptIdを再dispatchしない。
7. APPLY_CLASSIFICATION_RESULTメッセージで生結果、jobId、attemptId、modelAttempt、inputFingerprint、leaseNonceを返す。AI Host側の検証だけを信頼境界にしない。
8. Service Workerは結果受付transaction開始時の同じ `now` で `leaseExpiresAt > now` と現在のJob／attempt／leaseとの完全一致を確認し、候補の外形・Domain規則を再検証する。正常候補1件以上なら生応答やevidenceTextを除いた `pendingApply` を先に永続化し、それを短いIndexedDB transactionで適用する。process loss後も同じcommandを再検証して再開する。結果受付とlease-expiry finalizerの競合はIndexedDBのreadwrite transaction順に直列化し、先にcommitした側を正とする。
9. timeout、応答切断、truncated、dispatch後の結果喪失はtechnical failureとしてdispatch枠を消費するがquality-zeroに数えない。残り枠があれば新attemptへ進み、technical failureを含んで3枠を使い切ればFAILEDとする。
10. ページが閉じ、executionAttemptが3未満ならlease期限後に別executorがclaimできる。3回目lease失効で4回目claimが必要なら新ownerを作らず、設定取消、stale差替え、pendingApply回復を先に評価した後、PREPAREDをABANDONED_PRE_DISPATCH、DISPATCH_RESERVEDをTECHNICAL_FAILURE／MODEL_RESULT_LOSTとしてCLOSEDにし、Job／BookmarkをFAILEDへ原子的に終端する。`DISPATCH_RESERVED` 後は実call直前の停止でも安全側にmodelAttemptを消費済みとし、late responseや同attemptIdの再dispatchを拒否する。

AIセッション自体をIndexedDBやchrome.storage.localへシリアライズしない。

### 分類入力

- bookmarkIdではなく分類に必要な表示情報
- `candidateQueryVersion="all-active-labels-v1"` で取得する全active USER CategoryのID／表示名／revision。ID順とし、意味・件数shortlistを行わない
- 上記Categoryを親とする全active TagのID／表示名／origin／revision／parentCategoryId／親revision。USER／AI／IMPORT／SHARE、各origin内ID順とする
- policyVersion付きの細分化policy snapshot
- 固定promptVersion、responseSchemaVersion、candidateQueryVersion、`maxPromptInputBytes=262144`、`maxModelResponseBytes=262144`
- IndexedDBの `classificationSettings.settingsRevision` をJobの `settingsVersion` としてsnapshotする。chrome.storage.localのmirror値はJob入力の正本にしない
- 出力JSONスキーマ

IDと名称を分け、AIが返した表示名だけで既存レコードを特定しない。CategoryとTagは相互に同名を持ち得るため、候補ではID、kind、TAG親を省略しない。

モデルへ渡す固定プロンプト、入力JSON、出力型、responseConstraint、5段階policyは [AI_GUIDE.md](./AI_GUIDE.md) を正本とする。ページ由来文字列とLabel名は未信頼JSONデータとして渡し、固定指示へ直接補間しない。

### 優先順位

1. 提示されたactiveなユーザー作成カテゴリから、このAI分類の親を厳密に1件選ぶ。
2. Gemini Nanoは選択したカテゴリ配下で、正規化名または意味が合う既存のユーザー作成タグを優先する。
3. 適切なユーザー作成タグがなければ、同じ親カテゴリ配下のAI／IMPORT／SHARE由来の既存タグを再利用する。
4. 選択した1 Category内では、完全一致、同義語、正式名／略称、翻訳、表記揺れを全細分化度で再利用する。それ以外はpolicy version 2の再利用範囲とCREATE可能な重要度に従い、選択Categoryを親とする新しいタグを提案する。別Category配下にだけ同じ概念のTagがある場合はREUSE、重複CREATE、親変更をせず、その概念を当該試行の候補対象外にする。

AIはカテゴリを新規作成・改名・削除できない。ページのCOREを最もよく表すCategoryを選び、同等候補ではCOREと同等のUSER Tag、次に他originの同等Tagを持つCategoryを優先し、決められなければNEEDS_REVIEWとする。列挙したCategory ID以外を拒否し、選択CategoryはTag候補の親を制約する文脈としてだけ使い、Category edgeを単独適用しない。その試行の全REUSE／CREATE候補は選択した1 Category配下とする。既存の手動Tag由来の別Categoryは暗黙に削除せず、適用後の全ACTIVE Tag親集合へBookmarkのCategory edgeを完全一致させる。カテゴリ名はCATEGORY内、タグ名は親CategoryをまたいでTAG内で正規化後に一意とする。候補提示ではoriginが `USER` のTAGを優先するが、一意名照合はoriginを問わず、論理削除済みも含む全TAGを対象にする。同じnormalizedNameの提案は別IDを作らず、選択Category内のactive TAGだけを信頼側でREUSEへ解決する。親不一致またはtombstone競合はその候補を棄却する。normalizedNameが異なる同義語等はモデル品質責務であり、production validatorは未定義の意味推測でID操作しない。CategoryとTag相互の同名までは禁止しない。

### 細分化と候補採用

- `policyVersion: 2` は整数0〜4を、既存Tagの再利用方針とCREATE可能な重要度のdiscriminated snapshotとして保存する。0／1は `CORE`、2は `MAJOR`まで、3は `SUPPORTING`まで、4は `DETAIL`までCREATEできる。値0でも中心主題を表す既存Tagがない場合は必要最小限の `CORE` をCREATEできる。
- Tag候補にプロダクト上の件数上限を置かない。モデル出力を先頭N件、confidence上位N件、`maxItems` で切らず、各候補を独立に検証する。正常候補が1件以上なら同じ試行の全正常候補を1 transactionで適用し、Jobを `SUCCEEDED` にして直ちに終了する。
- 不正候補が混在しても `PARTIAL_SUCCESS` 状態を作らない。accepted／rejected件数と個人データを含まない理由コードを診断へ残す。受信済み出力の正常候補0件だけをquality-zeroとして残り枠で再試行し、試行間で候補を結合せず多数決しない。3 dispatchすべてquality-zeroの場合だけ `NEEDS_REVIEW` とする。timeout、応答切断、truncated、応答byte上限超過、結果喪失はtechnical failureとし、technical failure込みの3枠枯渇は `FAILED` とする。
- `proposalKey` はモデルに生成させない。CREATE候補の検証・正規化後、信頼済みコードがCategory IDと正規化名から安定生成し、`creationRequestId = jobId:proposalKey` で再送を冪等にする。別Jobでも同じ正規化タグ名なら新規作成せず、既存TAGを再評価する。
- prompt context、message byte数、名称長、実行時間には一般的な安全予算を設けられるが、Tag件数の業務上限や正常候補の先頭N件採用には使わない。all-active-labels-v1の全候補を入れたattempt inputが262144 UTF-8 bytesまたはProvider quotaを超える場合はdispatch前の `INPUT_CONTEXT_TOO_LARGE`／FAILEDとし、候補を切らない。raw応答が262144 bytesを超えれば `MODEL_RESPONSE_SIZE_EXCEEDED` のtechnical failure、Provider quotaで先に切れればtruncatedとする。claim後の設定変更で実行中Jobのpolicyを変えない。

### 検証

- JSON以外とenvelope schema不一致を試行全体の0件として扱う。top-levelの未知propertyを暗黙に破棄しない。
- `tagDecisions` のraw要素はresponseConstraintで厳格化せず、各要素をcandidate schemaで独立に検証する。候補内の未知property、field欠損、型不正、REUSE／CREATE混在はその候補だけを棄却し、他の候補を検証し続ける。
- 文字数、文字種、payload byte数、処理時間を制限する。Tag配列には業務上の件数上限を置かない。
- URL、HTML、Markdownをタグ名として許可しない。
- Categoryが厳密に1件であることと、各候補の既存Label ID、Label.kind、Label.origin、TAG.parentCategoryId、revision、importance、evidenceText、正規化名重複をDomainで再検証する。
- 新規Labelはタグを表す `kind=TAG` かつ提示済みの有効な `parentCategoryId` だけを許し、カテゴリ作成や親なしタグを示す出力は拒否する。
- 同じ `(bookmarkId, labelId)` は1つのedgeへ収束させ、AI再送で関連を複製しない。
- 重複以外の検証を先に行い、同じREUSE IDは先頭の正常要素、同じnormalizedNameのREUSEとCREATEはREUSE、同じnormalizedNameの複数REUSEはUSER／AI／IMPORT／SHAREとID順、同じnormalizedNameのCREATEは先頭の正常要素を残す。不正な先行候補で正常な後続候補を抑止しない。
- 成功した再分類では今回の正常Tag候補を現在のAI割当集合とし、置換対象を `assignedBy=AI` のTAG edgeだけに限定する。今回にない旧AI TAG edgeだけを同じtransactionで論理削除し、残るAI TAG edgeのclassificationJobId／confidenceを更新する。USER／IMPORT／SHAREおよびUSERへ昇格済みのTAG edgeは削除せずprovenanceも上書きしない。手動Bookmark編集で利用者が既存AI Tagを明示選択した時点でedgeをUSERへ昇格し、confidence／classificationJobIdをnullにする。派生CATEGORY edgeはactive TAG親から再計算し、寄与provenanceをUSER、IMPORT、SHARE、AIの順で選び、confidence／classificationJobIdは常にnullとする。
- AI出力からChrome API、ネットワーク、削除、共有を実行しない。
- モデル呼出し前と適用直前はdurable migration gate不在を確認し、Bookmark、classificationSettings正本、同じ決定的Category／Tag候補queryを同じtransactionで読む。最初に設定stateを分岐し、disabled／再設定待ちはpolicy必須のfingerprintを生成せず、旧JobをCANCELED_SETTINGS／CLOSEDとして差替えなしで閉じ、BookmarkをbookmarkStateBeforeJobへ戻す。CONFIGUREDかつenabledの場合だけ同じcanonical規則でcurrent base fingerprintを再計算する。既存候補のACTIVE状態・revision・Tag親変更だけでなく、候補の追加・復元・消滅・順序差も含めてJob.inputFingerprintと一致しなければ `STALE_CLASSIFICATION_INPUT` とする。旧Jobを同じtransactionでCANCELEDにし、現在値のversion 2 Jobをget-or-createしてactiveInputKeyで並行差替えを1件へ収束させる。候補外Category／REUSE Tag IDというモデル不正と、snapshot後発変更というstaleを混同しない。

## AI自然言語検索・機能案内サービス

AI入力ポップアップの1つの会話欄で、自然言語検索とBookmationの機能全般に関する質問を受け付け、入力とレスポンスを同じポップアップ内に表示する。検索意図ではLabelとBookmarkを同時に検索し、`labels` と `bookmarks` の2集合をこの順で返す。候補は「可能性が高い集合」であり、順位、スコア、最上位という契約を持たない。候補が複数でも1件へ勝手に確定しない。各候補は `entityType`、`entityId`、`entityRevision`、照合項目を持つ。

機能案内では、ビルドに同梱する版付きCapability Catalogだけを正本として、保存方法、カテゴリ／タグ、検索、設定、アーカイブ、共有、インポート等の使い方を説明する。一般的なAIエージェントと同じ対話形式にするが、MVPのProviderは説明と検索候補の提示だけを行い、設定変更、削除、共有、権限要求、Chrome API操作を自律実行しない。未実装機能を実装済みと答えず、Catalogに根拠がなければ分からないと返す。

### 実行手順

1. AI入力ポップアップを持つトップレベル拡張ページ内のAI Hostが、自然言語、Capability Catalog版、種類ごとの件数上限を検証する。
2. Prompt APIが利用可能なら、AI Host内で意図をcanonical enum `SEARCH_LIBRARY` / `PRODUCT_HELP` / `OUT_OF_SCOPE` の固定JSONスキーマへ分類する。利用できなければ検索を字句検索へフォールバックし、機能案内は静的ヘルプへの導線を返す。
3. `SEARCH_LIBRARY` では検索語へ展開し、Service Worker側が語数・長さを再検証してLabelとBookmarkの字句候補集合を上限付きで取得する。Bookmark候補では一致Label IDからBookmarkLabel edgeもたどる。
4. AI Hostは提示された候補から可能性が高いID集合だけを選ぶ。`PRODUCT_HELP` ではCapability Catalogの該当項目だけから説明文を作り、`OUT_OF_SCOPE` では対応範囲外の固定案内を返す。AIへ候補外の作成・検索、外部アクセス、アプリ操作を許可しない。
5. Service Worker側がID、対象種別、revision、TAGの親、重複、件数を再検証し、種類ごとの中立な決定的順序で最新レコードを返す。AIの配列順を関連度として保持しない。
6. ポップアップは回答文または検索候補を表示し、検索候補を開く操作が選ばれた時だけフルページ検索routeへ遷移する。

検索語、展開語、質問、回答、AIの自由文理由は既定でIndexedDB、chrome.storage.local、ログへ保存しない。AI対話は対応するトップレベル拡張ページが開いている間だけ実行し、永続Jobにはしない。ポップアップまたはページを閉じた場合は安全に中断し、分類Jobや保存済みBookmarkを変更しない。

Prompt APIが利用不可、モデル準備中、不正出力の場合も、字句検索で複数候補を返せるようにする。AI検索を使えないことと、検索結果が0件であることを同じ状態にしない。

## フルページ統合キーワード検索とautocomplete

ブックマーク一覧とカテゴリ／タグ一覧の検索操作は同じフルページ検索routeへ切り替え、同じ `SearchAllByKeyword` を呼ぶ。RepositoryはLabel候補とBookmark候補を別カーソルで取得し、レスポンスでは `labels` を先、`bookmarks` を後に固定する。入口画面によって対象を狭めない。AI検索も同じ結果Envelopeを使うため、UIは常にカテゴリ・タグを上、Bookmarkを下に表示できる。

入力中はAIを呼ばず、字句索引から完全一致、前方一致、部分一致等の決定的規則で候補を並べ、最大8件だけ返す。共通検索はカテゴリ／タグ／Bookmark、Bookmark追加／編集のTag欄はACTIVE TAGだけ、Tag作成／編集の親Category欄はACTIVE CATEGORYだけを対象にする。TAG候補には親Categoryを含める。正規化完全一致または候補選択後はIDとrevisionを使い、名称再解決による取り違えを防ぐ。候補へ解決できない文字列はfield error用の失敗とし、Label作成commandやBookmark edgeへ変換しない。

## カテゴリ／タグとBookmark関連の更新

- Categoryはユーザーだけが作成でき、正規化名をCATEGORY内で一意にする。Tag作成はACTIVEな `parentCategoryId` を必須とし、正規化名を親カテゴリをまたいでTAG内で一意にする。全TAGは物理的に存在するCATEGORY recordを参照し、ACTIVE TAGはACTIVE親を必須とする。削除済みTAGだけは削除済み親を参照できる。CategoryとTag相互の同名は許す。
- カテゴリ／タグ作成モーダルは閉じるまで連続作成できるため、各保存へ別の作成要求IDを付ける。同じ送信の再送は同一結果へ収束させるが、既存Labelを選択して新規作成成功として返さない。同じkindの既存名は候補を示して拒否し、別IDを作成しない。論理削除済みLabelも一意名を物理GCまで予約し続けるため、その間の同名作成は拒否し、別名だけを案内する。
- Tag作成の親Category入力は空から、Tag編集では現在のACTIVE親Category ID／revisionを選択済みで開始する。字句候補を一致度順に最大8件返し、正規化完全一致または候補選択時点で新しいID／revisionをdraftへ設定する。Category新規作成は同じモーダルのside-viewで `CreateCategory` として実行し、Tag名・編集中Tag ID・元の親などの未送信draftを保持する。作成成功したCategory IDとrevisionを親として自動選択してから、Tag作成では別の `creationRequestId`、編集では別の `requestId` で保存する。解決できないCategory文字列をcommandへ送らず、side-viewの失敗や取消でTag draftを失わない。
- Bookmark追加／編集commandが受ける分類入力は `tagIds` だけであり、`categoryIds` は受け付けない。選択された全TagがACTIVEであることを検証し、同一transactionでTag edgeを差分更新した後、Category edgeを「残ったACTIVE Tagの `parentCategoryId` の重複なし集合」と完全一致させる。Tag追加では親edgeを追加または復元し、同じ親の最後のTagを外した時は親edgeも論理削除する。利用者やクライアントがCategory edgeを独立に維持することはできない。
- Bookmark追加／編集のTag欄と管理モードの名称入力は、入力中にkind別の一致候補を最大8件返す。既存候補の選択はBookmarkへの関連付けには使えるが、Label作成・改名画面では既存Labelへの置換や暗黙mergeに使わず、重複エラーとして扱う。
- Category編集取得は、対象revisionとともにACTIVEな子TagのID・実名・revision一覧、子Tag件数、いずれかの子Tagを参照するACTIVE Bookmarkの重複除外件数、全物理子Tag・対象edge・影響Bookmarkのrevisionを含むcanonicalな `impactFingerprint` を返す。表示用件数をクライアントのedge走査へ委ねず、削除警告と同じ正本snapshotから算出する。
- `UpdateTag` は `kind` を変えないが、Tag名とACTIVEな親Categoryを同時に変更できる。Tag名は親Categoryに依存せずTAG全体で一意であり、親を変えても同名衝突のscopeは変わらない。[ISSUE-019](./ISSUES.md) は、専用の原子的な親更新を提供する判断で解決済みと扱う。
- BookmarkとTagの削除は追加確認なしで、対象ID、期待revision、UI gesture由来requestIdを検証して直ちに論理削除する。Categoryだけは、全子Tag削除とBookmark再分類が発生する警告を表示した後の専用 `DeleteCategoryCascade` requestを必須とする。汎用 `DeleteLabel` やAI経路からCategory削除へ到達させない。

### Tag名・親Category更新

`UpdateTag` は利用者がTag編集モーダルから送る `tagId`、`expectedTagRevision`、正規化前の `name`、選択した `parentCategoryId`、`expectedParentRevision`、冪等な `tag-update:<UUID>` requestIdだけを受ける。Category候補queryはACTIVE Categoryを字句一致順で最大8件返し、side-viewの `CreateCategory` はTag draftを維持したまま別transactionで完了させ、その返却ID・revisionをUpdateTag入力へ設定する。返却型は `tagId`、`resultTagRevision`、`affectedBookmarkCount` だけの `UpdateTagResult` に固定し、receiptからも同じ値を返す。

同じrequestIdの完了済みreceiptがあれば、tagIdと入力fingerprintが一致する時だけ保存済み結果を返す。別Tagまたは別payloadでのrequestId再利用は拒否する。新規requestではTag、現在の親Category、新しい親Category、Tagを参照する全ACTIVE Bookmarkとそれらの全BookmarkLabel edgeを同じtransactionで読み、Tagの期待revision、新親の期待revision、全対象のACTIVE状態・kind・参照整合を再検証する。Tagの正規化名は親と無関係な `tagUniqueName` で検証し、論理削除済みを含む別Tagとの衝突を拒否する。

親Categoryが変わる場合はTagの `parentCategoryId` とrevisionを更新した後、各参照Bookmarkについて全ACTIVE Tagの親集合を再取得し、ACTIVE Category edgeをその集合へ完全一致させる。旧親配下の別Tagが残れば旧親edgeを保ち、最後の旧親Tagだった場合だけ旧親edgeを論理削除し、新親edgeを追加または復元する。各Bookmarkのrevisionを進め、`TAG_PARENT_CHANGE` のBookmarkRevision、Tagと影響BookmarkのSearchDocument、同じrequestIdをbatch IDとする同期Outbox、Tag更新receiptを同一transactionでcommitする。途中で1件でも競合・quota・schema errorがあれば全件rollbackする。

名称だけの変更でもTag SearchDocumentと、Tag名称に依存する検索経路を同じtransactionで更新する。親が変わらなければBookmarkのCategory closureやrevisionを不要に変更しない。親変更は分類の意味を利用者が明示的に編集する操作であり、AI再分類Jobを作成しない。更新前のTag親を候補snapshotに持つ遅延AI結果は、Tag revision／parentCategoryIdまたはBookmark revisionの不一致として拒否し、自動的に旧親へ戻さない。

### Label名正規化v1

Category／Tagの作成、改名、Import、同期は共通のNormalizer v1を使い、Unicode 15.1.0のNFKC data、`White_Space` / `Default_Ignorable_Code_Point` / General Category tables、`CaseFolding.txt` をprojectへvendorする。処理順は、rawの `Cs` / `Default_Ignorable_Code_Point` 拒否、vendored NFKC、TAB／LFを含むvendored `White_Space` のASCII space 1文字へのcollapse／trim、残存 `Cc` / `Cs` / `Default_Ignorable_Code_Point` 拒否、`CaseFolding.txt` status C+Fのfull mapping、最終禁止文字・空・長さ再検証とする。F mappingがある場合はF、なければCを使い、status S / Tは使わない。

最低fixtureとして `  Ｐｙｔｈｏｎ　入門 ` → `python 入門`、`A\t\nB` → `a b`、`Straße` → `strasse` を固定し、`ab\u200Bcd`、`ab\u202Ecd`、`a\u0000b`、`a\u200Db`、`text\uFE0F` は拒否する。この一意性正規化を検索token正規化と共用せず、runtime ICU、`String.prototype.normalize()`、runtime Unicode property escape、locale-sensitive lowercaseを正本にしない。vendored bundleのSHA-256は実assetから実装時に生成してbuild定数とschemaMetaへ固定し、本書に仮hashを記載しない。version／hash不一致時はLabel writeを停止する。

### Bookmark／Category／Tag削除

`DeleteBookmark` は対象のACTIVE Bookmarkとその全BookmarkLabel edge、`DeleteTag` は対象Tagとその全edgeを、それぞれ1 transactionで論理削除する。対象IDと期待revisionを再検証し、変更する全正本レコードのrevisionを進めて同じ削除時刻の `deletedAt` を記録し、対象本体のSearchDocumentを削除または無効化する。DeleteTagでは影響ACTIVE Bookmarkを保持し、残存ACTIVE Tag親集合へCategory edgeを完全一致させ、Bookmark revision・監査・検索文書を更新し、旧pending／running JobをCANCELEDにする。1件でも失敗したら全件をrollbackする。DeleteBookmark／DeleteTagとも古い分類結果の後続適用を拒否する。favicon／thumbnail参照はtombstoneへ保持し、同期tombstone保持期間が終わり他の参照がないことを確認するまでBlobを回収しない。成功時は影響件数だけを返す。

`DeleteCategoryCascade` は警告確認済みの利用者操作だけが呼べる専用ユースケースである。`categoryId`、期待revision、警告snapshotの `expectedImpactFingerprint`、重複再送を識別する `category-delete:<UUID>` requestIdを検証し、requestIdを1つのCategoryだけへ結び付ける。use case別namespaceによりTag更新の `tag-update:` requestIdや同期batch IDとの衝突を防ぐ。同じCategoryの完了済みrequest再送はACTIVE／revision／fingerprint検証より先に `alreadyCompleted=true` のno-op成功へ収束させ、別CategoryでのrequestId再利用は拒否する。新規requestでは対象Category、`parentCategoryId` が一致する物理的に存在する全子Tag（ACTIVEと既存tombstoneの両方）、それらを参照する全BookmarkLabel edgeを固定する。同じtransaction内で影響集合のfingerprintを再計算し、不一致なら何も変更せず最新detailで再警告する。一致時だけACTIVE対象へ同一削除時刻を設定してrevisionを進め、既存tombstoneの再削除は状態を変えない冪等成功とし、Category／子TagのSearchDocumentを無効化する。影響する各ACTIVE Bookmarkは削除せず、残ったACTIVE Tag edgeからCategory edge集合を正確に再計算し、Bookmark revisionを進める。旧pending／running Jobは後続適用できないようCANCELEDへ移す。classificationSettingsがCONFIGUREDかつenabledならBookmarkをPENDINGとし、`reason="CATEGORY_CASCADE_DELETE"`、削除requestIdを起点としたBookmark別の安定requestIdを持つPENDING再分類Jobを1件ずつ作る。disabled／再設定待ちは差替えJobを作らず、残存active Tag有無からBookmarkをCLASSIFIED／UNCLASSIFIEDにする。Bookmark SearchDocumentの分類由来fieldも同じrevisionへ再生成する。

このtransactionには同期Outboxも同じ操作IDで含める。途中でCategory、子Tag、edge、Bookmarkの期待revisionが変わった場合、Job作成や検索派生更新を含む全変更をrollbackする。AI有効時、削除後にモデル未取得／download中／AI Host不在ならPENDINGを保ち、3 dispatchすべてquality-zeroならJob／BookmarkをNEEDS_REVIEW、恒久非対応、executionAttempt上限、technical failure込みのdispatch枯渇ならFAILEDにする。disabled／再設定待ちは分類Jobを実行しない。どの場合もBookmark本体と手動Tagを保持して手動Tag編集を許す。旧分類Jobの遅延結果はBookmark revision、Job state、TagのACTIVE状態が合わないため適用しない。Category tombstoneは全子Tag tombstoneが同期保持と参照解消を終えて物理GCされた後にだけ回収し、名前予約と「子Tagを先、Categoryを後」のGC順を維持する。

削除後のUndo token、Undo toast、Bookmark／Category／Tagの利用者向け復元ユースケースは提供しない。Labelのtombstoneは物理GCまで一意名を予約し、その間は同名の別IDを作らず別名だけを受け付ける。この仕様は、設定内のアーカイブ管理から行うBookmark復元には適用しない。

## Service WorkerとAI Hostのライフサイクル

Manifest V3 Service Workerは処理の途中でも停止し得る。また、LanguageModelはWeb Workerで利用できない。このためService WorkerはBookmarkとclassificationSettings正本、およびAI有効時のPENDING Jobの永続化、lease管理、入力準備、結果のDomain検証・適用だけを担当し、可用性確認、モデル取得、AIセッション作成、prompt実行を行わない。

### 永続ジョブ

ClassificationJobは次の状態を持つ。

- pending
- running
- succeeded
- failed
- needs_review
- canceled

AI HostはPrompt APIが利用可能になってからclaimする。所有者なし／lease期限切れJobの所有権取得transactionだけが `executionAttempt` を増やして新しいleaseNonceを発行し、executorInstanceIdが同じ再claimでも増やす。失効前の同じleaseNonceによるrenew、結果再送、同じ `pendingApply` のDB retryでは増やさない。3回目leaseが有効な間の処理は許し、4回目claimが必要になった時だけfinalizerでFAILEDへ閉じる。snapshot検証後にattemptIdをPREPAREDで保存し、外部call直前の別transactionでDISPATCH_RESERVEDとordinalをcommitした時だけ `modelAttempt` を増やす。外部callとIndexedDBはatomicにできないため、そのcommit直後にHostが停止して実callできなかった可能性があってもdispatch枠は安全側に消費済みとする。

受信済みJSON／envelope／候補検証による正常候補0件だけをquality-zeroとし、timeout、応答切断、truncated、結果喪失はtechnical failureに分ける。正常候補1件以上では検証済み `pendingApply` を先に保存して全件を原子的に適用し、即終了する。3 dispatchすべてquality-zeroならNEEDS_REVIEW、technical failureを含んでdispatch枠を使い切るか4回目claimが必要になればFAILEDとする。一定時間RUNNINGのままならleaseを失効させ、executionAttemptが3未満なら次のclaimでPREPARED／DISPATCH_RESERVED状態から安全に回収し、3ならfinalizerでattempt／token／activeInputKeyを同時に閉じる。pendingApplyはexecution上限より先にDB-only回復する。同attemptIdの再dispatch、古いleaseの結果、異なるfingerprintの結果は拒否する。

### 冪等性

- SaveCurrentTabとSaveBookmarkByUrlはnormalizedUrlと保存要求IDで重複を抑止する。
- ClassifyBookmarkはretryContextを除くBaseFingerprintPayloadへ `fingerprintVersion="classification-base-v1"`、bookmarkId、bookmarkRevision、settingsVersion、およびprompt／response schema version、candidateQueryVersion、両byte上限、policy、title／normalizedUrl、all-active-labels-v1順のCategory／Tag全fieldを持つpromptInputを入れ、canonical JSON v1のUTF-8 SHA-256 fingerprintを作る。各attemptのPromptInputはretryContext込みで別途canonicalizeしてモデルへ渡し、byte長を測る。`updatedAt`、Job state、lease、model／execution attemptはfingerprintへ含めない。
- 同じfingerprintの成功済みJobを再適用しない。
- PENDING／RUNNING Jobには `(bookmarkId, inputFingerprint)` から作る一意なactiveInputKeyを置く。stale時は旧Job取消と現在snapshotのJob get-or-createを1 transactionで行い、別の旧Jobから同時に差替えてもactive Jobを1件へ収束させる。
- Job作成時の取消復帰先は、INITIAL_SAVEでは手動Tag適用後、CATEGORY_CASCADE_DELETEでは削除後の残存active Tagが1件以上ならCLASSIFIED、0件ならUNCLASSIFIEDとする。USER_RECLASSIFYは開始前の非PENDING状態を保存する。active Job中の手動Tag追加／解除は同transactionで旧Jobの復帰先を編集後のactive Tag有無から更新し、stale差替えはその値を引き継ぐ。Tag差分なしのstaleは元値を維持する。差替えなし取消ではJobをCANCELED、Bookmarkをその状態へ同じtransactionで戻し、BookmarkへCANCELED状態を追加しない。
- カテゴリ名はCATEGORY内、タグ名は親カテゴリをまたいでTAG内で正規化後に一意とする。同じユーザー操作または同じAI proposalの再送は同じLabelを返し、別要求でも同じkind・同名なら新規作成しない。
- BookmarkLabelは `(bookmarkId, labelId)` の一意索引で1件へ収束させる。
- メッセージの再送をエラー扱いにしない。

### 状態復元

- Service WorkerまたはAI Host接続時に期限切れrunning Jobを少数ずつ確認する。durable gateと設定stateを先に判定し、pendingApplyがあればexecutionAttempt上限より先にService WorkerのDB-only経路で再検証・適用してモデルは実行しない。pendingApplyがなくexecutionAttemptが3未満の再試行可能Jobだけをpendingへ戻し、3なら新ownerを作らずlease-expiry finalizerでFAILEDへ閉じる。
- UI接続時にも該当Bookmarkの最新状態をRepositoryから返す。
- インメモリキュー、タイマー、シングルトンだけに重要状態を置かない。
- P0では定期実行を要求しない。P1の訪問／自動アーカイブでは名前付きalarmを起動時に冪等確認し、遅延や端末sleep後のまとめ実行を許容する。
- AI Hostが開いていなければpendingのまま保持し、手動保存・検索・編集を妨げない。

## 保存アダプター

### IndexedDB

ブックマーク、分類ラベル、関連、分類ジョブ、AI分類用設定正本、訪問リマインダー、Import Job、同期Outbox、検索用派生文書を、JSON互換ドキュメントとして保存する。Blobだけは別Storeへ分離する。AI設定正本は単調増加settingsRevisionを持ち、Job作成／stale検出／適用と同じtransactionで読む。スキーマと索引は [DBスキーマ](./DB-SCHEMA.md) に定義する。

### chrome.storage.local

以下の小さな設定だけを保存する。AI設定4項目はUI mirrorであり、実効値の正本はIndexedDBの `classificationSettings` とする。

- aiEnabled
- aiGranularity（CONFIGUREDでは0〜4、再設定待ちはnull）
- classificationConfigurationState
- classificationSettingsRevision
- viewMode
- thumbnailEnabled
- contextMenuBookmarkEnabled（端末固有。既定true）
- frequentVisitReminderEnabled
- frequentVisitWindow（`LAST_7_DAYS` / `LAST_30_DAYS` / `LAST_365_DAYS`。未設定時null）
- frequentVisitDayThreshold（期間別範囲を検証した日数。既定値なし／未設定時null）
- autoArchiveEnabled（既定false。history実権限がある場合だけtrue）
- archiveAfterDays（数値入力から検証した日数。既定30）
- archiveHistoryAccess（NOT_REQUESTED / GRANTED / DENIED。実権限は毎回再確認）
- onboardingState（install時だけ初期化し、進捗・途中再開・完了を保持）
- settingsSchemaVersion

ブックマーク本体をchrome.storage.localへ二重保存しない。AI設定はService Worker commandだけでIndexedDB正本を更新し、commit後にchrome.storage.localへmirrorする。新規installはAI有効・細分化度2・BALANCED・settingsRevision 1を正本へ作る。mirror不一致は正本から修復し、storageだけの変更を実効値にしない。旧設定移行中はdurable migration gateと固定snapshotを使い、設定commandを一時拒否して中間更新を失わない。訪問の集計期間はselect、訪問日数とアーカイブ化の閾値は有限整数として許容範囲・単位を検証する。訪問日数の既定値はnullとし、集計期間変更時もnullへ戻す。7／30／365日に対して1〜7／1〜30／1〜365以外を保存せず、有効な組がそろうまで訪問判定を `REMINDER_CONFIG_REQUIRED` で停止する。空欄、NaN、Infinity、指数表記、範囲外を有効設定へ変換しない。スライダーを使う設定は `aiGranularity` だけであり、`contextMenuBookmarkEnabled`、`frequentVisitReminderEnabled`、`autoArchiveEnabled` はswitchである。アーカイブ日数の欠損／不正値は30へ移行し、archive toggleの欠損はfalseへ移行する。history実権限がない状態で `autoArchiveEnabled=true` を保存せず、保存状態はUI用cacheとして実行前にもChromeの実権限を再確認する。`onboardingState` は `runtime.onInstalled` の `reason="install"` かつ未初期化の場合だけ作り、update、startup、Service Worker再起動で上書きしない。stepごとに進捗を保存して途中再開し、完了状態も保持する。

旧AI設定のgateは設定commandだけでなく、Bookmark保存、Category cascade、USER_RECLASSIFY、Job作成／差替え／claim／dispatch／結果／pendingApply／回収を含む分類設定依存処理全体のbarrierとする。gate中は無変更で `SETTINGS_MIGRATION_IN_PROGRESS` またはbackground待機とし、migration owner以外のmirror repairも行わない。

カテゴリテンプレートcatalogはアプリへ同梱した版付き参照データとして読み、`chrome.storage.local` やIndexedDBへcatalog全体を複製しない。適用済みcatalog versionとstep進捗だけをonboarding stateへ保持できる。catalog閲覧では書き込まず、利用者が明示した候補だけを既存の `CreateCategory` 境界へ渡し、Normalizer、一意名、`origin=USER`、creationRequestIdを再検証する。同じ適用requestの再送は同じ結果へ収束させ、update／reloadでは再適用しない。

## Chrome権限

P0の初期候補は storage、activeTab、host_permissions である。host_permissions は `https://*/*` と `http://*/*` で、URL 指定保存のメタデータ fetch に限定する。commandsはManifest宣言として「現在タブを保存」「ホームを開く」の2ショートカットを定義する。IndexedDB自体に拡張権限は不要である。

- P1の右クリック保存では `contextMenus`、定期判定では `alarms` を宣言する。
- `history` は訪問リマインダー有効化時、または自動アーカイブtoggleのON操作時に、目的説明後に任意要求する。自動アーカイブは利用者gesture内で `permissions.contains()` と必要な `permissions.request()` を行い、許可成功後だけONへcommitする。拒否／取消時はOFFのままにし、`permissions.onRemoved` または実行前検査で取消を検出した時もOFFへ戻してscheduleを止める。
- `notifications` は訪問リマインダーを有効化する時だけ要求し、アーカイブを理由に要求しない。
- `bookmarks` は標準Bookmarkインポート開始時だけ要求し、読取専用のアダプターから作成・更新・削除メソッドを公開しない。
- Google Drive接続では `identity` とOAuth設定を追加する。同一アカウント同期は `drive.appdata`、所有権のある別アカウントとの共有は通常Drive file用の `drive.file` を初期候補とし、実装する経路に必要なscopeだけを接続時に要求する。
- scripting、tabs は必要性を技術スパイクで実証してから追加する。現在タブ保存の title / favicon は `activeTab` を優先し、URL 指定保存の fetch とは経路を分ける。
- 現在タブのサムネイル取得が `activeTab` だけで成立するかを検証し、不足する場合は機能縮小を先に検討する。URL 指定保存の thumbnail は HTML parse 由来の `og:image` 等を後追い fetch する。

正確な権限は実装・Chrome公式仕様確認後に確定する。詳細は [セキュリティ](./SECURITY.md#最小権限) を参照する。

## P1確定機能の境界

### 訪問日数と保存リマインダー

設定の `frequentVisitReminderEnabled` を有効にした時だけ `history` / `notifications` を要求する。`chrome.history.search()` で候補URLを絞り、`chrome.history.getVisits()` の検証済み `visitTime` を現在の端末ローカル暦日へ変換する。canonical URLごとに同じ日を重複排除し、当日を含む直近7／30／365暦日の開始と、そのURLの最新 `countingResetAt` の遅い方より後だけを数える。日数閾値以上の未保存URLから、保存済み／非HTTP(S)／候補単位で抑止済みのURLを落とし、永続Reminderを1件へ収束させる。通知の `はい` だけが `SaveBookmark` を呼ぶ。`いいえ` は応答時刻を `countingResetAt` として保存し、その時刻以前の訪問を次回集計から除外する。同日中でも応答後の新しい訪問は1日目になり得る。「次回以降表示しない」はresetより優先してURL単位で `SUPPRESSED` とし、グローバル有効設定や他サイトの候補には影響させない。

### 休眠ブックマークのアーカイブ

`autoArchiveEnabled=false` ではalarmを登録せず、既存alarmが発火してもno-opにする。ON操作は利用者gesture内で目的説明と `history` 権限確認／要求を行い、許可と設定保存が成功した場合だけ名前付き `chrome.alarms` を整合させる。既定の `archiveAfterDays=30` を検証し、実行直前にも実権限とtoggleを確認する。拒否・取消・権限の後発削除ではtoggleをfalseへ戻し、alarmを解除してBookmarkを変更しない。履歴の最終訪問日時が設定日数より古いACTIVE項目だけを、`metadata` と `payload { title, url, categories, tags }` を構造上分けた最小スナップショットへ置換し、文字列 `archiveState="ARCHIVED"` を付ける。favicon、thumbnail、サイト名、訪問統計、AI状態等はpayloadへ複製せず、理由・時刻・revision・同期状態等のoperation metadataは別recordへ分離する。履歴なしは `ARCHIVE_HISTORY_NOT_FOUND` を項目別に永続化して `lastVisitedAt=null` のままarchive不可とし、設定画面にエラーメッセージを表示する。revision競合も変更せず理由を返す。物理削除と分離し、設定のアーカイブ管理リストから選択したBookmarkを復元できるようにする。復元時はURLとLabel階層を再検証し、削除済みLabelへ名称だけで自動再接続しない。実行頻度と履歴再確認UIはISSUE-009で決める。

### Google Drive同期

SyncPortを実装し、設定で利用者が選択したGoogleアカウントへ接続する。同一アカウント端末間はGoogle Drive `appDataFolder` を保存先とする。appDataFolder内の項目は共有できないため、所有権／権限のある別アカウントとの共有は通常Drive fileを使う別Port・別scope・別データセットとして実装し、アカウント選択、file capability、owner／permissionを毎回検証する。版付きJSON snapshot／operationを使い、接続アカウント、認証、差分、競合、削除tombstone、再試行を扱う。

同じscalar、同じedgeのadd/delete、update/delete、一意名競合は時刻によるLWWで自動解決しない。検証済みのbase／local／remoteをimmutable `syncSnapshots` へ保存し、そのsnapshot ID／revision／hash、reason、status、resolution、timestampsを `syncConflicts` から参照する。解決commandは期待conflict revisionと3 snapshotの期待revision／hash、および非空のallowlist済み明示operation listを必須とする。operationはsnapshot適用、Labelの明示rename、BookmarkLabel edgeの明示reassign、tombstone適用に限定し、各対象の期待revisionを持つ。

利用者の解決後も全期待値、Normalizer v1、Label一意性、TAG親の存在・状態、edge、delete markerを再検証し、正本、Outbox、競合状態を1 transactionでcommitする。同名／異親TAGや競合に負けたLabel IDへedgeを暗黙remapしない。OPEN／CANCELED conflictが参照するsnapshotはGCせず、RESOLVED後も最低30日かつ他参照がなくなるまで保持する。アカウント切替時は対象と未送信Outboxを確認し、同期障害でもローカル編集を止めず、OAuth tokenはJSONやIndexedDBへ書かない。

### QR／CSV共有

ShareEncoder Portを通じ、設定の共有画面で検索・チェックされたカテゴリ、タグ、個別Bookmarkをexport開始時の固定Bookmark集合へ展開してIDで重複排除する。同じ集合から `ExportQr` と `ExportCsv` を選べる。QRはversion付きJSON payloadの正確なencoded bytesを選択済みencoder設定で事前検査し、容量超過またはencoder overflowなら `QR_CAPACITY_EXCEEDED` を返す。部分QR、無言の切捨て、分割QRは作らず、resultには同じselection snapshot IDを受ける `ExportCsv` actionを含める。CSVはUTF-8、header付き、1 Bookmark 1行の版付き形式とし、title／URL／Category名配列／Tag名と親Category名の配列だけをRFC 4180相当でescapeする。表計算ソフトの数式として解釈され得る先頭文字をneutralizeし、ローカルID、履歴、Blob、AI会話、OAuth情報を含めない。CSV importは提供しない。

QRコード読み取りImportでは、スキーマ、容量、checksum、URL、カテゴリ／タグのkind別名称一意性、タグ親、重複を検証し、内容preview後にだけ通常のImport transactionへ渡す。checksumは破損・欠落・切詰めの検出用であり、送信者の真正性や改ざん耐性を保証しない。payload内部で正規化後同名のTAGが複数のparentCategoryNameを持つ場合はpreview前に構造不正として拒否し、暗黙renameや親選択をしない。同名Tagが既存の異なるparentCategoryを持つ場合も、自動reuse／rename／parent移動をせず、項目skip、Import全体cancel、または利用者が別名を明示する選択だけを許す。別名入力後は正規化・一意性を再検証し、全件previewを作り直してからcommitする。Drive appDataFolder内のファイルを他ユーザー共有へ流用しない。

### Chrome標準Bookmarkインポート

`chrome.bookmarks.getTree()` で読んだtreeを未信頼入力として走査し、各URL nodeの `parentId` から直上Folderを1件だけ解決してpreview後にImport Jobへ固定する。`A / B / ページ` ならFolder由来Tag候補は `B` だけであり、祖先 `A`、full path、兄弟FolderをCategory／Tagへ変換しない。同じ正規化名のactive Tagがあればoriginを問わずそのIDと既存親Categoryを再利用する。Tagがなければ、利用者がpreviewでactiveな親Categoryを選ぶか同一導線でCategoryを作成した後に `origin="IMPORT"` Tagを作る。Folder名からCategoryを暗黙作成しない。

選択済みBookmarkには解決済みTagを1件だけ付与し、Category edgeはそのTagの親から通常どおり導出する。取込commitと同時にAI分類Jobを作らず、追加Tagを付けない。直上Folder名が空／Normalizerで不正、または同名Tagがtombstoneで名前を予約中なら、placeholder、自動rename、tombstone復元を行わず項目skipまたはImport全体cancelを選ばせる。preview、Folder→Tag解決、URL検証、重複判定、部分失敗を記録し、Bookmation JSON documentだけを作る。標準Bookmarkのcreate/update/removeは呼ばない。

### 右クリック保存

設定 `contextMenuBookmarkEnabled` は端末固有で既定 `true` とする。旧settingsでfieldが欠ける場合は `true` へ移行し、boolean以外の値は `false` として安全に縮退する。`contextMenus` permission自体はP1 manifestに宣言したまま、設定でBookmation所有メニューの登録状態だけを制御する。

page用 `bookmation-save-page` とlink用 `bookmation-save-link` を固定IDとする。install、startup、`chrome.storage.onChanged` で実効設定と登録状態を照合し、ONなら所有IDだけを既存状態から冪等に再作成、OFFなら所有IDだけを削除する。`removeAll()` でBookmation内の別menuへ影響させず、Service Worker再起動や同じ要求の再送でも重複させない。

設定変更はApplication use caseを通し、希望値の保存とメニュー整合を一つの結果としてUIへ返す。Chrome API失敗時は以前の実効値へ補償し、UIもその値へ戻して再試行可能なエラーを表示する。次回startupでも再照合する。

click handlerは固定menu IDと送信元を検証した後、保存直前に `contextMenuBookmarkEnabled` を読み直す。OFF切替直前に配送された遅延clickも保存せず、ONの時だけ `pageUrl` / `linkUrl` を `http:` / `https:` allowlistで検証して通常の保存ユースケースへ渡す。メニューを出せないURLでは安全な失敗通知にする。

## エラー設計

| コード例 | 意味 | retryable |
| --- | --- | --- |
| AI_UNAVAILABLE | AI機能を現在利用できない | 状況による |
| AI_MODEL_NOT_READY | モデル準備未完了 | yes、対応ページとユーザー操作が必要な場合あり |
| AI_HOST_REQUIRED | 対応するトップレベル拡張ページが開いていない | yes |
| AI_INVALID_OUTPUT | 受信済み応答のスキーマ不正または正常候補0件 | yes、残りdispatch枠内。正常候補1件以上で終了し、3 dispatchすべてquality-zeroならNEEDS_REVIEW |
| AI_TECHNICAL_FAILURE | timeout、応答切断、truncated、応答byte上限超過、dispatch後の結果喪失 | yes、残りdispatch枠内。枯渇時はFAILED |
| INPUT_CONTEXT_TOO_LARGE | all-active-labels-v1の全attempt inputが262144 UTF-8 bytesまたはProvider quotaを超える | no、候補を切らずdispatch前にFAILEDとして手動分類へ案内 |
| STALE_CLASSIFICATION_INPUT | 分類Job作成後にBookmark、設定、候補集合または候補Category／Tagの状態、revision、親が変化 | no、旧JobをCANCELED。現在設定がCONFIGUREDかつenabledならversion 2 Jobを原子的にget-or-createし、disabled／再設定待ちは差替えない |
| SETTINGS_MIGRATION_IN_PROGRESS | durable gateが存在し、classificationSettings正本またはmirrorの移行が完了していない | yes、IDB／LocalSettingsを変更せずgate解放後に再送 |
| SEARCH_INVALID_OUTPUT | 検索計画または候補集合が不正 | no、字句検索へフォールバック |
| CATEGORY_NAME_CONFLICT | 同じ正規化名のカテゴリがtombstoneを含め存在 | no、有効な既存カテゴリを選択。削除済みなら物理GCまで別名 |
| TAG_NAME_CONFLICT | 親カテゴリとoriginを問わず同じ正規化名のタグがtombstoneを含め存在 | no、適合する有効タグを選択、削除済み／不適合なら要確認または別名 |
| CATEGORY_DELETE_WARNING_REQUIRED | Category連鎖削除の警告確認済みフラグがない | no、影響件数を含む警告を確認して再要求 |
| CATEGORY_DELETE_PREVIEW_STALE | 警告時と実行時でCategory、子Tag、edge、影響Bookmarkの集合またはrevisionが変化 | no、最新detailを取得して再警告 |
| REQUEST_ID_REUSED | 同じuse case namespaceのrequestIdが別対象または別payloadに既に結び付いている | no、新しいrequestIdで操作をやり直す |
| TAG_PARENT_INVALID | 親CATEGORY recordが存在しない、またはACTIVE Tagの親が削除済み／カテゴリではない | no、有効な親カテゴリを再選択 |
| TAG_SELECTION_INVALID | Bookmark追加／編集で指定したTag IDが存在しない、TAGではない、またはACTIVEではない | no、Tag候補を再取得して再選択 |
| TAG_UPDATE_CONFLICT | Tag、新旧親Category、参照Bookmarkまたはedgeが更新中に競合した | no、Tag編集detailとCategory候補を再取得 |
| AUTOCOMPLETE_INVALID_QUERY | 入力中キーワードが空、長すぎる、または不正 | no、入力修正 |
| HISTORY_PERMISSION_REQUIRED | 訪問判定に必要な権限がない | 利用者の再操作後 |
| REMINDER_CONFIG_REQUIRED | 訪問期間または期間別日数閾値が未設定／不正 | no、設定画面で再入力 |
| ARCHIVE_HISTORY_PERMISSION_REQUIRED | history権限がなく自動archiveをONにできない、または実行前に取消を検出 | no、toggle操作から再許可 |
| ARCHIVE_HISTORY_NOT_FOUND | 権限許可済みだが対象URLの信頼できる訪問日時がない | 利用者が再確認するまでno、項目別エラー表示 |
| IMPORT_PARTIAL | 標準Bookmark取込の一部が失敗 | yes、失敗分だけ |
| QR_INVALID_PAYLOAD | QRの形式、版、容量、checksumが不正 | no |
| QR_CAPACITY_EXCEEDED | 選択集合が現在のQR encoder設定へ収まらない | no、同じ選択でCSV export |
| CSV_EXPORT_FAILED | CSV生成またはdownload開始に失敗 | yes、選択を保持して再試行 |
| DRIVE_REAUTH_REQUIRED | Drive認証が失効した | 利用者の再接続後 |
| SYNC_CONFLICT | 自動解決禁止の同時編集、edge、削除、一意名競合 | no、syncConflictsの解決後 |
| INVALID_URL | URL指定保存の構文またはスキームが不正 | no、入力修正 |
| CONTEXT_MENU_RECONCILE_FAILED | 設定値とBookmation所有menu IDの登録状態を一致させられない | yes、以前の実効値へ戻して再試行 |
| DB_QUOTA | 保存容量不足 | no、ユーザー対応 |
| DB_TRANSACTION | DB処理失敗 | yes |
| PERMISSION_REQUIRED | 任意機能の権限不足 | ユーザー操作後 |
| CONFLICT | ローカルのrevision競合 | no、最新状態を再読込して要確認 |

UI向けメッセージと診断情報を分ける。URL、ページタイトル、AI入力などの個人データをconsoleへ常時出力しない。

## テスト方針

- Domain単体: project-vendored Unicode 15.1.0 Normalizer v1 fixture、runtime ICU差異無視、実asset hash照合、カテゴリ名のkind内一意、タグ名の親横断・kind内一意、tombstoneの名前予約、カテゴリのAI作成拒否、全TAGの親record存在、ACTIVE TAGのACTIVE親、Tag親変更後もTAG名一意性が親に依存しないこと、複数Tag、BookmarkのCategory edgeがACTIVE Tag親集合と完全一致、最後の同親Tag解除で親edgeも外れること、edge一意性、policyVersion 2の5段階reusePolicy／allowedCreateImportance、Category 1件、候補単位棄却、重複canonical化、正常候補全件採用、AI edge再分類置換、1件以上で終了、quality-zero／technical failure分離
- Application単体: 現在タブ保存、URL指定保存、Bookmark追加時の0件／複数active Tag IDとCategory自動導出、不在／非TAG／inactive IDの全体拒否、install時だけ初期化するオンボーディングの完了・途中再開、Category template catalog閲覧時の書込みなし・明示適用・同名競合・同request再送・update／reload非再適用、ホーム表示、新規installのAI既定値とdisabled／再設定待ちでJobを作らない分岐、AI有効時のPENDING／NEEDS_REVIEW／FAILED分岐、PREPARED回収、DISPATCH_RESERVED後停止、pendingApply復元、stale候補追加／復元／消滅、active Job重複収束、再試行、重複要求、訪問期間7／30／365日と期間別日数上限、同日重複排除、期間変更時の閾値clear、`いいえ` 後のURL別reset、Tagの名称・親同時更新、Category候補最大8件、nested Category作成後のdraft保持、旧親に別Tagが残る場合／最後のTagの場合のclosure、全参照Bookmark revision・監査・検索・Outbox更新、UpdateTag再送の同一結果とrequestId別payload拒否、途中競合時の全件rollback、親変更でAI再分類Jobを作らないこと、Bookmark／Tagの確認なし論理削除、Categoryの警告確認済み連鎖削除、削除後にUndo tokenを返さないこと、削除済みLabelとの同名作成拒否と別名案内、ACTIVE／削除済み子Tagの冪等tombstone化、影響Bookmark保持・親closure再計算、CONFIGUREDかつenabled時だけのBookmark別再分類Jobの冪等作成、disabled／再設定待ちのJobなしCLASSIFIED／UNCLASSIFIED、旧RUNNING結果拒否、AI状態別でも手動Tag編集、子TAG tombstone消滅前のCategory物理GC拒否、Bookmark削除時の検索派生文書除外と参照Blob保持
- Repository契約: IndexedDB各実装で同じテストを実行
- Service Worker結合: popupと2つのcommands、イベント途中の停止・再起動・メッセージ再送。Service WorkerからLanguageModelを呼ばないこと
- AI Host結合: 分類・AI検索・機能案内の可用性、Capability Catalog grounding、ユーザー操作、モデル取得、ページ終了、lease回収、結果再送
- AIアダプター契約: canonical intent `SEARCH_LIBRARY / PRODUCT_HELP / OUT_OF_SCOPE`、不正JSON、候補外ID、重複ID、古いrevision、長すぎる名称・検索語、プロンプト注入文字列
- 検索: 両一覧からLabel／Bookmarkを返す、Labelが先、autocomplete最大8件と種別絞込み、TAG候補に親を付ける、AI候補は無順位、候補外ID拒否、AI利用不可時の字句フォールバック
- マイグレーション: 旧平坦Labelへの親割当、親不明TAGの隔離、Unicode 15.1.0 vendored assetと実hash、正規化v1とカテゴリ／タグ名競合、JSON-safe cursor、raw LOCAL_SETTINGS_V1のschemaVersion=1／settingsSchemaVersion欠損／aiEnabled欠損／0〜4整数を固定するdurable gate、暗黙enabledと同じslider位置のpolicy v2対応、それ以外の再設定待ち、snapshot hash、全設定read／writeと分類設定依存commandの排他、CAPTURED／IDB_COMMITTED中断再開、v1／試作v2 active Job取消、`byActiveInputKey` unique index先行作成、enabled時だけの現在snapshot v2 Job get-or-create、再設定待ちのJobなし復帰、archiveのmetadata／payload分離、edge重複、失敗時のロールバック
- P1: 訪問日数の既定値なし、訪問期間／日数の組と期間変更時clear、同日重複排除、URL別reset、旧回数設定migration、archive既定30日、archive toggleのhistory許可時だけON／拒否・取消時OFF、Reminder無効化と候補単位SUPPRESSED、利用者確認前の保存禁止、履歴なしの項目別エラーとarchive不可、最小archiveと設定内復元、標準Bookmarkの直上Folderだけを1件のTag化／親Category明示解決／AI分類なし／元tree非変更、context menu設定の欠損移行／ON／OFF／登録失敗rollback／worker再起動／遅延click拒否、QR／CSVの同一選択集合、QR容量超過時のCSV誘導、CSV escaping／formula neutralization、checksum破損検出・別親同名Tagのskip/cancel/別名再preview、Driveアカウント選択・同時編集・オフライン復帰、syncSnapshotsのhash／immutable／OPEN pin／解決後30日保持、期待revision付き明示operations、syncConflicts再検証、Label ID暗黙付替え禁止

現時点ではテストコードも実行結果も存在しない。
