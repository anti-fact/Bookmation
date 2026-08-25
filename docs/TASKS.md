# TASKS

- 状態: 実装バックログ
- 更新日: 2026-08-25
- 対象: P0実装と確定済みP1ワークパッケージ

## 運用

複数領域・半日超・DB／権限／外部 API 変更は [PLANS.md](PLANS.md) に沿う Execution Plan を先に作る。バックエンド担当の実装順と詳細は [BACKEND_TASKS.md](../BACKEND_TASKS.md)、小規模作業は [TODO.md](TODO.md)、判断待ちは [ISSUES.md](ISSUES.md)、検証証拠は [WORKLOG.md](WORKLOG.md) へ記録する。文書だけでは実装 Task を Done にしない。

## クリティカルパス

| ID       | Task                                  | 状態    | 依存                          | 完了時の成果                                                                   |
| -------- | ------------------------------------- | ------- | ----------------------------- | ------------------------------------------------------------------------------ |
| TASK-001 | 開発基盤と初期 Plan                   | Done    | ISSUE-006                     | 同じ環境・コマンドで開発開始できる                                             |
| TASK-002 | Plasmo 拡張 bootstrap                 | 進行中  | TASK-001                      | popup、dashboard、worker を開ける                                              |
| TASK-003 | JSONドキュメントデータ層              | Backlog | TASK-002                      | Bookmark / Label / Job が再読込後も残る                                        |
| TASK-004 | popup・commands・保存・初回ホーム     | Backlog | TASK-003                      | 現在ページ／URLを保存し、初回と通常のホームを開ける                            |
| TASK-014 | 初回カテゴリテンプレート              | Backlog | ISSUE-022、TASK-003、004、006 | 初回にテンプレート候補を提示し、利用者が適用したCategoryだけを安全に作成できる |
| TASK-005 | Bookmark list UI                      | 進行中  | TASK-002、003                 | 最近追加を LIST / GRID で探索・編集できる                                      |
| TASK-006 | Full-screen Category / Tag UI         | Backlog | TASK-003、005                 | 親カテゴリ／子タグを作成・管理・選択できる                                     |
| TASK-007 | Prompt API host spike                 | Done    | TASK-002、ISSUE-001           | 対応条件と fallback が実証される                                               |
| TASK-008 | AI classification / settings          | Backlog | TASK-003、006、007            | 規則どおりタグを分類できる                                                     |
| TASK-009 | Full-page search / AI assistant       | Backlog | TASK-003、006、007            | 最大8件の候補検索とAIへの検索・機能質問ができる                                |
| TASK-010 | Security / media / permissions        | Backlog | TASK-002〜004                 | 最小権限と入力検証が成立する                                                   |
| TASK-013 | UI Web preview / Playwright harness   | 進行中  | TASK-002                      | 同じUIをWebで確認し、実拡張をAIエージェントが自動確認できる                    |
| TASK-011 | Recovery / quality                    | Backlog | TASK-004〜010、013、014       | 中断・再送・大量件数に耐える                                                   |
| TASK-012 | P0 integrated demo / human acceptance | Backlog | TASK-004〜011、013、014       | AIエージェント確認後、人間が初回設定から保存・検索・編集まで受入できる         |

## Task 詳細

### TASK-001: 開発基盤と初期 Plan

- [x] `docs/plans/` に Execution Plan を作る。
- [x] Node、package manager、Plasmo、React、Tailwind、TypeScript を固定する。
- [x] `dev`、`build`、`lint`、`typecheck`、`test` を定義する。
- [x] `デザインシート.svg` の token、asset、responsive 方針を Plan に記す。
- 完了条件: 新規 checkout から同じ手順で開発を開始できる。
- 完了日: 2026-08-16。証拠は [WORKLOG.md](WORKLOG.md) と [Plan](plans/2026-08-16-dev-scaffold.md)。ISSUE-007 の日程は未決のまま TASK-001 を閉じた。

### TASK-002: Plasmo 拡張 bootstrap

- [x] productionのdashboard tabにApp Shell、共通Header、型付きhash route、error boundaryを実装する。
- [ ] product popup（保存／ホーム）とMV3 Service Workerをdashboard tabから分離し、保存導線へ接続する。
- [ ] `save-current-page` と `open-bookmation-home` commands を宣言する。
- [ ] Tailwind production build、CSP、local asset を確認する。
- 現在地: dashboard shellだけが進行済みであり、popup保存、commands、Service Workerは未実装である。
- 完了条件: Chrome でpopupと空dashboardを開き、分離したService Workerへ接続できる。App ShellだけではDoneにしない。

### TASK-003: ローカルデータ層

