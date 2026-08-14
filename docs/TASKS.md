# TASKS

- 状態: 実装前バックログ
- 更新日: 2026-08-14
- 対象: BookmationのP0実装と、その後のP1候補

## この文書の役割

この文書は、チームで担当を分けるための**実装ワークパッケージ**を依存順に管理する。現在のリポジトリには実行可能なアプリと`package.json`がないため、すべて未実装である。

| 文書 | 管理するもの |
| --- | --- |
| [TASKS.md](TASKS.md) | 複数の作業から成る実装ワークパッケージ、依存関係、完了条件 |
| [TODO.md](TODO.md) | 原則として一人・短時間・1 PR程度で完了する小規模作業 |
| [PLANS.md](PLANS.md) | 長時間・複雑タスクを実行するための自己完結型Execution Plan規約 |
| [ISSUES.md](ISSUES.md) | 判断待ち、調査が必要な問題、未確定事項 |
| [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) | 意図して採用した暫定策と、その解消条件 |
| [WORKLOG.md](WORKLOG.md) | 実際に行った変更と検証結果 |

Taskが半日を超える、複数領域をまたぐ、DB・権限・外部APIを変更する場合は、着手前に[PLANS.md](PLANS.md)に沿ったExecution Planを作成する。Taskを細かく分解した結果、一人で短時間に完了できる項目だけを[TODO.md](TODO.md)へ移す。

## 状態と優先度

| 状態 | 意味 |
| --- | --- |
| `Backlog` | 未着手。依存関係または担当決定を待つ |
| `Ready` | 前提が揃い、Execution Plan作成または実装へ進める |
| `In Progress` | 担当者とPlanが決まり作業中 |
| `Blocked` | 外部判断または技術検証を待つ。理由と解除条件が必要 |
| `Done` | 完了条件を満たし、検証証拠をWORKLOGへ記録済み |

- `P0`: ハッカソンMVPの成立に必要である。
- `P1`: P0完了後に着手する追加機能または品質向上である。
- 各Taskには担当者、関連Plan、開始日を着手時に追記する。
- 文書作成だけで、実装Taskを`Done`にしない。

## P0クリティカルパス

| ID | Task | 状態 | 主な依存 | 完了時に利用者ができること |
| --- | --- | --- | --- | --- |
| TASK-001 | 初期実装Planと開発基盤を確定する | Ready | TODO-003、ISSUE-006、ISSUE-007 | チームが同じ環境とコマンドで実装を開始できる |
| TASK-002 | Plasmo拡張機能をbootstrapする | Backlog | TASK-001 | Chromeへ開発版を読み込み、popupとBookmationページを開ける |
| TASK-003 | ローカルデータ層を実装する | Backlog | TASK-002 | Bookmark、Tag、関連、分類Jobを再読込後も保持できる |
| TASK-004 | 現在ページ・URL保存を実装する | Backlog | TASK-003 | popup、ショートカット、URL入力から安全に保存できる |
| TASK-005 | 最近追加ホームと3表示を実装する | Backlog | TASK-002、TASK-003 | 最近追加一覧をリスト・グリッド・弁当で閲覧できる |
| TASK-006 | タグ管理と右サイドメニューを実装する | Backlog | TASK-003、TASK-005 | MAIN / SUBを作成・付与し、タグ別一覧へ移動できる |
| TASK-007 | Prompt APIのAI Hostを実証する | Backlog | TASK-002、ISSUE-001 | 対応環境を判定し、非対応時も手動操作へ戻れる |
| TASK-008 | AI分類と細分化制御を実装する | Backlog | TASK-003、TASK-006、TASK-007 | 保存済み項目へ規則どおり複数タグ候補を適用・修正できる |
| TASK-009 | 自然言語検索を実装する | Backlog | TASK-003、TASK-006、TASK-007 | タグ検索とBookmark検索で複数候補を選べる |
| TASK-010 | メディア・権限・セキュリティ境界を固める | Backlog | TASK-002、TASK-003、ISSUE-002 | 最小権限で安全な代替画像と入力検証を利用できる |
| TASK-011 | 復旧・品質検証を実装する | Backlog | TASK-004〜TASK-010 | 中断・再送・容量不足でもデータを守り、品質コマンドを実行できる |
| TASK-012 | P0統合デモを完成させる | Backlog | TASK-004〜TASK-011 | 保存、分類、検索、一覧切替を一連のデモとして完了できる |

## P0 Task詳細

### TASK-001: 初期実装Planと開発基盤を確定する

- [ ] `docs/plans/`へ最初のExecution Planを作成する。
- [ ] Node.js、package manager、Plasmo、React、Tailwind CSS、TypeScriptの対応バージョンを固定する。
- [ ] lockfile方針と`dev`、`build`、`lint`、`typecheck`、`test`のscript名を決める。
- [ ] ハッカソンの締切、デモ端末、P0成功条件をPlanへ記録する。
- 完了条件: 新しいcheckoutから同じ手順で依存関係を導入でき、以後のTaskが参照するPlanとコマンドが存在する。

