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
| OpenOnboardingAfterInstall | runtime.onInstalledのinstall理由 | 初回だけ表示する拡張機能内ウェルカムページ |
| CreateCategory / CreateTag | 名称、種類、Tagの親カテゴリID、作成要求ID | 親子整合を満たす新規Label。既存Labelの選択は作成件数に含めない |
| UpdateLabel / DeleteLabel | labelId、revision、名称／削除要求 | 一意性・親子整合を満たす更新、またはUndo token付き論理削除 |
| UpdateBookmark | bookmarkId、revision、名前、URL、categoryIds、tagIds | 親カテゴリを補完したBookmarkと関連 |
| DeleteBookmark | bookmarkId、revision、明示要求 | Bookmarkと関連edgeの論理削除結果、Undo token、影響件数 |
| ClassifyBookmark | bookmarkId、細分化設定 | 既存分類割当または検証済みの新規タグ |
| ReclassifyBookmark | bookmarkId、ユーザー指定のLabel ID集合 | 新しい分類と監査記録 |
| SuggestAll / SuggestCategories / SuggestTags | 入力中キーワード、種類、親カテゴリ | 一致度順・最大8件の選択候補 |
| AskAiAssistant | 自然言語、件数上限、Capability Catalog版 | 検索結果またはBookmation機能の説明 |
| SearchAllByKeyword | キーワード、カーソル | Label候補とBookmark候補。Labelを先に返す |
| ChangeArchiveState | bookmarkId、利用者が明示した状態 | P0の手動アーカイブまたは復元後のBookmark |
| EvaluateFrequentVisits | 履歴集約値、訪問閾値 | 未保存URLの重複しないReminder |
| HandleVisitReminder | reminderId、保存／あとで／閉じる、次回以降表示しない | 保存結果または候補URL単位の再通知状態 |
| ArchiveInactiveBookmarks | 最終訪問日時、設定日数 | 文字列archiveStateを更新したBookmark集合 |
| ImportChromeBookmarks | 確認済み選択、Import Job | 元データを変えない取込結果 |
| SaveFromContextMenu | pageUrlまたはlinkUrl | 共通保存ユースケースの結果 |
| ExportQr / ImportQr | 検索・チェックで固定したカテゴリ／タグ／Bookmark集合、またはQR読取値 | 版付きpayload、preview、検証済み取込結果 |
| SyncGoogleDrive | 明示選択したアカウント、Outbox、remote revision | 同一アカウントまたは所有権確認済みデータセットの同期状態と競合 |
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
  createCategory(command: CreateCategoryCommand): Promise<Label>
  createTag(command: CreateTagCommand): Promise<Label>
  listCandidateLabels(query: LabelCandidateQuery): Promise<Label[]>
  listChildren(parentCategoryId: Id): Promise<Label[]>
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
- ユーザー設定で有効な場合のサムネイル

URL指定で保存する場合はURLと任意タイトルを受け取る。`http` / `https` 等の許可スキーム、文字数、構文、正規化結果を検証し、ページメタデータ取得のために広いhost permissionや暗黙の外部fetchを追加しない。取得できないタイトルは検証済みhost名等の安全な代替表示にする。

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
- 完全一致の既存Bookmarkへは複数のカテゴリ／タグを追加できるため、分類ごとにBookmark本体を複製しない。タグを追加する時は親カテゴリ関連も同じtransactionで補完する。

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

Chrome Prompt API / Gemini Nano候補を、分類とAIアシスタントで共有するChromePromptProvider境界の後ろに置く。Chrome Prompt APIのLanguageModelはWeb Workerから利用できないため、このProviderをManifest V3 Service Workerで生成・実行してはならない。

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
- ユーザー作成タグを先頭にした既存タグ候補と、それぞれのparentCategoryId
- AI作成済みタグ候補と、それぞれのparentCategoryId
- policyVersion付きの細分化policy snapshot
- 出力JSONスキーマ

IDと名称を分け、AIが返した表示名だけで既存レコードを特定しない。CategoryとTagは相互に同名を持ち得るため、候補ではID、kind、TAG親を省略しない。

### 優先順位

1. 意味が合う既存のユーザー作成カテゴリを0件以上選ぶ。
2. 選択したカテゴリ配下で、正規化名または意味が合う既存のユーザー作成タグを優先する。
3. 適切なユーザー作成タグがなければ、同じ親カテゴリ配下の既存AI作成タグを再利用する。
4. 適切な既存タグがなく、細分化設定1〜4で許可される場合だけ、提示済みカテゴリを親とする新しいタグを提案する。