- [ ] [DB-SCHEMA.md](DB-SCHEMA.md) の Store、index、Repository、migration を実装する。
- [ ] Blob以外の正本を `schemaVersion` 付きJSON互換documentにし、read/write時にschema検証する。
- [ ] カテゴリの `categoryUniqueName` とタグの `tagUniqueName` を各namespaceでglobal uniqueにする。カテゴリ名とタグ名の相互一致は許可する。
- [ ] Label Normalizer v1を、project-vendored Unicode 15.1.0のNFKC／`White_Space`／`Default_Ignorable_Code_Point`／`CaseFolding.txt` C＋F assetで実装する。runtime ICUへ依存せず、生成assetのhashを実装時に固定する。
- [ ] Category／Tagのtombstone中も名前を予約し、同名別IDを拒否する。削除済みなら物理回収まで別名だけを許し、回収後に予約を解放する。
- [ ] Bookmark／Tagは確認なしのsoft-deleteとし、Categoryは警告確認後にCategory／全子Tag／関連edgeをcascade soft-deleteする。いずれもtombstoneの `deletedAt` とrevisionを保存し、削除Undo用のtoken、期限、復元経路は作らない。
- [ ] active Tagへactive親Categoryを必須とする。tombstone Tagのdeleted親参照は許し、全子Tag tombstoneが消滅するまで親Categoryの物理GCをblockする。
- [ ] BookmarkのCategory関連を選択Tagの親から自動導出する。Category直接編集は拒否し、管理モードのTag親変更ではTag／選択親のexpected revisionとsubmit開始時に1回発行する `tag-update:` requestIdを検証して、全参照BookmarkのCategory closure・revision・検索派生データ、同期Outbox、mutation receiptを原子的に更新する。同じrequest再送は同じ `UpdateTagResult` へ収束し、別payloadでのrequestId再利用を拒否する。AI再分類Jobは作らない。
- [ ] Category cascade削除、影響Bookmark、classificationSettings正本を1 transactionで扱う。CONFIGUREDかつenabledの場合だけPENDING再分類Jobを作り、disabled／再設定待ちはJobなしで残存active Tag有無からCLASSIFIED／UNCLASSIFIEDにする。AI有効時はモデル未取得／download中／AI Host不在でPENDINGを保ち、3件の `DISPATCH_RESERVED` がすべてquality-zeroの場合だけNEEDS_REVIEW、恒久非対応、`executionAttempt` 上限、またはtechnical failureを含むdispatch枯渇ではFAILEDとし、いずれも手動分類を許す。
- [ ] `(bookmarkId, labelId)` edge と作成 request を冪等にする。
- [ ] BookmarkとclassificationSettings正本を同一transactionで扱い、CONFIGUREDかつenabledの場合だけPENDING Jobも同時保存する。disabled／再設定待ちはJobなしでBookmarkを保存する。
- [ ] SearchDocument と favicon / thumbnail Blob の再構築・回収境界を作る。
- 完了条件: JSON不正、Normalizer v1、カテゴリ／タグ名競合、tombstone予約、削除後の同名作成拒否、削除Undo経路なし、namespace分離、Tag親変更の原子的fan-outとAI再分類なし、Category自動導出、Category cascadeと再分類、再送、中断migrationの自動テストが通る。

### TASK-004: popup・commands・保存

- [x] popup に保存／ホームの2ボタンを置き、開いただけでは保存しない。
- [x] `chrome.commands.getAll()` で各実キーまたは `未割り当て` を表示する。
- [x] `割り当てを変更` から `chrome://extensions/shortcuts` への遷移または手順案内を実装する。
- [ ] 2 commands を別 handler へ接続する。
- [ ] 共通ヘッダーの追加操作から、`http:` / `https:` URL、任意title、0件以上のactive Tag IDを入力、検証、保存する。TagはTASK-005と共有する順次追加componentを使い、Categoryは選択Tagの親から自動導出する。
- [x] `runtime.onInstalled` の `reason=INSTALL` だけで初回状態を初期化し、初回だけ導入ホーム、完了後は最近追加ホームを開く。
- UI-03でpopup画面、Chrome Port、保存中／成功／重複／失敗状態、Web fixtureを実装した。実保存Application、command保存、URL指定保存は未完了である。
- 完了条件: 3保存入口が共通 use case を使い、DashboardのBookmark追加ではTagを順次追加／解除して保存でき、worker 再起動でもデータを失わない。

### TASK-014: 初回カテゴリテンプレート

