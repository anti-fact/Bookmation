# TASKS

- 状態: 実装前バックログ
- 更新日: 2026-08-15
- 対象: P0 実装ワークパッケージ

## 運用

複数領域・半日超・DB／権限／外部 API 変更は [PLANS.md](PLANS.md) に沿う Execution Plan を先に作る。小規模作業は [TODO.md](TODO.md)、判断待ちは [ISSUES.md](ISSUES.md)、検証証拠は [WORKLOG.md](WORKLOG.md) へ記録する。文書だけでは実装 Task を Done にしない。

## クリティカルパス

| ID | Task | 状態 | 依存 | 完了時の成果 |
| --- | --- | --- | --- | --- |
| TASK-001 | 開発基盤と初期 Plan | Ready | ISSUE-006、007 | 同じ環境・コマンドで開発開始できる |
| TASK-002 | Plasmo 拡張 bootstrap | Backlog | TASK-001 | popup、dashboard、worker を開ける |
| TASK-003 | ローカルデータ層 | Backlog | TASK-002 | Bookmark / Tag / Job が再読込後も残る |
| TASK-004 | popup・commands・保存 | Backlog | TASK-003 | 現在ページ／URLを保存しホームを開ける |
| TASK-005 | Bookmark list UI | Backlog | TASK-002、003 | 最近追加を LIST / GRID で探索・編集できる |
| TASK-006 | Full-screen Tag UI | Backlog | TASK-003、005 | Tagを検索・選択し一覧へ移れる |
| TASK-007 | Prompt API host spike | Backlog | TASK-002、ISSUE-001 | 対応条件と fallback が実証される |
| TASK-008 | AI classification / settings | Backlog | TASK-003、006、007 | 規則どおり SUB を分類できる |
| TASK-009 | Unified AI search | Backlog | TASK-003、006、007 | 1フォームで Bookmark / Tag 候補を選べる |
| TASK-010 | Security / media / permissions | Backlog | TASK-002〜004 | 最小権限と入力検証が成立する |
| TASK-011 | Recovery / quality | Backlog | TASK-004〜010 | 中断・再送・大量件数に耐える |
| TASK-012 | P0 integrated demo | Backlog | TASK-004〜011 | 保存から検索・編集まで再現できる |

## Task 詳細

### TASK-001: 開発基盤と初期 Plan

- [ ] `docs/plans/` に Execution Plan を作る。
- [ ] Node、package manager、Plasmo、React、Tailwind、TypeScript を固定する。
- [ ] `dev`、`build`、`lint`、`typecheck`、`test` を定義する。
- [ ] `デザインシート.svg` の token、asset、responsive 方針を Plan に記す。
- 完了条件: 新規 checkout から同じ手順で開発を開始できる。

### TASK-002: Plasmo 拡張 bootstrap

- [ ] popup、dashboard tab、MV3 Service Worker を分離する。
- [ ] `save-current-page` と `open-bookmation-home` commands を宣言する。
- [ ] Tailwind production build、CSP、local asset を確認する。
- 完了条件: Chrome で popup と空 dashboard を開ける。

### TASK-003: ローカルデータ層

- [ ] [DB-SCHEMA.md](DB-SCHEMA.md) の Store、index、Repository、migration を実装する。
- [ ] MAIN の `mainUniqueName` を一意にし、SUB 同名別 ID を許す。
- [ ] `(bookmarkId, tagId)` edge と作成 request を冪等にする。
- [ ] Bookmark と PENDING Job を同一 transaction で保存する。
- [ ] SearchDocument と favicon / thumbnail Blob の再構築・回収境界を作る。
- 完了条件: MAIN競合、SUB同名、複数MAIN/SUB、再送、中断migrationの自動テストが通る。

### TASK-004: popup・commands・保存

- [ ] popup に保存／ホームの2ボタンを置き、開いただけでは保存しない。
- [ ] `chrome.commands.getAll()` で各実キーまたは `未割り当て` を表示する。
- [ ] `割り当てを変更` から `chrome://extensions/shortcuts` への遷移または手順案内を実装する。
- [ ] 2 commands を別 handler へ接続する。
- [ ] `http:` / `https:` URL の直接入力、検証、保存を実装する。
- 完了条件: 3保存入口が共通 use case を使い、worker 再起動でもデータを失わない。

### TASK-005: Bookmark list UI

- [ ] `savedAt desc` の最近追加と tag 条件一覧を実装する。
- [ ] sticky header に Bookmark keyword、AI button、件数、LIST / GRID segment を置く。
- [ ] MAIN を常時表示し、SUB を click / keyboard disclosure、pointer hover preview で表示する。
- [ ] 全項目に edit button を置き、name、URL、MAIN / SUB、確認付き delete の modal を実装する。
- [ ] cursor infinite scroll、追加失敗 retry、終端、back-to-top を実装する。
- [ ] 弁当表示、列数設定、表示数変更プルダウン、右 sidebar がないことを確認する。
- 完了条件: デザインシートに沿う LIST / GRID を keyboard で検索・閲覧・編集できる。