AIはカテゴリを新規作成・改名・削除できない。既存カテゴリを選ぶ場合も列挙したID以外は拒否する。カテゴリ名はCATEGORY内で正規化後に一意、タグ名は親カテゴリをまたいでTAG内で正規化後に一意とする。TAGは有効な親カテゴリIDを必須とする。候補提示ではoriginが `USER` のTAGを優先するが、一意名照合はoriginを問わず、論理削除済みも含む全TAGを対象にする。同名提案があれば別IDを作らず既存TAGを再評価し、親カテゴリと意味が適合する有効TAGだけを再利用する。親または意味が不適合、あるいは同名TAGが論理削除済みなら `NEEDS_REVIEW` にする。TAGを適用するtransactionは親CATEGORYのBookmark関連も追加または復元する。CategoryとTag相互の同名までは禁止しない。

### 細分化

- 細分化スライダーは整数0〜4とし、policyVersion 1では新規TAG上限を `0→0`、`1→1`、`2→2`、`3→4`、`4→6` に固定する。この対応をdiscriminated unionのJob snapshotとして保存し、任意のgranularity／maxNewTags組合せを受け付けない。どの値でもカテゴリは新規作成しない。
- 0ではAIによる新規タグ作成を行わない。ただしAI自動分類自体は止めず、既存カテゴリ／既存タグの自動割当は行う。適切な候補がなければneeds_reviewまたは分類なしで保存する。
- 新規タグ提案にはJob内で一意な `proposalKey` を持たせ、`creationRequestId = jobId:proposalKey` で再送を冪等にする。別Jobでも同じ正規化タグ名なら新規作成せず、既存TAGを候補として再評価する。
- 既存Label割当数、新規タグ数、名称長を別々に上限検証する。policyVersionと対応済み上限をJobへ固定し、claim後の設定変更で実行中Jobを変えない。
- 低信頼度や候補が拮抗した場合は複数候補をneeds_reviewへ返し、名称だけで1件に決めない。

### 検証

- JSON以外を拒否する。
- 未知のプロパティを拒否または破棄する方針を固定する。
- 文字数、文字種、配列件数を制限する。
- URL、HTML、Markdownをタグ名として許可しない。
- 既存Label ID、Label.kind、Label.origin、TAG.parentCategoryId、Bookmark revision、件数上限をDomainで再検証する。
- 新規Labelはタグを表す `kind=TAG` かつ提示済みの有効な `parentCategoryId` だけを許し、カテゴリ作成や親なしタグを示す出力は拒否する。
- 同じ `(bookmarkId, labelId)` は1つのedgeへ収束させ、AI再送で関連を複製しない。
- AI出力からChrome API、ネットワーク、削除、共有を実行しない。

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

入力中はAIを呼ばず、字句索引から完全一致、前方一致、部分一致等の決定的規則で候補を並べ、最大8件だけ返す。共通検索はカテゴリ／タグ／Bookmark、ブックマーク編集のカテゴリ欄はCATEGORY、タグ欄はTAGだけを対象にする。TAG候補には親カテゴリを含める。候補選択後はIDとrevisionを使い、名称再解決による取り違えを防ぐ。

## カテゴリ／タグとBookmark関連の更新