### TASK-002: Plasmo拡張機能をbootstrapする

- [ ] Plasmo + React + Tailwind CSS + TypeScriptの最小構成を作る。
- [ ] Manifest V3のpopup、拡張機能タブページ、Background Service Workerを分離する。
- [ ] `save-current-page`と`open-bookmation-home`の2 commandsを宣言する。
- [ ] Tailwindのproduction build、CSP、ローカルアセットだけを使う構成を確認する。
- 完了条件: 開発ビルドをChromeへ読み込み、popupの2ボタンと空のBookmationホームを開ける。

### TASK-003: ローカルデータ層を実装する

- [ ] [DB-SCHEMA.md](DB-SCHEMA.md)に沿ってIndexedDB Store、索引、Repository、migrationを実装する。
- [ ] 設定だけを`chrome.storage.local`へ保存する。
- [ ] 同名Tagを別IDで保持し、同じ`bookmarkId + tagId` edgeだけを一意にする。
- [ ] Bookmark保存とPENDING ClassificationJob作成を同一トランザクションで行う。
- [ ] faviconとthumbnailのBlob参照・回収境界を用意する。
- 完了条件: 再読込後もデータが残り、同名Tag、複数MAIN / SUB、edge再送、migration中断の自動テストが通る。

### TASK-004: 現在ページ・URL保存を実装する

- [ ] popupから「現在ページを保存」と「ホームを開く」を選べるようにする。popupを開いただけでは保存しない。
- [ ] 2つのcommandsを別handlerへ接続し、ショートカット競合時の案内を出す。
- [ ] `http:` / `https:` URLの手動入力、構文検証、確認、保存を実装する。
- [ ] メタデータ取得失敗時も、検証済みURLと代替タイトルを保存する。
- [ ] 正規化URL、requestId、再送を使い、無言の二重保存を防ぐ。
- 完了条件: 3つの保存入口で同じ保存ユースケースを使い、AI非対応やService Worker再起動でも保存済みBookmarkを失わない。

### TASK-005: 最近追加ホームと3表示を実装する

- [ ] `savedAt`降順の最近追加ホームと、カーソル方式の追加読込を実装する。
- [ ] リスト・グリッド・弁当のセグメントコントロールを実装する。
- [ ] グリッドと弁当だけに列数selectを表示し、狭い画面では安全に縮退する。
- [ ] Bookmarkカードは閉じた状態で`タグ N件`、展開時に全MAIN / SUBを表示する。
- [ ] 空、読込中、追加読込失敗、サムネイル失敗を区別する。
- 完了条件: 同じ一覧条件を保ったまま3表示を切り替え、キーボードでタグを展開できる。

### TASK-006: タグ管理と右サイドメニューを実装する

- [ ] MAIN / SUBの作成、改名、削除、Bookmarkへの複数付与・解除を実装する。
- [ ] MAINの新規作成・改名・削除を利用者操作だけに制限する。
- [ ] 同名・類似候補を先に表示し、再利用と`同名の別タグとして作成`を分ける。
- [ ] 右追従メニューをMAIN / SUBの2セクションに分け、件数と作成元を表示する。
- [ ] タグ選択から`#/bookmarks?tag=<tagId>`へ移動し、同名TagをIDで区別する。
- 完了条件: 同名Tagを誤統合せず、複数のMAIN / SUBを付けたBookmarkをタグIDで正しく絞り込める。

### TASK-007: Prompt APIのAI Hostを実証する

- [ ] [ISSUES.md](ISSUES.md)のISSUE-001を、Chrome公式仕様と実機スパイクで解決する。
- [ ] Dashboardまたは対応するトップレベル拡張ページでPrompt APIを実行する。
- [ ] `unavailable`、`downloadable`、`downloading`、`available`をUI状態へ変換する。
- [ ] モデル取得に必要な利用者操作、日本語入出力、構造化出力を検証する。
- [ ] Service Workerまたは未確認のOffscreen DocumentからLanguageModelを呼ばない。
- 完了条件: 対応条件、AI Host、最低Chrome版、非対応時のfallbackが文書と検証コードで一致する。

### TASK-008: AI分類と細分化制御を実装する

- [ ] 既存USER MAIN ID、USER SUB、AI SUBの順で候補を構築する。
- [ ] AIがMAINを新規作成できない固定スキーマとDomain検証を実装する。
- [ ] 5段階スライダーを新規SUB作成数`0 / 1 / 2 / 4 / 6`へ対応付ける。
- [ ] USER SUBを優先し、適切な既存候補がない場合だけ新しいSUBを作成する。
- [ ] Job lease、revision、`creationRequestId`で中断・再送を冪等にする。
- [ ] AI提案の確認、修正、取消、`NEEDS_REVIEW`を実装する。
- 完了条件: fixtureでMAIN生成拒否、USER SUB優先、上限、AI Host中断、同名Tag、手動修正を再現できる。