- [ ] ISSUE-022で候補名／件数、set構成、選択方式、初期選択、skip、名前編集、初回後の再表示、locale、catalog version、再適用と名前競合のUXを決定する。決定前に本番候補をhardcodeしない。
- [x] version付きのローカルCategory template catalogを定義し、remote fetchや実行コードを含めずbundleする。
- [x] 初回オンボーディングへtemplate stepを追加し、catalog表示だけではCategoryを作らない。途中終了時は既存のonboarding進捗から再開する。
- [x] 利用者の明示適用を通常のCategory作成use caseへ渡し、`origin=USER`、Normalizer、一意名、tombstone予約を維持する。AI用Category作成経路や `origin=TEMPLATE` を追加しない。
- [x] 複数候補の適用requestを冪等化し、応答消失後の再送、既存／tombstone同名、部分失敗、update／reloadでの意図しない再適用を扱う。
- [x] 作成されたCategoryを通常の一覧・編集・削除から扱え、既存Categoryを自動改名・削除しない。
- [ ] Webプレビュー、Playwright実拡張E2E、人間受入で未適用／適用中／成功／競合／再開状態を確認する。
- 完了条件: ISSUE-022がDecidedになり、利用者操作前のCategory件数が変わらず、明示適用後だけ通常のUSER Categoryが重複なく作成され、update／reload／retryで再作成されない。

### TASK-005: Bookmark list UI

- [x] `savedAt desc` の最近追加とlabel条件一覧を実装する。
- [x] App Headerに検索画面を開く入口とカテゴリ・タグ一覧へ移動する望遠鏡、通常flowのtoolbarに件数とLIST / GRID segmentを置く。一覧への重複buttonを置かず、toolbarをscrollへ追従させない。検索候補／結果はUI-07、AI応答はUI-08で接続する。
- [x] カテゴリを常時表示し、タグをclick / keyboard disclosure、pointer hover previewで表示する。
- [x] 全項目にedit buttonを置き、Bookmark追加と同じTag field componentでname、URL、Tagだけを変更できるmodalを実装する。Categoryは選択Tagの親から自動導出して読取表示する。
- [x] Bookmark追加／編集のTag入力は空欄から開始し、入力中に既存active候補をリアルタイムで最大8件表示する。候補または同じmodal内のside viewで新規作成したTagを `追加`／IME変換中ではないEnterで1件ずつ追加し、成功後は入力をclearしてfocusを戻す。未知Tagの自由入力はfield errorにし、暗黙作成しない。
- [x] 入力直下は `タグ n件` を左、`追加` を右に配置し、現在Tagを初期展開する。Tagは全画面カテゴリ・タグ一覧のTag chip形状を使い、Bookmark一覧のカテゴリ・タグシェブロン相当のhover／focus減光と中央解除buttonで個別に外せるようにする。
- [x] Bookmark削除は確認画面を挟まずsoft-deleteする。削除後にUndo toast、復元ボタン、Undo用errorを表示しない。
- [x] cursor infinite scroll、追加失敗 retry、終端、back-to-top を実装する。
- [x] 弁当表示、列数設定、表示数変更プルダウン、右 sidebar がないことを確認する。
- 現在地: UI-04の一覧表示に続き、UI-05で追加／編集共通modal、Tag入力、同一Dialog内のTag／Category作成side view、Bookmark即時論理削除を実装済み。検索画面はUI-07、AI応答はUI-08で接続する。
- 完了条件: 仕様書に沿う LIST / GRID をkeyboardで検索・閲覧・編集でき、Bookmark追加／編集のTagを同じ操作で連続追加／解除できる。

### TASK-006: Full-screen Category / Tag UI

- [x] 親カテゴリと、その配下の子タグを扱う全画面一覧とsticky headerを作る。
- [ ] フルページ検索とAI入力ポップアップを開くボタン、カテゴリ・タグ新規作成、名前付きcloseを置く。
- [x] 新規作成ボタンから種類をプルダウンで選び、作成modalを開く。閉じるまで連続作成できるようにする。
- [x] カテゴリ／タグ作成でtombstoneを含む各namespace内の正規化名重複を拒否する。有効項目なら元画面で選択し、削除済みなら物理回収まで別名を案内する。
- [x] タグ作成では空の親Category入力からactiveな既存Categoryをリアルタイム検索し、一致度の高い候補を最大8件から入力／選択時点で必須選択する。未知Category文字列はfield errorにし、親をまたいでも同名Tagを作らない。
- [x] Tag作成画面にCategory新規作成ボタンを置き、同じmodal内のside viewへ移る。Tag入力draftを保持し、Category作成後はTag作成へ戻って新規Categoryを自動選択する。
- [x] headerの管理ボタンで管理モードへ切り替え、カテゴリリボン／タグチップのhover・focus時だけ鉛筆を示し、選択で編集modalを開く。
- [x] Tag編集modalは名前、親Category、作成元、利用件数を表示し、名前と親を変更できるようにする。親Category入力は現在値を選択済みで開始し、activeな正規化完全一致または最大8候補からの選択時点で置き換える。Category用の `追加` buttonは置かず、未知文字列はfield errorにする。説明横の新規作成から同じmodal内のCategory作成side viewへ移り、Tag draftを保持して、作成後は新規Categoryを自動選択する。
- [x] Tag親変更の保存ではTag／選択親expected revisionと `tag-update:` requestIdを送り、Tag IDとglobal unique名規則を維持したまま、全参照BookmarkのCategory closure・revision・検索文書を1 transactionで更新する。同じrequest再送はmutation receiptの同じ `UpdateTagResult` へ収束し、別payload再利用を拒否する。競合・失敗は全件rollbackし、AI再分類を行わない。
- [x] Category編集modalに、使用中Tagの実名一覧と件数、関連Bookmarkのunique件数を表示する。
- [x] Bookmark／Tagは確認画面を挟まずsoft-deleteし、削除Undoの操作や復元経路を用意しない。
- [ ] Category削除だけは、全子Tagと関連edgeの連鎖削除、Tag件数、関連Bookmark unique件数、AI有効時の再分類を警告する。確認後にcascade soft-deleteしてBookmarkを保持する。CONFIGUREDかつenabledの場合だけ再分類し、モデル未取得／download中／AI Host不在はPENDING、3 dispatchすべてquality-zeroはNEEDS_REVIEW、恒久非対応、execution上限、またはtechnical failure込みのdispatch枯渇はFAILEDとする。disabled／再設定待ちはJobを作らずCLASSIFIED／UNCLASSIFIEDへ戻し、全状態で手動分類を許す。
- [ ] label selection、infinite scroll、back-to-top、直前状態復元を実装する。
- 完了条件: 親子関係をIDで識別し、通常モードでは対象Bookmark一覧へ移動し、管理モードでは作成・編集・削除をキーボードでも行える。