- Categoryはユーザーだけが作成でき、正規化名をCATEGORY内で一意にする。Tag作成はACTIVEな `parentCategoryId` を必須とし、正規化名を親カテゴリをまたいでTAG内で一意にする。全TAGは物理的に存在するCATEGORY recordを参照し、ACTIVE TAGはACTIVE親を必須とする。削除済みTAGだけは削除済み親を参照できる。CategoryとTag相互の同名は許す。
- カテゴリ／タグ作成モーダルは閉じるまで連続作成できるため、各保存へ別の作成要求IDを付ける。同じ送信の再送は同一結果へ収束させるが、既存Labelを選択して新規作成成功として返さない。同じkindの既存名は候補を示して拒否し、別IDを作成しない。論理削除済みLabelも一意名を予約し続けるため、同名作成では既存IDの明示的な復元または別名を案内する。物理回収前に同名の別IDを作らない。
- ブックマーク編集はカテゴリID集合とタグID集合を別々に受ける。TAGを追加した場合は親CATEGORY edgeも同じtransactionで追加または復元する。CATEGORYを外した場合はその配下TAG edgeも外し、TAGだけを外した場合はCATEGORYを残す。
- ブックマーク編集の分類欄と管理モードの名称入力は、入力中にkind別の一致候補を最大8件返す。既存候補の選択はブックマークへの関連付けには使えるが、Label作成・改名画面では既存Labelへの置換や暗黙mergeに使わず、重複エラーとして扱う。
- 名前編集でLabel.kindやTAG.parentCategoryIdを変更しない。現行P0は親カテゴリを読取専用表示し、UpdateTagでの親変更を拒否する。タグ移動は全Bookmarkの関連再計算が必要なため、[ISSUE-019](./ISSUES.md) で専用ユースケースとtransactionを確定してから実装する。
- 管理モードからの削除は、追加の確認画面がないことを前提に、対象ID、revision、UI gesture由来requestIdを検証して直ちに論理削除する。Tagは自身と関連edgeを単一transactionで処理する。ACTIVEな子Tagを持つCategoryは `CATEGORY_NOT_EMPTY` で拒否し、暗黙cascadeせず、子Tagの管理または削除を案内する。現行P0ではTagの親変更を受け付けないため、再配置を解決策として案内しない。ACTIVE子Tagが0件のCategoryだけ自身と関連edgeを論理削除でき、削除済み子TagはそのCATEGORY tombstoneを参照し続ける。CATEGORYの物理GCは削除済みを含む子TAG recordが0件になるまで拒否する。名称一致する別Tagを巻き込まない。

### Label名正規化v1

Category／Tagの作成、改名、Import、同期は共通のNormalizer v1を使い、Unicode 15.1.0のNFKC data、`White_Space` / `Default_Ignorable_Code_Point` / General Category tables、`CaseFolding.txt` をprojectへvendorする。処理順は、rawの `Cs` / `Default_Ignorable_Code_Point` 拒否、vendored NFKC、TAB／LFを含むvendored `White_Space` のASCII space 1文字へのcollapse／trim、残存 `Cc` / `Cs` / `Default_Ignorable_Code_Point` 拒否、`CaseFolding.txt` status C+Fのfull mapping、最終禁止文字・空・長さ再検証とする。F mappingがある場合はF、なければCを使い、status S / Tは使わない。

最低fixtureとして `  Ｐｙｔｈｏｎ　入門 ` → `python 入門`、`A\t\nB` → `a b`、`Straße` → `strasse` を固定し、`ab\u200Bcd`、`ab\u202Ecd`、`a\u0000b`、`a\u200Db`、`text\uFE0F` は拒否する。この一意性正規化を検索token正規化と共用せず、runtime ICU、`String.prototype.normalize()`、runtime Unicode property escape、locale-sensitive lowercaseを正本にしない。vendored bundleのSHA-256は実assetから実装時に生成してbuild定数とschemaMetaへ固定し、本書に仮hashを記載しない。version／hash不一致時はLabel writeを停止する。

### Bookmark／Category／Tag削除とUndo

`DeleteBookmark` は対象のACTIVE Bookmarkとその全BookmarkLabel edge、`DeleteTag` は対象Tagとその全edge、子Tagがない時だけ実行できる `DeleteCategory` は対象Categoryとその全edgeを、それぞれ1 transactionで論理削除する。変更する全正本レコードへ同じ `deleteOperationId`、削除後の `deletedRevision`、`deletedAt` を記録し、その正確な集合を共通UndoOperationへ保存する。DeleteBookmarkでは同じtransactionでSearchDocumentを削除または無効化し、pending／running分類結果の後続適用を拒否する。SearchDocumentは派生物なのでUndo時にBookmarkから再生成する。favicon／thumbnail参照はtombstoneへ保持し、Undo期限と同期tombstone保持期間の双方が終わるまでBlobを回収しない。成功時は全削除ユースケースが短期Undo tokenと影響件数を返す。

