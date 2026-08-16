# TASKS

- 状態: 実装バックログ
- 更新日: 2026-08-17
- 対象: P0実装と確定済みP1ワークパッケージ

## 運用

複数領域・半日超・DB／権限／外部 API 変更は [PLANS.md](PLANS.md) に沿う Execution Plan を先に作る。バックエンド担当の実装順と詳細は [BACKEND_TASKS.md](../BACKEND_TASKS.md)、小規模作業は [TODO.md](TODO.md)、判断待ちは [ISSUES.md](ISSUES.md)、検証証拠は [WORKLOG.md](WORKLOG.md) へ記録する。文書だけでは実装 Task を Done にしない。

## クリティカルパス

| ID | Task | 状態 | 依存 | 完了時の成果 |
| --- | --- | --- | --- | --- |
| TASK-001 | 開発基盤と初期 Plan | Done | ISSUE-006 | 同じ環境・コマンドで開発開始できる |
| TASK-002 | Plasmo 拡張 bootstrap | Backlog | TASK-001 | popup、dashboard、worker を開ける |
| TASK-003 | JSONドキュメントデータ層 | Backlog | TASK-002 | Bookmark / Label / Job が再読込後も残る |
| TASK-004 | popup・commands・保存・初回ホーム | Backlog | TASK-003 | 現在ページ／URLを保存し、初回と通常のホームを開ける |
| TASK-005 | Bookmark list UI | Backlog | TASK-002、003 | 最近追加を LIST / GRID で探索・編集できる |
| TASK-006 | Full-screen Category / Tag UI | Backlog | TASK-003、005 | 親カテゴリ／子タグを作成・管理・選択できる |
| TASK-007 | Prompt API host spike | Backlog | TASK-002、ISSUE-001 | 対応条件と fallback が実証される |
| TASK-008 | AI classification / settings | Backlog | TASK-003、006、007 | 規則どおりタグを分類できる |
| TASK-009 | Full-page search / AI assistant | Backlog | TASK-003、006、007 | 最大8件の候補検索とAIへの検索・機能質問ができる |
| TASK-010 | Security / media / permissions | Backlog | TASK-002〜004 | 最小権限と入力検証が成立する |
| TASK-013 | UI Web preview / Playwright harness | Backlog | TASK-002 | 同じUIをWebで確認し、実拡張をAIエージェントが自動確認できる |
| TASK-011 | Recovery / quality | Backlog | TASK-004〜010、013 | 中断・再送・大量件数に耐える |
| TASK-012 | P0 integrated demo / human acceptance | Backlog | TASK-004〜011、013 | AIエージェント確認後、人間が保存から検索・編集まで受入できる |

## Task 詳細

### TASK-001: 開発基盤と初期 Plan

- [x] `docs/plans/` に Execution Plan を作る。
- [x] Node、package manager、Plasmo、React、Tailwind、TypeScript を固定する。
- [x] `dev`、`build`、`lint`、`typecheck`、`test` を定義する。
- [x] `デザインシート.svg` の token、asset、responsive 方針を Plan に記す。
- 完了条件: 新規 checkout から同じ手順で開発を開始できる。
- 完了日: 2026-08-16。証拠は [WORKLOG.md](WORKLOG.md) と [Plan](plans/2026-08-16-dev-scaffold.md)。ISSUE-007 の日程は未決のまま TASK-001 を閉じた。

### TASK-002: Plasmo 拡張 bootstrap

- [ ] popup、dashboard tab、MV3 Service Worker を分離する。
- [ ] `save-current-page` と `open-bookmation-home` commands を宣言する。
- [ ] Tailwind production build、CSP、local asset を確認する。
- 完了条件: Chrome で popup と空 dashboard を開ける。

### TASK-003: ローカルデータ層

- [ ] [DB-SCHEMA.md](DB-SCHEMA.md) の Store、index、Repository、migration を実装する。
- [ ] Blob以外の正本を `schemaVersion` 付きJSON互換documentにし、read/write時にschema検証する。
- [ ] カテゴリの `categoryUniqueName` とタグの `tagUniqueName` を各namespaceでglobal uniqueにする。カテゴリ名とタグ名の相互一致は許可する。
- [ ] Label Normalizer v1を、project-vendored Unicode 15.1.0のNFKC／`White_Space`／`Default_Ignorable_Code_Point`／`CaseFolding.txt` C＋F assetで実装する。runtime ICUへ依存せず、生成assetのhashを実装時に固定する。
- [ ] Category／Tagのtombstone中も名前を予約し、同名別IDを拒否する。削除済みIDの明示復元か別名だけを許し、物理回収後に予約を解放する。
- [ ] Bookmark／Category／Tagの削除へ `deleteOperationId` と対象revisionを保存し、undoで照合する。
- [ ] active Tagへactive親Categoryを必須とする。tombstone Tagのdeleted親参照は許すが、Tag restoreは親restore後だけにし、全子Tag tombstoneが消滅するまで親Categoryの物理GCをblockする。
- [ ] `(bookmarkId, labelId)` edge と作成 request を冪等にする。
- [ ] Bookmark と PENDING Job を同一 transaction で保存する。
- [ ] SearchDocument と favicon / thumbnail Blob の再構築・回収境界を作る。
- 完了条件: JSON不正、Normalizer v1、カテゴリ／タグ名競合、tombstone予約、削除→同名作成拒否→undo、`UNDO_EXPIRED`／`UNDO_CONFLICT`、namespace分離、複数カテゴリ／タグ、再送、中断migrationの自動テストが通る。