### TASK-007: Prompt API host spike

- [x] [ISSUES.md](ISSUES.md) ISSUE-001 を公式仕様と実機で解決する。
- [x] 対応する top-level extension page で Prompt API を実行する。
- [x] availability、download、activation、日本語、structured output を検証する。
- [ ] Service Worker / 未確認 Offscreen から LanguageModel を呼ばない。
- 完了条件: 対応条件、最低Chrome、AI Host、fallback が証拠付きで一致する。

### TASK-008: AI classification / settings

- [ ] AIが1試行で候補内のactive USER Categoryを厳密に1件選び、COREが同等なら同等USER Tagを持つCategory、次に他originの同等Tagを持つCategoryを優先し、それでも一意でなければquality-zeroにする。全AI Tag候補を選択Category配下にし、新規Category、既存Tagの親変更を拒否するschema / domain検証を作る。
- [ ] [AI_GUIDE.md](AI_GUIDE.md) の固定promptとREUSE／CREATE出力を実装する。選択Category内の完全一致、正規化一致、同義語、正式名／略称、翻訳、表記揺れは全値でREUSEしてUSERタグを優先し、選択Category外にだけ同等Tagがある概念はREUSE／CREATE／親変更せず省くようGemini Nanoへ指示する。信頼側はID、親、revision、normalizedName一致を決定的に検証し、異名同義はversion付きoracleの実モデル評価で判定する。
- [ ] 現行製品はGemini Nano固定のまま、版付きprompt最適化と決定的な入出力サニタイザーを同一fixture・端末条件で比較する。別の端末内 `ClassificationProvider` は将来Gemini Nano前提を製品全体で置き換える候補として隔離評価し、既存品質基準を満たした候補だけでモデル呼出し時間／Job終端時間のp50・p95を評価する。採用は別の仕様変更とし、Provider選択UI、利用者別・Job別切替、実行時fallbackを実装しない。Provider／prompt／sanitizer versionは再現性のためJobとartifactへ固定する。
- [ ] 全画面Settingsの細分化sliderを整数 `0`〜`4` に限定し、Jobへpolicy version 2のgranularity／reusePolicy／allowedCreateImportanceをsnapshotする。Tag件数上限へ変換しない。
- [ ] 0／1はCORE、2はMAJORまで、3はSUPPORTINGまで、4はDETAILまでCREATEできるようにし、再利用できる意味範囲も値ごとに変える。値0でも中心主題を既存Tagで表せなければ必要最小限のCOREをCREATEできる。
- [ ] lease、revision、creationRequestId で中断・再送を冪等にする。
- [ ] `tagUniqueName` 競合はoriginを問わず既存Tagを再評価し、選択Category内の同じnormalizedNameではUSERを優先してREUSEへ解決する。親不一致またはtombstone競合はその候補だけを棄却し、異名同義を未定義の意味推測で変換・棄却しない。
- [ ] 正常候補が1件以上なら、既付与の冪等REUSEを含む同じ試行の全正常候補を1 transactionで適用して終了する。先頭N件／confidence上位N件へ切らず、試行間で候補を結合・多数決しない。
- [ ] JSON／envelope不正、`outcome=NEEDS_REVIEW`、Category不正、全candidate棄却をquality-zeroとし、timeout、応答切断、truncated、応答byte上限超過、dispatch後の結果喪失をtechnical failureとして区別する。3件の `DISPATCH_RESERVED` がすべてquality-zeroの場合だけJob／BookmarkをNEEDS_REVIEW、technical failureを含んで枠を使い切った場合はFAILEDにする。
- [ ] accepted／rejected診断と個人データなしの理由コードを保存する。成功した再分類では今回の正常Tag候補集合を現在のAI割当集合とし、以前の `assignedBy=AI` TAG edgeのうち集合外だけを論理削除する。残るAI TAG edgeは現在Jobへ更新し、USER／IMPORT／SHAREおよびUSERへ昇格済みのTAG edgeは削除せず、AI REUSEでも `assignedBy`、confidence、provenanceを上書きしない。手動明示選択時はAI TAG edgeをUSERへ昇格し、派生CATEGORY edgeはactive TAG寄与をUSER、IMPORT、SHARE、AIの順で再導出してconfidence／classificationJobIdをnullにする。
- [ ] 全新規v2 JobのmodelAttempt／executionAttempt、attempt配列、active tokenを0／空／nullへ初期化する。transaction開始時の同じnowに対してleaseExpiresAt > nowだけを有効、<= nowを失効とする。所有者なし／期限切れJobの所有権取得claimが成功するたび、executorInstanceIdが同じでも `executionAttempt` と `leaseNonce` を進める。有効なleaseNonceによるrenew、同じlease内の結果再送、DB retryでは増やさない。結果受付とfinalizerをreadwrite transactionのcommit順で直列化する。3回目leaseが有効な間は処理を許し、4回目claimが必要な時だけ新ownerなしのfinalizerでFAILEDにする。Prompt API未取得／download中／AI Host不在ではclaimせずPENDING、恒久非対応もFAILEDにする。
- [ ] snapshot再検証後にattemptを `PREPARED` として保存し、executionAttemptが3未満でleaseを失ったPREPAREDはmodelAttemptを消費せず `ABANDONED_PRE_DISPATCH`／CLOSEDへ回収する。3回目lease失効ではfinalizerがPREPARED／DISPATCH_RESERVED／VALIDATEDをphase別規則で閉じ、attempt／pendingApply／executor／lease／activeInputKeyを原子的にclearする。AI Hostへ許可する直前の条件付き `DISPATCH_RESERVED` commitだけで最大3枠のmodelAttemptを確定し、同じattemptIdを再dispatchしない。結果はjobId、attemptId、modelAttempt、inputFingerprint、leaseNonceの完全一致を必須とする。
- [ ] 正常候補が1件以上なら、生応答ではなく検証済み候補だけを持つ `pendingApply` を先に永続化する。process loss、同じlease内の結果再送、DB retryではこれを再検証して適用を再開し、executionAttemptを増やさずモデルも再呼出ししない。
- [ ] モデル呼出し前と適用直前はdurable gate不在とclassificationSettings正本のstateを先に確認する。disabled／再設定待ちはfingerprintを作らずCANCELED_SETTINGS／CLOSED、差替えなし、bookmarkStateBeforeJob復帰へ進む。CONFIGUREDかつenabledの場合だけBookmark／Category／Tagの同じ決定的query・並びからbase input fingerprintを再計算し、staleならuniqueな `activeInputKey=(bookmarkId, newInputFingerprint)` を使った現在snapshotのversion 2 Job get-or-createとBookmark PENDINGを同じtransactionで行う。同じrequest／activeInputKeyは既存Jobへ収束し、新JobはmodelAttempt 0から始める。
- [ ] version別decoderを先に導入し、raw chrome.storage.localのschemaVersion／settingsSchemaVersion／aiEnabled／aiGranularityを既存helperを通さず型付きsnapshot・hash付きdurable migration gateへ固定する。LOCAL_SETTINGS_V1のschemaVersion=1、settingsSchemaVersion／aiEnabled欠損、整数granularity 0〜4だけを暗黙enabledで同じslider位置のv2へ移し、それ以外は再設定待ちにする。gate中は全設定read／writeと分類設定依存command／background処理を無変更で待機させる。versionchange transactionでclassificationSettings Storeとunique `byActiveInputKey` indexを作り、試作v2の旧activeInputKeyを外し、version 1 recordにはkeyを付けない。enabledの場合だけupgrade後のdata migration transactionでv2 Jobをget-or-createし、commit後はmigration ownerだけが正本mirrorを修復・照合してgateを閉じる。中断時は同snapshotから冪等再開する。
- [ ] retryContextをallowlist済み理由コードだけに限定し、生の前回出力やページ文字列を含めずbase input fingerprintから除外する。
- 完了条件: Category生成拒否と厳密な1件選択、選択Category内／外の同等Tag規則、USERタグ優先、全5値、正常候補全件採用、混在候補、quality-zero／technical failure、3件のDISPATCH_RESERVED枠、PREPARED回収、3回目lease失効finalizer、late response拒否、pendingApply再開、lease所有権取得claim時のexecutionAttempt加算、設定state先行分岐、候補集合fingerprint再計算、activeInputKeyによるstale get-or-create、再分類のAI TAG edge置換／手動USER昇格／派生CATEGORY provenance／非AI保持、LOCAL_SETTINGS_V1 allowlist、durable gate全command排他、v1履歴／移行とindex作成順、PENDING／NEEDS_REVIEW／FAILED、タグ名競合、transaction rollbackを決定的fixtureで再現できる。