Undoはtokenに紐づく全対象で `deleteOperationId` と現在revisionが保存済み `deletedRevision` に一致し、一意名・親子・edge不変条件も満たす時だけ、同じtransactionで全件を復元してtokenを消費する。Tag復元は親CATEGORYが存在しACTIVEである場合だけ許し、親が削除済みなら `UNDO_CONFLICT` として親復元を先に求める。期限切れは `UNDO_EXPIRED`、期限内でも対象欠損、marker／revision不一致、不変条件違反がある場合は `UNDO_CONFLICT` とし、部分復元しない。Labelのtombstoneが一意名を予約するため、削除→同名別ID作成→Undoという競合を許さない。

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
- カテゴリ名はCATEGORY内、タグ名は親カテゴリをまたいでTAG内で正規化後に一意とする。同じユーザー操作または同じAI proposalの再送は同じLabelを返し、別要求でも同じkind・同名なら新規作成しない。
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
- aiGranularity（0〜4のスライダー値）
- viewMode
- thumbnailEnabled
- frequentVisitReminderEnabled
- frequentVisitThreshold（数値入力から検証した整数）
- archiveAfterDays（数値入力から検証した日数）
- archiveHistoryAccess（NOT_REQUESTED / GRANTED / DENIED。実権限は毎回再確認）
- onboardingState（install時だけ初期化し、進捗・途中再開・完了を保持）
- settingsSchemaVersion

ブックマーク本体をchrome.storage.localへ二重保存しない。訪問回数とアーカイブ化の閾値は有限整数・許容範囲・単位を検証し、空欄、NaN、Infinity、指数表記、範囲外を保存しない。スライダーを使う設定は `aiGranularity` だけである。アーカイブ判定は検証済み `archiveAfterDays` に常に従い、別の有効化フラグを持たない。初回開始または閾値確定時に目的を説明して `history` だけを要求し、拒否時も閾値を保持して `archiveHistoryAccess="DENIED"` とし、判定を権限待ちで停止する。保存状態はUI用cacheであり、実行前にChromeの実権限を再確認する。`onboardingState` は `runtime.onInstalled` の `reason="install"` かつ未初期化の場合だけ作り、update、startup、Service Worker再起動で上書きしない。stepごとに進捗を保存して途中再開し、完了状態も保持する。

## Chrome権限

P0の初期候補は storage と activeTab である。commandsはManifest宣言として「現在タブを保存」「ホームを開く」の2ショートカットを定義する。IndexedDB自体に拡張権限は不要である。

- P1の右クリック保存では `contextMenus`、定期判定では `alarms` を宣言する。
- `history` は訪問リマインダー有効化時、または自動アーカイブの初回開始／閾値確定時に、目的説明後に任意要求する。アーカイブ用の別toggleは置かず、拒否時は `archiveAfterDays` を保持したまま判定だけを権限待ち停止にする。
- `notifications` は訪問リマインダーを有効化する時だけ要求し、アーカイブを理由に要求しない。
- `bookmarks` は標準Bookmarkインポート開始時だけ要求し、読取専用のアダプターから作成・更新・削除メソッドを公開しない。
- Google Drive接続では `identity` とOAuth設定を追加する。同一アカウント同期は `drive.appdata`、所有権のある別アカウントとの共有は通常Drive file用の `drive.file` を初期候補とし、実装する経路に必要なscopeだけを接続時に要求する。
- scripting、tabs、広いhost_permissionsは必要性を技術スパイクで実証してから追加する。
- サムネイル取得がactiveTabだけで成立するかを検証し、不足する場合は機能縮小を先に検討する。