### TASK-009: 自然言語検索を実装する

- [ ] Tag検索とBookmark検索を別の検索対象・候補型として実装する。
- [ ] 正データから再構築できる字句検索用`SearchDocument`を作る。
- [ ] Prompt APIへ提示済み候補だけを再順位付けさせ、候補外ID、重複ID、古いrevisionを拒否する。
- [ ] 複数候補、短い一致理由、0件、1件だけの一致を正直に表示する。
- [ ] AI非対応時は文字列検索へ縮退し、自然言語検索と誤認させない。
- [ ] 検索文、展開語、自由文理由を既定で永続化しない。
- 完了条件: Tag / Bookmarkのfixtureで候補種別、順位、複数候補、IME、古い応答、fallbackを検証できる。

### TASK-010: メディア・権限・セキュリティ境界を固める

- [ ] `storage`、`activeTab`、commandsを基準にManifest最小権限をレビューする。
- [ ] サムネイルとfaviconの取得元、許可MIME、寸法、容量、失敗時表示を決める。
- [ ] URL、title、Tag名、AI出力、message payloadを未信頼入力として検証する。
- [ ] 外部画像の表示時追跡、remote code、`dangerouslySetInnerHTML`、未検証schemeを防ぐ。
- [ ] ログへURL、検索文、タグ名等を常時出力しない。
- 完了条件: [SECURITY.md](SECURITY.md)のP0受け入れ条件と権限レビューを満たす自動・手動テストが存在する。

### TASK-011: 復旧・品質検証を実装する

- [ ] Service Worker停止、AI Host終了、message再送、IndexedDB transaction失敗をテストする。
- [ ] version付きエクスポート、入力検証付きインポート、dry-run、部分失敗レポートを設計・実装する。
- [ ] lint、typecheck、unit、component、E2E、buildをCIで実行する。
- [ ] 1万件規模の一覧、タグ多数、画像多数、可変高カードの性能を測る。
- [ ] キーボード、スクリーンリーダー、200%拡大、弁当表示のDOM順を確認する。
- 完了条件: データを削除せず主要障害から回復でき、品質コマンドと手動確認結果がWORKLOGに残る。

### TASK-012: P0統合デモを完成させる

- [ ] 新規Chrome profileへの導入手順を確定する。
- [ ] popup保存、URL保存、タグ編集、AI分類、自然言語検索、3表示を一連のシナリオにする。
- [ ] AI対応端末とAI非対応端末の両方でデモ経路を用意する。
- [ ] 権限説明、保存データ、既知の制約、P1対象外を短く説明できるようにする。
- [ ] P0受け入れ条件を[REQUIREMENTS.md](REQUIREMENTS.md)と照合する。
- 完了条件: 新しい環境でデモ手順を再現し、P0要件の結果と未完了項目を明示できる。

## P1候補

P1はP0完了後に個別のExecution Planを作成し、強い権限、共有、同期をP0へ混ぜない。

| ID | Task | 状態 | 開始条件 |
| --- | --- | --- | --- |
| TASK-101 | 訪問回数から未保存ページを提案する | Backlog | `history`任意権限と説明文を承認済み |
| TASK-102 | 休眠Bookmarkのアーカイブ候補を提案する | Backlog | 訪問定義、期間、復元UIを決定済み |
| TASK-103 | 選択BookmarkをQR共有する | Backlog | payload、容量、改ざん検知、取込確認を決定済み |
| TASK-104 | Google Driveで端末間同期する | Backlog | OAuth scope、形式、暗号化、競合、バックアップを決定済み |

## 直近の着手順

1. TODO-003を実行し、TASK-001用のExecution Planを作る。
2. ISSUE-006とISSUE-007の前提を確認し、開発環境とデモ条件をPlanへ固定する。
3. TASK-002でPlasmoの最小拡張機能を起動する。
4. TASK-003、TASK-005のUI shell、TASK-007の技術スパイクを、責務が重ならない範囲で進める。
5. TASK-004とTASK-006を統合し、保存からタグ別一覧までの最初の縦切りを完成させる。

## 更新規則

- 着手時に状態、担当、関連Plan、開始日を追記する。
- 完了時はチェックだけでなく、実行コマンド、テスト結果、手動確認を[WORKLOG.md](WORKLOG.md)へ記録する。
- 要件変更でTaskの目的が変わる場合は、先に[REQUIREMENTS.md](REQUIREMENTS.md)と[DESIGN.md](DESIGN.md)を更新する。
- 未決定事項が原因で進められない場合は、Taskへ推測を書き足さず[ISSUES.md](ISSUES.md)へ問題と解除条件を記録する。
- 暫定実装を採用した場合は[TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md)へ解消条件を登録する。
- Taskを削除せず、完了・置換・対象外の理由を履歴として残す。