### TASK-009: Full-page search / AI assistant

- [x] ブックマーク一覧とカテゴリ・タグ一覧のどちらからでも、同じフルページ検索画面へ切り替える。
- [x] keyword入力中に一致度の高いLabel / Bookmark候補をGoogle検索型の候補リストとして最大8件表示し、選択で対象へ移動する。
- [x] カテゴリ・タグ結果を上、Bookmark結果を下に表示し、IME、0件、8件、9件以上、古いresponseを扱う。
- [x] `AiAgentPopup` 内で自然言語の入力と応答確認を完結させ、Label / Bookmark候補集合を生成する。
- [x] AI入力はBookmark探索に限らず、設定、保存、分類、共有、アーカイブ復元などBookmationの機能全般の説明を受け付ける。
- [ ] AI は提示済み ID から選択だけを行い、候補外ID、重複、古いrevisionを拒否する。
- [x] AIの検索結果はカテゴリ・タグを上、Bookmarkを下に表示する。AI結果はrank、score、best表現を出さない。
- [x] AI配列順を捨て、中立な安定順で描画する。
- [x] IME、0件、古いresponse、AI不可時の lexical fallback を実装する。
- [x] query、展開語、自由文理由を永続化しない。
- 現在地: UI-07で共通keyword comboboxと全画面結果、UI-08で非永続のAI panel、Prompt API意図分類、版付き機能案内、字句fallbackを実装済み。モデルに候補IDを生成させず、Service Workerが返した現行候補だけを表示する。提示候補からAIがID集合を選ぶ二段階backend契約は未接続である。
- 完了条件: 両入口のフルページkeyword検索、最大8候補、AIポップアップでの検索／機能案内、固定グループ順、無順位AI候補のcomponent / integration testが通る。