正確な権限は実装・Chrome公式仕様確認後に確定する。詳細は [セキュリティ](./SECURITY.md#最小権限) を参照する。

## P1確定機能の境界

### 訪問回数と保存リマインダー

設定の `frequentVisitReminderEnabled` を有効にした時だけ `history` / `notifications` を要求し、`HistoryItem.visitCount` と `lastVisitTime` を検証する。数値入力で保存した閾値以上の未保存URLから、保存済み／非HTTP(S)／候補単位で抑止済みのURLを落とし、永続Reminderを1件へ収束させる。通知の `保存` だけが `SaveBookmark` を呼ぶ。「次回以降表示しない」にチェックして閉じた候補はURL単位で `SUPPRESSED` とし、グローバル有効設定や他サイトの候補には影響させない。

### 休眠ブックマークのアーカイブ

初回開始または閾値確定時に目的説明後 `history` だけを要求し、許可済みの場合に名前付き `chrome.alarms` から検証済み `archiveAfterDays` に従って評価する。拒否・取消時は閾値を保持し、判定を権限待ち停止にする。履歴の最終訪問日時が設定日数より古いACTIVE項目だけを、`metadata` と `payload { title, url, categories, tags }` を構造上分けた最小スナップショットへ置換し、文字列 `archiveState="ARCHIVED"` を付ける。favicon、thumbnail、サイト名、訪問統計、AI状態等はpayloadへ複製せず、理由・時刻・revision・同期状態等のoperation metadataは別recordへ分離する。履歴なし、revision競合はskipする。物理削除と分離し、設定のアーカイブ管理リストから選択したBookmarkを復元できるようにする。復元時はURLとLabel階層を再検証し、削除済みLabelへ名称だけで自動再接続しない。

### Google Drive同期

SyncPortを実装し、設定で利用者が選択したGoogleアカウントへ接続する。同一アカウント端末間はGoogle Drive `appDataFolder` を保存先とする。appDataFolder内の項目は共有できないため、所有権／権限のある別アカウントとの共有は通常Drive fileを使う別Port・別scope・別データセットとして実装し、アカウント選択、file capability、owner／permissionを毎回検証する。版付きJSON snapshot／operationを使い、接続アカウント、認証、差分、競合、削除tombstone、再試行を扱う。

同じscalar、同じedgeのadd/delete、update/delete、一意名競合は時刻によるLWWで自動解決しない。検証済みのbase／local／remoteをimmutable `syncSnapshots` へ保存し、そのsnapshot ID／revision／hash、reason、status、resolution、timestampsを `syncConflicts` から参照する。解決commandは期待conflict revisionと3 snapshotの期待revision／hash、および非空のallowlist済み明示operation listを必須とする。operationはsnapshot適用、Labelの明示rename、BookmarkLabel edgeの明示reassign、tombstone適用に限定し、各対象の期待revisionを持つ。

利用者の解決後も全期待値、Normalizer v1、Label一意性、TAG親の存在・状態、edge、delete markerを再検証し、正本、Outbox、競合状態を1 transactionでcommitする。同名／異親TAGや競合に負けたLabel IDへedgeを暗黙remapしない。OPEN／CANCELED conflictが参照するsnapshotはGCせず、RESOLVED後も最低30日かつ他参照がなくなるまで保持する。アカウント切替時は対象と未送信Outboxを確認し、同期障害でもローカル編集を止めず、OAuth tokenはJSONやIndexedDBへ書かない。

### QR共有

ShareEncoder Portを通じ、設定の共有画面で検索・チェックされたカテゴリ、タグ、個別Bookmarkを生成開始時の固定Bookmark集合へ展開し、重複排除してバージョン付きJSON payloadへ変換する。カテゴリ選択はそのカテゴリに関連するBookmark、タグ選択はそのタグに関連するBookmarkを対象にする。QRコード読み取りImportでは、スキーマ、容量、checksum、URL、カテゴリ／タグのkind別名称一意性、タグ親、重複を検証し、内容preview後にだけ通常のImport transactionへ渡す。checksumは破損・欠落・切詰めの検出用であり、送信者の真正性や改ざん耐性を保証しない。payload内部で正規化後同名のTAGが複数のparentCategoryNameを持つ場合はpreview前に構造不正として拒否し、暗黙renameや親選択をしない。同名Tagが既存の異なるparentCategoryを持つ場合も、自動reuse／rename／parent移動をせず、項目skip、Import全体cancel、または利用者が別名を明示する選択だけを許す。別名入力後は正規化・一意性を再検証し、全件previewを作り直してからcommitする。Drive appDataFolder内のファイルを他ユーザー共有へ流用しない。

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
| CATEGORY_NAME_CONFLICT | 同じ正規化名のカテゴリがtombstoneを含め存在 | no、有効な既存カテゴリを選択、削除済みなら同じIDを明示復元、または別名 |
| TAG_NAME_CONFLICT | 親カテゴリとoriginを問わず同じ正規化名のタグがtombstoneを含め存在 | no、適合する有効タグを選択、削除済み／不適合なら要確認または別名 |
| CATEGORY_NOT_EMPTY | 削除対象カテゴリにACTIVEな子タグが存在 | no、子タグを管理または削除 |
| TAG_PARENT_INVALID | 親CATEGORY recordが存在しない、またはACTIVE Tagの親が削除済み／カテゴリではない | no、親カテゴリを再選択。Tag復元では親CATEGORYを先に復元 |
| AUTOCOMPLETE_INVALID_QUERY | 入力中キーワードが空、長すぎる、または不正 | no、入力修正 |
| UNDO_EXPIRED | 論理削除のUndo期限切れ | no、削除済み一覧から確認 |
| UNDO_CONFLICT | 期限内Undoの対象、deleteOperationId、deletedRevision、TagのACTIVE親、または他の不変条件が不一致 | no、再読込。Tagの親が削除済みなら親を先に復元 |
| HISTORY_PERMISSION_REQUIRED | 訪問判定に必要な権限がない | 利用者の再操作後 |
| IMPORT_PARTIAL | 標準Bookmark取込の一部が失敗 | yes、失敗分だけ |
| QR_INVALID_PAYLOAD | QRの形式、版、容量、checksumが不正 | no |
| DRIVE_REAUTH_REQUIRED | Drive認証が失効した | 利用者の再接続後 |
| SYNC_CONFLICT | 自動解決禁止の同時編集、edge、削除、一意名競合 | no、syncConflictsの解決後 |
| INVALID_URL | URL指定保存の構文またはスキームが不正 | no、入力修正 |
| DB_QUOTA | 保存容量不足 | no、ユーザー対応 |
| DB_TRANSACTION | DB処理失敗 | yes |
| PERMISSION_REQUIRED | 任意機能の権限不足 | ユーザー操作後 |
| CONFLICT | ローカルのrevision競合 | no、最新状態を再読込して要確認 |

UI向けメッセージと診断情報を分ける。URL、ページタイトル、AI入力などの個人データをconsoleへ常時出力しない。

## テスト方針

- Domain単体: project-vendored Unicode 15.1.0 Normalizer v1 fixture、runtime ICU差異無視、実asset hash照合、カテゴリ名のkind内一意、タグ名の親横断・kind内一意、tombstoneの名前予約、カテゴリのAI作成拒否、全TAGの親record存在、ACTIVE TAGのACTIVE親、複数カテゴリ／タグ、TAG追加時の親CATEGORY補完、CATEGORY解除時の子TAG解除、edge一意性、policyVersion 1の細分化 `0→0 / 1→1 / 2→2 / 3→4 / 4→6` と任意組合せ拒否
- Application単体: 現在タブ保存、URL指定保存、install時だけ初期化するオンボーディングの完了・途中再開、ホーム表示、AI失敗、再試行、重複要求、Bookmark／Category／Tagの確認なし論理削除と共通Undo、`UNDO_EXPIRED` / `UNDO_CONFLICT` の分離、削除→同名作成拒否→Undo成功、削除済み親を持つTag復元の競合と親先行復元、ACTIVE子Tagを持つCategory論理削除のBLOCK、全子TAG tombstone消滅前のCategory物理GC拒否
- Repository契約: IndexedDB各実装で同じテストを実行
- Service Worker結合: popupと2つのcommands、イベント途中の停止・再起動・メッセージ再送。Service WorkerからLanguageModelを呼ばないこと
- AI Host結合: 分類・AI検索・機能案内の可用性、Capability Catalog grounding、ユーザー操作、モデル取得、ページ終了、lease回収、結果再送
- AIアダプター契約: canonical intent `SEARCH_LIBRARY / PRODUCT_HELP / OUT_OF_SCOPE`、不正JSON、候補外ID、重複ID、古いrevision、長すぎる名称・検索語、プロンプト注入文字列
- 検索: 両一覧からLabel／Bookmarkを返す、Labelが先、autocomplete最大8件と種別絞込み、TAG候補に親を付ける、AI候補は無順位、候補外ID拒否、AI利用不可時の字句フォールバック
- マイグレーション: 旧平坦Labelへの親割当、親不明TAGの隔離、Unicode 15.1.0 vendored assetと実hash、正規化v1とカテゴリ／タグ名競合、JSON-safe cursor、細分化1〜5から0〜4、archiveのmetadata／payload分離、edge重複、失敗時のロールバック
- P1: 数値閾値検証、archiveのhistory権限拒否時の閾値保持・判定停止、Reminder無効化と候補単位SUPPRESSED、利用者確認前の保存禁止、最終訪問日時なしのskip、最小archiveと設定内復元、標準Bookmark非変更、context menu、QR選択集合・checksum破損検出・別親同名Tagのskip/cancel/別名再preview、Driveアカウント選択・同時編集・オフライン復帰、syncSnapshotsのhash／immutable／OPEN pin／解決後30日保持、期待revision付き明示operations、syncConflicts再検証、Label ID暗黙付替え禁止

現時点ではテストコードも実行結果も存在しない。