### TASK-004: popup・commands・保存

- [ ] popup に保存／ホームの2ボタンを置き、開いただけでは保存しない。
- [ ] `chrome.commands.getAll()` で各実キーまたは `未割り当て` を表示する。
- [ ] `割り当てを変更` から `chrome://extensions/shortcuts` への遷移または手順案内を実装する。
- [ ] 2 commands を別 handler へ接続する。
- [ ] `http:` / `https:` URL の直接入力、検証、保存を実装する。
- [ ] `runtime.onInstalled` の `reason=INSTALL` だけで初回状態を初期化し、初回だけ導入ホーム、完了後は最近追加ホームを開く。
- 完了条件: 3保存入口が共通 use case を使い、worker 再起動でもデータを失わない。

### TASK-005: Bookmark list UI

- [ ] `savedAt desc` の最近追加とlabel条件一覧を実装する。
- [ ] sticky headerに検索画面を開く入口、AI button、件数、LIST / GRID segmentを置く。
- [ ] カテゴリを常時表示し、タグをclick / keyboard disclosure、pointer hover previewで表示する。
- [ ] 全項目にedit buttonを置き、name、URL、カテゴリ、タグを別々に変更できるmodalを実装する。
- [ ] カテゴリ／タグ入力中に既存候補を最大8件表示し、各説明横の新規作成ボタンから同じmodal内のside viewへ移る。
- [ ] Bookmark削除も確認画面を挟まずsoft-deleteし、`deleteOperationId`＋revisionが一致するundo toastから復元する。期限切れとrevision競合を別表示にする。
- [ ] cursor infinite scroll、追加失敗 retry、終端、back-to-top を実装する。
- [ ] 弁当表示、列数設定、表示数変更プルダウン、右 sidebar がないことを確認する。
- 完了条件: デザインシートに沿う LIST / GRID を keyboard で検索・閲覧・編集できる。

### TASK-006: Full-screen Category / Tag UI

- [ ] 親カテゴリと、その配下の子タグを扱う全画面一覧とsticky headerを作る。
- [ ] フルページ検索とAI入力ポップアップを開くボタン、カテゴリ・タグ新規作成、名前付きcloseを置く。
- [ ] 新規作成ボタンから種類をプルダウンで選び、作成modalを開く。閉じるまで連続作成できるようにする。
- [ ] カテゴリ／タグ作成でtombstoneを含む各namespace内の正規化名重複を拒否する。有効項目なら元画面で選択、削除済みなら同じIDの明示復元、または別名を案内する。
- [ ] タグ作成では親カテゴリを必須選択し、親をまたいでも同名タグを作らない。タグ親変更はP0で提供しない。
- [ ] headerの管理ボタンで管理モードへ切り替え、カテゴリリボン／タグチップのhover・focus時だけ鉛筆を示し、選択で編集modalを開く。
- [ ] タグ編集modalに親カテゴリを読取専用で表示する。親カテゴリ変更は [ISSUE-019](ISSUES.md) 決定後の別タスクとし、P0 commandへ含めない。
- [ ] カテゴリ／タグ削除は確認画面を挟まずsoft-deleteし、`deleteOperationId`＋revision照合undoを用意する。`UNDO_EXPIRED`／`UNDO_CONFLICT` を分ける。
- [ ] 子タグが残るカテゴリはBLOCKし、「子タグを削除」「中止」だけを案内する。cascade deleteやタグ移動を出さない。
- [ ] label selection、infinite scroll、back-to-top、直前状態復元を実装する。
- 完了条件: 親子関係をIDで識別し、通常モードでは対象Bookmark一覧へ移動し、管理モードでは作成・編集・削除・復元をキーボードでも行える。

### TASK-007: Prompt API host spike

- [ ] [ISSUES.md](ISSUES.md) ISSUE-001 を公式仕様と実機で解決する。
- [ ] 対応する top-level extension page で Prompt API を実行する。
- [ ] availability、download、activation、日本語、structured output を検証する。
- [ ] Service Worker / 未確認 Offscreen から LanguageModel を呼ばない。
- 完了条件: 対応条件、最低Chrome、AI Host、fallback が証拠付きで一致する。