### TASK-010: Security / media / permissions

- [ ] `storage`、`activeTab`、commands を基準に Manifest をレビューする。
- [ ] URL、title、Label名、AI出力、JSON document、message payloadを未信頼入力として検証する。
- [ ] 保存時に `og:image` を第一候補として取得し、MIME、寸法、容量、content hashを検証してlocal Blob化する。失敗時は外部URLを参照せず同梱のBookmationロゴ画像へ縮退し、画面キャプチャは行わない。
- [ ] remote code、外部画像追跡、危険 scheme、PII log を防ぐ。
- 完了条件: [SECURITY.md](SECURITY.md) の P0 条件を自動／手動テストで満たす。

### TASK-013: UI Web preview / Playwright harness

- [ ] [TESTING.md](TESTING.md) の通常Webページとして、production React componentとTailwind tokenをfake Adapterで表示する。
- [x] UI-01のproduction tokenとButton／Dialog／Switch／Slider／SelectをVite component sheetで表示し、`ui:preview`／`ui:build`を実装する。
- [x] UI-02のproduction App Shell、共通Header、型付きhash routeを全画面Web fixture `?view=app-shell#/home` で直接開けるようにする。
- [x] 最終UI-02 tab bundle（SHA-256 `d69840b75916e63bb5f45dadbb1b84713608bc7b6984546c1986f8149dc8aa51`）をunpacked extensionとして一回限りでPlaywright確認し、見出しfocus、ブラウザBack＋scroll復元、直接指定fallback、320 px／768 px reflow、console errorなしを確認する。ただし再実行可能なrepository harness／CI／report／traceではない。
- [x] UI-03のproduction popupを使うWeb fixtureで、shortcut割当済み／未割当、保存中／成功／重複／失敗、shortcut取得失敗を直接開けるようにする。
- [x] UI-04のproduction Bookmark一覧を使うWeb fixture `?view=bookmarks&fixture=grid#/home` で、GRID／LIST／空／1件／多数／読込中／初回失敗／追加失敗を直接開けるようにする。
- [ ] popup、ホーム、カテゴリ一覧、主要dialogと、空／通常／大量／エラー／権限拒否等の版管理fixtureを直接開けるようにする。
- [ ] 初回ホーム、未適用／適用済み／競合／再開のCategory template step、検索候補0／8／9件以上、AI検索／機能質問、Unicode 15.1.0 vendored Normalizer asset＋hash、Bookmark追加／編集の空Tag入力・リアルタイム候補・`タグ n件`／`追加`配置・追加／Enter・初期展開・個別解除・未知Tag error、Tag作成／編集のCategory初期選択・候補／side view／未知Category error／draft、親変更の0件／1件／多数Bookmark参照・revision競合・同request再送／別payload再利用拒否・rollback・AI再分類なし、Category使用状況、Bookmark／Tagの確認なしdelete、Category警告付きcascade deleteとAI有効時再分類／無効時Jobなし、削除Undo経路なし、AI policy version 2全5値・selected Category内外の同等Tag規則・候補単位棄却・正常候補全件・quality-zero／technical failure・3 DISPATCH_RESERVED・PREPARED回収・pendingApply・stale収束・再分類edge・設定gate付きv1移行・PENDING／NEEDS_REVIEW／FAILED、設定境界値、URL単位SUPPRESSED、archive権限gate／履歴なしエラー／復元、Drive／QR／CSVをfixture化する。
- [ ] `test:e2e`、`test:e2e:ui` scriptを実装する。実装済みの`ui:preview`／`ui:build`を含め、preview／fixture／debug UIを本番拡張成果物から除外する。
- [ ] Playwrightの隔離persistent Chromium contextへビルド済み拡張機能を読み込み、popupと `chrome-extension://` ページを操作する。
- [ ] AIエージェントがHTML report、失敗時screenshot、trace、console error、skipを保存して人間へ渡せるようにする。
- [ ] screenshot基準の更新と最終受入を人間の明示操作に限定する。
- 完了条件: WebプレビューだけではE2E成功にならず、AIエージェントのPlaywright成功後に人間が同じcommit／buildを承認または差戻しできる。