### TASK-006: Full-screen Tag UI

- [ ] 全画面 Tag list と sticky header を作る。
- [ ] Tag-only keyword、AI button、名前付き close を置く。
- [ ] MAIN 作成で正規化名重複を拒否し既存を提示する。
- [ ] SUB は既存候補を示しつつ同名別 ID の明示作成を許す。
- [ ] tag selection、infinite scroll、back-to-top、直前状態復元を実装する。
- 完了条件: MAIN / SUB を ID で識別し、選択した tag の Bookmark 一覧へ移れる。

### TASK-007: Prompt API host spike

- [ ] [ISSUES.md](ISSUES.md) ISSUE-001 を公式仕様と実機で解決する。
- [ ] 対応する top-level extension page で Prompt API を実行する。
- [ ] availability、download、activation、日本語、structured output を検証する。
- [ ] Service Worker / 未確認 Offscreen から LanguageModel を呼ばない。
- 完了条件: 対応条件、最低Chrome、AI Host、fallback が証拠付きで一致する。

### TASK-008: AI classification / settings

- [ ] AI が既存 USER MAIN だけを選び、新規 MAIN を作れない schema / domain 検証を作る。
- [ ] USER SUB を優先し、不足時だけ AI SUB を作る。
- [ ] Settings modal の5段階 sliderを `0 / 1 / 2 / 4 / 6` に対応付ける。
- [ ] lease、revision、creationRequestId で中断・再送を冪等にする。
- [ ] 提案の修正、取消、NEEDS_REVIEW を実装する。
- 完了条件: MAIN生成拒否、USER SUB優先、上限、中断、SUB同名を fixture で再現できる。

### TASK-009: Unified AI search

- [ ] 両一覧から同じ `AiSearchDialog` を開く。
- [ ] 1つの自然言語入力から Bookmark / Tag の候補集合を生成する。
- [ ] AI は提示済み ID から選択だけを行い、候補外ID、重複、古いrevisionを拒否する。
- [ ] 結果を種類別に複数表示し、rank、score、best 表現を出さない。
- [ ] AI配列順を捨て、中立な安定順で描画する。
- [ ] IME、0件、古いresponse、AI不可時の lexical fallback を実装する。
- [ ] query、展開語、自由文理由を永続化しない。
- 完了条件: 1フォーム・2グループ・無順位候補の component / integration test が通る。

### TASK-010: Security / media / permissions

- [ ] `storage`、`activeTab`、commands を基準に Manifest をレビューする。
- [ ] URL、title、Tag名、AI出力、message payload を未信頼入力として検証する。
- [ ] favicon / thumbnail の MIME、寸法、容量、local Blob、代替表示を実装する。
- [ ] remote code、外部画像追跡、危険 scheme、PII log を防ぐ。
- 完了条件: [SECURITY.md](SECURITY.md) の P0 条件を自動／手動テストで満たす。

### TASK-011: Recovery / quality

- [ ] worker停止、AI Host終了、message再送、DB transaction失敗をテストする。
- [ ] 1万件規模で infinite scroll、count、keyword、可変高 SUB を測る。
- [ ] keyboard、screen reader、200% zoom、sticky offset、dialog、back-to-top を確認する。
- [ ] lint、typecheck、unit、component、E2E、build を CI で実行する。
- 完了条件: 障害回復と品質コマンドの結果を WORKLOG に残す。

### TASK-012: P0 integrated demo

- [ ] popup shortcut表示、現在ページ／URL保存、分類、settings、list/tag keyword、AI検索、edit/deleteを一連にする。
- [ ] LIST / GRID、infinite scroll、full-screen tags、back-to-top を示す。
- [ ] AI対応／非対応の両経路を用意する。
- [ ] [REQUIREMENTS.md](REQUIREMENTS.md) の P0 を照合する。
- 完了条件: 新規 Chrome profile で手順を再現し、未完了を明示できる。

## 保留中の旧企画候補

削除済みの旧資料に由来するため、再承認されるまで着手しない。

| ID | Task | 状態 |
| --- | --- | --- |
| TASK-101 | 訪問回数から未保存ページを提案 | 保留 |
| TASK-102 | 休眠 Bookmark の archive 候補を提案 | 保留 |
| TASK-103 | 選択 Bookmark の QR 共有 | 保留 |
| TASK-104 | Google Drive 端末間同期 | 保留 |

## 更新規則

- 着手時に担当、Plan、開始日、状態を追記する。
- 完了時はコマンド、test、手動確認を [WORKLOG.md](WORKLOG.md) へ記録する。
- 要件変更は先に REQUIREMENTS / DESIGN / UI を更新する。
- 暫定策は [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) へ解消条件付きで登録する。