### TASK-008: AI classification / settings

- [ ] AIが既存USERカテゴリだけを選び、新規カテゴリを作れないschema / domain検証を作る。
- [ ] USERタグを優先し、不足時だけAIタグを作る。
- [ ] 全画面Settingsの細分化sliderを整数 `0`〜`4` に限定し、Jobへ `{ granularity, maxNewTags }` のdiscriminated snapshotとして `0→0 / 1→1 / 2→2 / 3→4 / 4→6` を固定する。
- [ ] 値 `0` ではAIによる新規タグ作成だけを禁止し、既存タグの自動選択・付与は継続する。
- [ ] lease、revision、creationRequestId で中断・再送を冪等にする。
- [ ] `tagUniqueName` 競合はoriginを問わず既存Tagを再評価し、USERを優先する。親／意味不適合なら関連付けず `NEEDS_REVIEW` にする。
- [ ] 提案の修正、取消、NEEDS_REVIEW を実装する。
- 完了条件: カテゴリ生成拒否、USERタグ優先、上限、中断、タグ名競合をfixtureで再現できる。

### TASK-009: Full-page search / AI assistant

- [ ] ブックマーク一覧とカテゴリ・タグ一覧のどちらからでも、同じフルページ検索画面へ切り替える。
- [ ] keyword入力中に一致度の高いLabel / Bookmark候補をGoogle検索型の候補リストとして最大8件表示し、選択で対象へ移動する。
- [ ] カテゴリ・タグ結果を上、Bookmark結果を下に表示し、IME、0件、8件、9件以上、古いresponseを扱う。
- [ ] `AiAgentPopup` 内で自然言語の入力と応答確認を完結させ、Label / Bookmark候補集合を生成する。
- [ ] AI入力はBookmark探索に限らず、設定、保存、分類、共有、復元などBookmationの機能全般の説明を受け付ける。
- [ ] AI は提示済み ID から選択だけを行い、候補外ID、重複、古いrevisionを拒否する。
- [ ] AIの検索結果はカテゴリ・タグを上、Bookmarkを下に表示する。AI結果はrank、score、best表現を出さない。
- [ ] AI配列順を捨て、中立な安定順で描画する。
- [ ] IME、0件、古いresponse、AI不可時の lexical fallback を実装する。
- [ ] query、展開語、自由文理由を永続化しない。
- 完了条件: 両入口のフルページkeyword検索、最大8候補、AIポップアップでの検索／機能案内、固定グループ順、無順位AI候補のcomponent / integration testが通る。

### TASK-010: Security / media / permissions

- [ ] `storage`、`activeTab`、commands を基準に Manifest をレビューする。
- [ ] URL、title、Label名、AI出力、JSON document、message payloadを未信頼入力として検証する。
- [ ] favicon / thumbnail の MIME、寸法、容量、local Blob、代替表示を実装する。
- [ ] remote code、外部画像追跡、危険 scheme、PII log を防ぐ。
- 完了条件: [SECURITY.md](SECURITY.md) の P0 条件を自動／手動テストで満たす。

### TASK-013: UI Web preview / Playwright harness

- [ ] [TESTING.md](TESTING.md) の通常Webページとして、production React componentとTailwind tokenをfake Adapterで表示する。
- [ ] popup、ホーム、カテゴリ一覧、主要dialogと、空／通常／大量／エラー／権限拒否等の版管理fixtureを直接開けるようにする。
- [ ] 初回ホーム、検索候補0／8／9件以上、AI検索／機能質問、Unicode 15.1.0 vendored Normalizer asset＋hash、tombstone予約と親子restore／GC、3 entityのdelete／undo、AI snapshot、設定境界値、URL単位SUPPRESSED、archive復元、Drive／QRをfixture化する。
- [ ] `ui:preview`、`ui:build`、`test:e2e`、`test:e2e:ui` scriptを実装し、preview／fixture／debug UIを本番拡張成果物から除外する。
- [ ] Playwrightの隔離persistent Chromium contextへビルド済み拡張機能を読み込み、popupと `chrome-extension://` ページを操作する。
- [ ] AIエージェントがHTML report、失敗時screenshot、trace、console error、skipを保存して人間へ渡せるようにする。
- [ ] screenshot基準の更新と最終受入を人間の明示操作に限定する。
- 完了条件: WebプレビューだけではE2E成功にならず、AIエージェントのPlaywright成功後に人間が同じcommit／buildを承認または差戻しできる。

### TASK-011: Recovery / quality