### TASK-011: Recovery / quality

- [ ] worker停止、AI Host終了、message再送、DB transaction失敗に加え、正常候補1件以上で即終了、全正常候補適用、quality-zero／technical failureの分離、3 DISPATCH_RESERVED枠、PREPAREDの非消費回収、late response拒否、pendingApplyからの再開、lease所有権取得claim時のexecutionAttempt加算、候補集合fingerprint再計算、AI enabled gate付きactiveInputKey stale処理、retryContext allowlist、試行間非結合、再分類時のAI TAG edge置換／手動USER昇格／派生CATEGORY provenance／非AI保持、v1設定snapshot migration／unique index作成順、正常集合の原子的rollbackをテストする。
- [ ] Bookmark／Tagの確認なし削除、Category警告後のcascade soft-delete、影響Bookmark保持をテストする。CONFIGUREDかつenabledではモデル待機時PENDING／3 dispatchすべてquality-zero時NEEDS_REVIEW／恒久非対応・execution上限・technical failure込みdispatch枯渇時FAILED、disabled／再設定待ちはJobなしのCLASSIFIED／UNCLASSIFIEDとする。削除後の同名作成拒否、削除Undo経路がないこと、物理回収後の名前再利用も確認する。
- [ ] runtime ICU差に依存しないNormalizer golden vector、active／tombstone Tagの親状態、子Tag tombstone残存中の親GC拒否をテストする。
- [ ] Tag親変更で全参照BookmarkのCategory edge、revision、SearchDocumentが原子的に更新されること、途中失敗で全件rollbackすること、同じrequest再送はreceiptへ収束し別payload再利用を拒否すること、AI再分類Jobを作らないことをテストする。
- [ ] 1万件規模でinfinite scroll、count、フルページkeyword候補、可変高タグを測る。
- [ ] keyboard、screen reader、200% zoom、sticky offset、dialog、back-to-top を確認する。
- [ ] lint、typecheck、unit、component、E2E、build を CI で実行する。
- [ ] PlaywrightのHTML report、trace、screenshotと、Webプレビューの静的成果物を人間が確認できる形で保存する。
- 完了条件: 障害回復と品質コマンドの結果を WORKLOG に残し、skip／flaky／未実施をpassと区別できる。

### TASK-012: P0 integrated demo

- [ ] 初回ホーム、Category templateの明示適用、popup shortcut表示、現在ページ／URL保存、分類、settings、フルページkeyword、AI検索／機能質問、Tag-only Bookmark edit、Tag／Category side view作成、Tag親変更fan-out、Category cascade delete／再分類を一連にする。
- [ ] LIST / GRID、infinite scroll、full-screen category list、back-to-topを示す。
- [ ] AI対応／非対応の両経路を用意する。
- [ ] [REQUIREMENTS.md](REQUIREMENTS.md) の P0 を照合する。
- [ ] AIエージェントがPlaywrightで同じcommit／buildを確認し、証拠と未実証事項を引き渡す。
- [ ] 人間が実Chromeで主要導線とAIエージェントのreport／差分を確認し、承認または差戻しを記録する。
- 完了条件: 新規Chrome profileで手順を再現し、[TESTING.md](TESTING.md) の順序でAIエージェント確認と人間受入が完了し、未完了を明示できる。

## P1 確定タスク

機能の採用は確定済みである。P0完了後に着手し、各権限／同期変更は個別Execution Planを先に作る。

| ID       | Task                           | 状態    | 主な依存           | 完了時の成果                                                                          |
| -------- | ------------------------------ | ------- | ------------------ | ------------------------------------------------------------------------------------- |
| TASK-101 | 訪問日数閾値と保存リマインダー | Done | TASK-003、004、010 | 期間内の訪問日数とURL別resetに従い、確認したURLだけ保存できる                         |
| TASK-102 | 権限gate付き自動archive        | Backlog | TASK-003、101      | 既定30日、history許可時だけON、履歴なしエラー、最小archive、設定一覧復元を実装できる  |
| TASK-103 | QR／CSV共有・QR読取取込        | Backlog | TASK-003、010      | 同じ選択集合をQR／CSVでexportし、QR容量超過をCSVへ誘導できる                          |
| TASK-104 | Google Drive同期・権限共有     | Backlog | TASK-003、010、011 | 同一アカウント同期と別アカウント共有を混ぜずに扱える                                  |
| TASK-105 | Chrome標準Bookmarkインポート   | Backlog | TASK-003、010      | 元treeを変えずpreview後に専用領域へコピーできる                                       |
| TASK-106 | context menu保存               | Backlog | TASK-003、004、010 | 一般設定toggleに従ってpage／link menuを登録／解除し、ON時だけ共通use caseで保存できる |

### P1タスクの確定受け入れ条件

- **TASK-101**: 設定画面で訪問集計期間を1週間／1ヶ月／1年から選び、既定値なしの訪問日数閾値を数値入力する。期間変更時は入力を消去し、直近7／30／365日に応じて1〜7／1〜30／1〜365へ制限する。同日の複数訪問は1日とし、`いいえ` は対象canonical URLの集計を応答時刻でリセットする。`frequentVisitReminderEnabled` で全体を有効／無効にでき、「次回以降表示しない」はそのURLだけをSUPPRESSEDにし、確認前には保存しない。
- **TASK-102**: `autoArchiveEnabled` は既定OFFとし、利用者gestureからhistory権限が許可された場合だけONへcommitする。拒否／取消はOFFを維持し、後発取消ではOFFへ戻してalarmを止める。アーカイブ日数は既定30の正整数入力とする。履歴なしは `ARCHIVE_HISTORY_NOT_FOUND` と `履歴がないためアーカイブできません` を項目別に表示し、Bookmarkをarchiveしない。notificationsは要求しない。archive後はカテゴリ・タグ、ページ名、URLだけを保持し、設定のリストから復元する。
- **TASK-103**: カテゴリ別、タグ別、個別Bookmarkを検索とcheckboxで選び、同じ固定集合をQRまたはCSVでexportする。QR容量超過では分割・切捨てせず `QR_CAPACITY_EXCEEDED` とCSV actionを返す。CSVは固定header、UTF-8、escaping、数式注入neutralization、秘密情報除外を検証する。checksumは破損／切詰め検出だけで真正性を保証しない。QR読取取込の異親同名Tagは既存再利用／親変更せず、別名／skip／cancel後に再previewする。CSV importは要求しない。
- **TASK-104**: 設定でGoogleアカウントを明示選択する。同一アカウント端末間同期は `appDataFolder` を使い、`appDataFolder` 自体は別アカウントへ共有しない。別アカウント共有は通常Drive file＋permissions/capabilities検証という別経路にする。同一field更新、update-delete、add-delete、名前競合を自動LWWせず `syncConflicts` へ隔離する。local／remote／baseをimmutableな `syncSnapshots` として保持し、版付きの明示resolution planだけを適用する。open中はGCせず、解決後30日保持し、Label ID／edgeを暗黙にremapしない。
- **TASK-105**: `chrome.bookmarks` treeの各URL nodeから直上Folderを1件だけ解決し、そのFolder名だけをTagとして付与する。祖先／full pathをLabel化せず、AI分類を同時実行しない。同名active Tagは再利用し、新規Tagはpreviewでactive Categoryを選択または同一導線で作成してから `origin=IMPORT` で作る。空／不正Folder名とtombstone同名はskip／cancelにし、深いtree、同名leaf Folder、重複URL、中断再開、再送でも元tree不変と1 Bookmark＝Folder由来Tag 1件を保証する。
- **TASK-106**: 一般設定に `contextMenuBookmarkEnabled` switchを置き、旧settingsのfield欠損はONへ移行する。ONではpage／linkの固定IDを各1件だけ表示し、OFFではBookmation所有IDだけを解除する。設定は端末固有でDrive同期せず、Service Worker再起動後も整合し、OFF直前の遅延clickでは保存しない。登録／解除失敗時は以前の実効値へ戻してエラーを表示する。

## 更新規則

- 着手時に担当、Plan、開始日、状態を追記する。
- 完了時はコマンド、test、手動確認を [WORKLOG.md](WORKLOG.md) へ記録する。
- 要件変更は先に REQUIREMENTS / DESIGN / UI を更新する。
- 暫定策は [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) へ解消条件付きで登録する。