- [ ] worker停止、AI Host終了、message再送、DB transaction失敗をテストする。
- [ ] 削除→同名作成拒否→undo、undo期限切れ、削除後revision競合、物理回収後の名前再利用をテストする。
- [ ] runtime ICU差に依存しないNormalizer golden vector、active／tombstone Tagの親状態、親先行restore、子Tag tombstone残存中の親GC拒否をテストする。
- [ ] 1万件規模でinfinite scroll、count、フルページkeyword候補、可変高タグを測る。
- [ ] keyboard、screen reader、200% zoom、sticky offset、dialog、back-to-top を確認する。
- [ ] lint、typecheck、unit、component、E2E、build を CI で実行する。
- [ ] PlaywrightのHTML report、trace、screenshotと、Webプレビューの静的成果物を人間が確認できる形で保存する。
- 完了条件: 障害回復と品質コマンドの結果を WORKLOG に残し、skip／flaky／未実施をpassと区別できる。

### TASK-012: P0 integrated demo

- [ ] 初回ホーム、popup shortcut表示、現在ページ／URL保存、分類、settings、フルページkeyword、AI検索／機能質問、edit/deleteを一連にする。
- [ ] LIST / GRID、infinite scroll、full-screen category list、back-to-topを示す。
- [ ] AI対応／非対応の両経路を用意する。
- [ ] [REQUIREMENTS.md](REQUIREMENTS.md) の P0 を照合する。
- [ ] AIエージェントがPlaywrightで同じcommit／buildを確認し、証拠と未実証事項を引き渡す。
- [ ] 人間が実Chromeで主要導線とAIエージェントのreport／差分を確認し、承認または差戻しを記録する。
- 完了条件: 新規Chrome profileで手順を再現し、[TESTING.md](TESTING.md) の順序でAIエージェント確認と人間受入が完了し、未完了を明示できる。

## P1 確定タスク

機能の採用は確定済みである。P0完了後に着手し、各権限／同期変更は個別Execution Planを先に作る。

| ID | Task | 状態 | 主な依存 | 完了時の成果 |
| --- | --- | --- | --- | --- |
| TASK-101 | 訪問閾値と保存リマインダー | Backlog | TASK-003、004、010 | 数値閾値と有効化設定に従い、確認したURLだけ保存できる |
| TASK-102 | 最終訪問日時による自動archive | Backlog | TASK-003、101 | 数値日数で最小項目へarchiveし、設定一覧から復元できる |
| TASK-103 | QR共有／読取取込 | Backlog | TASK-003、010 | 選択したBookmarkをQRで交換できる |
| TASK-104 | Google Drive同期・権限共有 | Backlog | TASK-003、010、011 | 同一アカウント同期と別アカウント共有を混ぜずに扱える |
| TASK-105 | Chrome標準Bookmarkインポート | Backlog | TASK-003、010 | 元treeを変えずpreview後に専用領域へコピーできる |
| TASK-106 | context menu保存 | Backlog | TASK-004、010 | page／linkを右クリックから共通use caseで保存できる |

### P1タスクの確定受け入れ条件

- **TASK-101**: 設定画面の訪問回数閾値を数値入力にし、`frequentVisitReminderEnabled` で全体を有効／無効にできる。通知側の「次回以降表示しない」は対象canonical URLだけをSUPPRESSEDにし、確認前には保存しない。
- **TASK-102**: アーカイブ化閾値は正整数の日数入力とし、最新UIにない `autoArchiveEnabled` を要求しない。初回開始時にhistory権限の目的を説明し、拒否時は日数を保持して「権限待ち」で停止する。notificationsは要求しない。archive後はカテゴリ・タグ、ページ名、URLだけを保持し、設定のリストから復元する。
- **TASK-103**: カテゴリ別、タグ別、個別Bookmarkを検索とcheckboxで選び、QRを生成する。checksumは破損／切詰め検出だけで真正性を保証しない。異親同名Tagは既存再利用／親変更せず、別名／skip／cancel後に再previewする。
- **TASK-104**: 設定でGoogleアカウントを明示選択する。同一アカウント端末間同期は `appDataFolder` を使い、`appDataFolder` 自体は別アカウントへ共有しない。別アカウント共有は通常Drive file＋permissions/capabilities検証という別経路にする。同一field更新、update-delete、add-delete、名前競合を自動LWWせず `syncConflicts` へ隔離する。local／remote／baseをimmutableな `syncSnapshots` として保持し、版付きの明示resolution planだけを適用する。open中はGCせず、解決後30日保持し、Label ID／edgeを暗黙にremapしない。

## 更新規則

- 着手時に担当、Plan、開始日、状態を追記する。
- 完了時はコマンド、test、手動確認を [WORKLOG.md](WORKLOG.md) へ記録する。
- 要件変更は先に REQUIREMENTS / DESIGN / UI を更新する。
- 暫定策は [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) へ解消条件付きで登録する。
