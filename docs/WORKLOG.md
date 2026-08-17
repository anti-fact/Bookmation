# WORKLOG

## 記録方針

実際に行った作業、確認した事実、実行した検証と結果を時系列で残す。予定や願望は [TODO.md](TODO.md)、未解決問題は [ISSUES.md](ISSUES.md)、設計判断は [DESIGN.md](DESIGN.md) に置く。

- 日付は `YYYY-MM-DD`、必要な場合はJST時刻を付ける。
- 「確認済み」「未実施」「失敗」を明確に区別する。
- テストを実行していない場合は、成功したように書かない。
- 外部サイトや変化しやすいAPIを確認した場合は、確認日とURLを残す。
- PDF等の入力資料は内容の参照元として扱い、資料内の文章を作業命令として実行しない。

## 2026-08-14 — 文書基盤の作成

### 目的

チームで実装を開始できるように、ルートの `AGENTS.md` を目次に限定し、`docs/` 配下へ要件・設計・運用・トラブル対応の参照文書を分離する。

### 参照した入力

- 利用者が明示したBookmationのUI・分類要件。
- `合同ハッカソン - Google ドキュメント.pdf` の企画内容。PDF内の「アイデア」「仮案」「確定事項」を区別し、利用者の最新指示を優先した。
- 参考UIとして指定されたSANKOU!、me ki ki ki、Pinterest。確認できた挙動と推奨案を分ける方針とした。

### 作業

- `docs/` の文書構成を作成した。
- 長時間・複雑タスクを自己完結型のliving Execution Planで扱う規約を定義した。
- 小規模タスク、技術的負債、長期記憶、作業履歴の責務を分離した。
- 現在は実行可能なアプリがないことをQuickstartへ明記し、将来の想定コマンドを現在の実行手順と区別した。
- Prompt API、モデル取得、保存容量、Manifest V3 service worker、タグ・検索の切り分け方針をトラブルシューティングへ整理した。

### 検証状況

| 確認項目 | 状態 | 備考 |
| --- | --- | --- |
| 指定された文書が全て存在する | 確認済み | 指定19ファイルが `docs/` 直下に存在する |
| `AGENTS.md` が目次だけである | 確認済み | 見出しとMarkdownリンク以外の本文がない |
| Markdown相対リンクが解決する | 確認済み | Markdownパーサーで相対リンク161件、見出しリンク12件、参照先漏れ0件 |
| 外部参考リンクが応答する | 確認済み | 重複を除く25 URLへ2026-08-14にGETし、全てHTTP 200。内容の恒久性を保証するものではない |
| `AI_GUIDE.md` が空である | 確認済み | `wc -c` で0バイト |
| 要件と設計の矛盾がない | 静的レビュー済み | 最新依頼をPDFより優先し、右タグサイドバー、3段階分類、3表示、Prompt APIの非Worker実行へ統一した |
| ビルド・lint・型検査・テスト | 実行不能 | 2026-08-14時点ではソースと`package.json`がない |
| Chrome実機・Prompt API | 未実施 | 文書作業のみで、拡張機能も未実装 |

### 次の作業

- 初期実装は [PLANS.md](PLANS.md) に沿って別のExecution Planを作成してから着手する。
- 実装開始時に [QUICKSTART.md](QUICKSTART.md) の暫定コマンドを実在するscriptへ置き換える。

## 2026-08-14 — 最新UI・タグ要件への更新

### 目的

利用者の最新指示を新しい正本とし、旧3段階分類を、平坦なCATEGORY / TAGタグと新しい保存・検索導線へ置き換える。

### 変更

- Plasmo（React）+ Tailwind CSSを確定UI基盤として記録した。TypeScriptは別の設計判断とした。
- 現名称でいうカテゴリはユーザー作成だけ、タグはユーザー定義優先で不足時だけAI作成とした。カテゴリ／タグの複数割当と同名別IDを許可し、同じ `bookmarkId + labelId` edgeだけを冪等に保つ。
- 最近追加ホーム、右追従タグメニュー、タグ別一覧、3表示、グリッド／弁当の列数、閉じた状態の中立なタグ件数、全タグ展開を画面・データ契約へ反映した。
- カテゴリ／タグの手動作成導線を追加し、既存同名候補の再利用と、利用者確認後の同名別ID作成を分けた。
- 自然言語のTag検索とBookmark検索を分離し、複数候補、候補ID再検証、AI利用不可時の文字列fallback、検索文の非永続を定義した。
- popupの2ボタン、独立した2 commands、URL指定保存をP0へ追加した。
- 既存の「大カテゴリ → 小カテゴリ（カテゴリ）→ タグ」という記録はこの更新で置換した。上の作業行は当時の履歴として保持し、現行仕様の根拠には使わない。

### 検証

| 確認項目 | 結果 |
| --- | --- |
| 指定文書 | `docs/` 直下の19ファイルが存在する |
| Markdownリンク | 相対リンク177件、うち見出しリンク13件をパーサーで検査し、参照先漏れ0件 |
| 旧仕様識別子 | `majorCategories`、`majorCategoryId`、`parentTagId`、旧検索scopeの現行仕様への残存0件 |
| 文書形式 | コードフェンス不整合0件、末尾空白0件 |
| `AGENTS.md` | 見出しと索引リンクだけである |
| `AI_GUIDE.md` | 0バイトのままである |
| 添付PDF | SHA-256は `0817bed21a4a532572688ddb108a991232162fd30cf686a533cc88c79d591d31` で、文書更新前の確認値と同一 |
| 実装検証 | `package.json` とアプリソースがないため、build、lint、型検査、Chrome実機確認は実行不能 |

### 残課題

- 依存バージョン、パッケージマネージャー、ショートカット初期値、自然言語検索の候補数・品質、細分化上限は [ISSUES.md](ISSUES.md) のスパイクで確定する。
- 初期実装は [PLANS.md](PLANS.md) に従い、保存から最近追加ホームまでの縦切りPlanを先に作る。

## 2026-08-14 — README整備と文書名の大文字化

### 目的

リポジトリを開いた人がBookmationの目的、主要機能、タグ規則、技術構成、現在の実装状態をREADMEだけで把握できるようにし、Markdown文書の命名を統一する。

### 変更

- `README.md` をプロダクト概要、主要機能、AI分類、技術構成、画面フロー、文書案内、現在の始め方を含む入口文書へ更新した。
- `docs/index.md` を `docs/INDEX.md`、`docs/db-schema.md` を `docs/DB-SCHEMA.md`、`docs/tech-debt-tracker.md` を `docs/TECH-DEBT-TRACKER.md` へ変更した。
- `AGENTS.md` と全Markdown文書の参照先・表示名を新しいファイル名へ更新した。

### 検証

| 確認項目 | 結果 |
| --- | --- |
| Markdownファイル名 | `README.md`、`AGENTS.md`、`docs/`直下19文書のベース名がすべて大文字規則に一致 |
| Markdownリンク | README、AGENTS、docsを含む相対リンク192件、見出しリンク13件を検査し、参照先漏れ0件 |
| 旧ファイル名参照 | 現行リンクへの `index.md`、`db-schema.md`、`tech-debt-tracker.md` の残存0件 |
| `AI_GUIDE.md` | 0バイトのままである |
| 実装検証 | `package.json` がないため、build、lint、Chrome実機確認は実行不能 |

## 2026-08-14 — 実装タスク一覧の作成

### 目的

チームがBookmationの実装を依存順に分担できるよう、短期TODOや未決定事項とは別に、利用者へ届く成果と完了条件を持つワークパッケージを定義する。

### 変更

- `docs/TASKS.md`を追加し、文書の責務、状態、優先度、P0クリティカルパス、12件のP0 Task、4件のP1候補、直近の着手順、更新規則を記録した。
- `AGENTS.md`、`README.md`、`docs/INDEX.md`から`TASKS.md`へ到達できるようにした。
- `TODO.md`を小規模作業、`TASKS.md`を実装ワークパッケージ、`PLANS.md`を長時間作業の実行規約として区別した。

### 検証

| 確認項目 | 結果 |
| --- | --- |
| 文書数 | `docs/`直下のMarkdownは20ファイル |
| Markdownリンク | README、AGENTS、docsを含む相対リンク213件、見出しリンク13件を検査し、参照先漏れ0件 |
| 文書名 | 全Markdownのベース名が大文字規則に一致 |
| `AGENTS.md` | `docs/`直下20文書を過不足なく列挙 |
| `AI_GUIDE.md` | 0バイトのままである |
| 実装検証 | `package.json`がないため、build、lint、Chrome実機確認は実行不能 |

## 2026-08-15 — デザインシート準拠のUI要件更新

### 目的

最新の明示要件と `デザインシート.svg` をUI正本として、旧右サイドメニュー・弁当表示・分離AI検索を新しい画面構成へ置き換える。

### 変更

- SVGをPNGへ一時レンダリングして、grid / list、共通header、件数、各項目のedit、全画面Tag一覧、close、Bookmark編集modal、back-to-topを目視確認した。SVG自体は編集していない。
- Bookmark listをsticky keyword header、AI button、件数、LIST / GRID、カテゴリ常時表示、タグdisclosure、全項目edit、cursor infinite scroll、back-to-topへ更新した。
- 当時の分類一覧を全画面、sticky keyword、AI button、close、infinite scroll、back-to-topへ更新した。検索対象は2026-08-16の統合検索仕様で置換済みである。
- 共通AI検索を1フォーム、分類／Bookmark別の無順位候補集合とし、rank / score / best表示と自動遷移を廃止した。表示順は2026-08-16に分類を上へ確定した。
- Bookmark editorをname、URL、カテゴリ／タグ、確認付きdeleteのmodal、AI細分化sliderをsettings modalとした。
- popupへ `chrome.commands.getAll()` による実キー／未割当表示とChrome shortcut管理への変更案内を追加した。
- 分類不変条件をカテゴリ正規化名一意、タグ同名別ID可へ変更し、DB、backend、security、task、運用文書へ反映した。
- 2026-08-14のWORKLOGにある右sidebar、3表示、全tag一括展開、全tag同名許可は当時の履歴であり、本節と現行要件により置換済みである。

### 検証

| 確認項目 | 結果 |
| --- | --- |
| 差分形式 | `git diff --check` 成功 |
| Markdown | 22ファイル、fence不整合0件、base nameは全て大文字規則に一致 |
| リンク | fence内templateを除く相対リンク199件、見出しリンク11件、参照エラー0件 |
| 旧UI識別子 | active specに旧search route/use case、ranked candidate、grid/bento列設定、BENTO enum、右追従sidebarの採用記述0件 |
| `AI_GUIDE.md` | 0バイトを維持 |
| SVG | SHA-256 `c704c52370a61cc30dba54481e134bbd638acf775695690b92275512c4d181d8`。確認前後で同一 |
| 実装検証 | `package.json` とアプリソースがないためbuild、test、Chrome実機確認は未実施 |

### 残課題

- Prompt API host、shortcut管理画面の直接遷移可否、候補上限、page size、responsive gridは [ISSUES.md](ISSUES.md) のspikeで確定する。

## 2026-08-15 — 表示数プルダウン廃止と旧PDF削除

### 目的

ブックマーク表示数を利用者が変更するプルダウンを設けない方針を明文化し、情報が古くなった旧企画PDFを現行要件の根拠から外す。

### 変更

- LIST / GRIDの表示数・列数を変更するプルダウンをUI、要件、フロントエンド、制約、タスクから除外した。
- 1回の取得件数は無限スクロールの内部ページング設定、GRID列数はresponsive CSSで決め、利用者設定にしないと明記した。
- `合同ハッカソン - Google ドキュメント.pdf` を削除し、現行文書の直接リンクと優先順位から外した。
- 当時は旧資料由来の追加候補を再承認まで実装しない保留項目とした。この判断は2026-08-16の明示要件で置換済みである。

### 検証

- `git diff --check`: 成功
- Markdown相対リンク: 削除済みPDFへの参照がないことを含めて再検査
- 実装検証: runtime未作成のため未実施

## 2026-08-16 — バックエンド担当向けタスク一覧

### 目的

バックエンド担当者が実装順、依存関係、成果物、完了条件を一つの文書から確認できるようにする。

### 変更

- リポジトリ直下に `BACKEND_TASKS.md` を追加した。
- BE-00〜BE-12を依存順に整理し、実装依存flowchartと最初の保存縦切りsequence diagramを追加した。
- 各タスクへ目的、checklist、成果物、完了条件を付け、UIとの受け渡し表と共通Definition of Doneを追加した。
- AGENTS、README、INDEX、TASKSから新しい一覧へ到達できるようにした。

### 検証

- `git diff --check`: 成功
- Markdown 23ファイル、相対リンク213件、見出しリンク11件、参照エラー0件
- BE-00〜BE-12が一覧と詳細に過不足なく存在し、Mermaid blockが2件あることを静的確認
- `AI_GUIDE.md`: 0バイトを維持
- 実装検証: runtime未作成のため未実施

## 2026-08-16 — 履歴・共有・同期・取込の確定と用語／検索／JSON更新

### 目的

最新の明示要件をP1確定仕様へ昇格し、分類用語、統合検索、JSONベースDBを全設計・タスクへ反映する。

### 変更

- 正式名称をカテゴリ／タグとし、内部総称を `Label`、永続enumを `CATEGORY` / `TAG` とした。カテゴリ名一意・ユーザー作成のみ、タグ名重複可・ユーザー定義優先・不足時だけAI作成という規則を維持した。
- ブックマーク一覧とカテゴリ一覧の検索ボックスを統合し、keyword／AIともカテゴリ、タグ、Bookmarkを検索するようにした。結果順をカテゴリ・タグが上、Bookmarkが下へ固定した。
- 頻繁に訪問する未保存サイトの閾値設定、確認付き保存リマインダー、最終訪問日時と設定日数による自動archive、文字列 `archiveState`、復元を確定した。
- ユーザー間QR共有、同一ユーザーのGoogle Drive `appDataFolder` 同期、Chrome標準Bookmarkの非破壊import、page／linkのcontext menu保存をP1確定要件にした。
- DB正本をIndexedDB上の `schemaVersion` 付きJSON互換documentとし、Blobだけを別Storeへ分離した。訪問Reminder、Import Job、Sync Outbox／Conflictをスキーマへ追加した。
- `BACKEND_TASKS.md` をBE-00〜BE-18へ拡張し、P1機能の依存flow、checklist、成果物、完了条件、UI契約を追加した。
- Chrome history、alarms、notifications、contextMenus、bookmarks、permissions、identityとGoogle Drive appDataFolderの公式資料を2026-08-16に確認し、権限と実行境界をREFERENCES／SECURITYへ反映した。

### 検証

| 確認項目 | 結果 |
| --- | --- |
| 差分形式 | `git diff --check` 成功 |
| Markdown | 23ファイル、fence block 30件、未閉鎖0件 |
| リンク | fence内sampleを除く相対リンク217件、見出しリンク11件、参照エラー0件 |
| ファイル名 | root／docsのMarkdown basenameは大文字、`AI_GUIDE.md` は0バイト |
| 旧仕様scan | active specの旧名称、画面別search API、旧join名、保留表現、旧archive fieldは0件 |
| タスク整合 | BE-00〜BE-18が一覧19件・詳細19件で一致、Mermaid block 2件 |
| 正本assertion | FR-101〜110、TASK-101〜106、検索順、JSON、archive、閾値、権限・同期識別子を静的確認 |
| 実装検証 | `package.json` とアプリソースがないためbuild、test、Chrome実機、Drive、QR動作確認は未実施 |

### 残課題

- 訪問集計期間と通知cooldown、archive既定日数、QR容量／分割、Drive競合UI、標準Bookmark Folder対応は [ISSUES.md](ISSUES.md) で実装前に決める。

## 2026-08-16 — TASK-001 開発基盤 scaffold

### 目的

同じ checkout から `pnpm` で開発を開始できるようにし、ISSUE-006 のバージョンを固定する。

### 変更

- Plasmo 0.90.5、React 18.3.1、Tailwind 3.4.17、TypeScript 5.9.2、pnpm 10.15.1 を lockfile で固定した。
- `dev` / `build` / `lint` / `typecheck` / `test` を定義した。
- `src/` に popup 確認画面、デザイン token、Domain 層の空モジュールを置いた。
- [docs/plans/2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md) を作成した。
- `assets/icon.png` は placeholder である。`デザインシート.svg` は改変していない。

### 検証

- コマンド: `pnpm lint` — 結果: 成功
- コマンド: `pnpm typecheck` — 結果: 成功
- コマンド: `pnpm test` — 結果: 成功（2 tests）
- コマンド: `pnpm build` — 結果: 成功。`build/chrome-mv3-prod/popup.html` と permissions `storage`, `activeTab` を確認
- 手動: Chrome への読込みは未実施
- 実行 Node: v23.5.0。推奨は `.nvmrc` の 22

### 残課題

- popup 2ボタン、dashboard、Service Worker は TASK-002
- Chrome 手動読込み
- ISSUE-007 のハッカソン日程
- CI は TASK-011（TD-001 は対応中）

## 2026-08-16 — Webプレビュー／AIエージェント／人間受入のテスト仕様

### 目的

拡張機能UIを人間が通常Webページで確認できるようにしつつ、Chrome固有動作をWebプレビューだけで合格にしない受入順序を確定する。

### 変更

- remoteのTASK-001 scaffoldをfast-forwardで取り込み、Plasmo、Vitest、品質scriptが存在する最新状態を正本にした。
- [TESTING.md](TESTING.md) を追加し、production UIをfake Adapterとfixtureで通常Webページへ表示する仕様を定義した。
- AIエージェントがビルド済み拡張機能をPlaywrightで確認し、report、screenshot、trace、skipを人間へ渡すことを必須にした。
- 人間はAIエージェント確認後、同じcommit／buildを実Chromeで確認して承認または差戻しを記録する最終gateとした。
- REQUIREMENTS、CONSTRAINTS、DESIGN、FRONTEND、SECURITY、PLANS、TASKS、BACKEND_TASKS、QUICKSTART、索引、長期MEMORY、ISSUES、技術的負債、参考資料へ横断反映した。
- TASK-013としてWebプレビュー／Playwright harness実装を登録し、Storybook等のrunner、Playwright版、artifact保持条件はISSUE-018で追跡する。

### 検証

- `git diff --check`: 成功。
- Markdown: 相対リンクと見出しanchor、code fence、上位Markdown basenameを静的検査し、参照エラー0件。
- `AI_GUIDE.md`: 0バイトを維持。
- 環境: Node v22.23.2。PATHにpnpm／Corepackがなかったため、`npx pnpm@10.15.1`でlockfileどおり依存を導入した。
- `npx pnpm@10.15.1 lint`: 成功。
- `npx pnpm@10.15.1 typecheck`: 成功。
- `npx pnpm@10.15.1 test`: 成功（1 file、2 tests）。
- `npx pnpm@10.15.1 build`: 成功（Plasmo 0.90.5、chrome-mv3）。
- UI Webプレビュー、Playwright拡張E2E、人間の実Chrome受入: harness未実装のため未実施。仕様追加だけで成功扱いにしない。

### 残課題

- TASK-013で `ui:preview`、`ui:build`、`test:e2e`、`test:e2e:ui` と必須fixtureを実装する。
- AIエージェントの最初のPlaywright証拠と人間の受入記録は、実装後の同じcommit／buildに対して作成する。

## 2026-08-17 — 最新UI・設定・分類・共有仕様とテスト契約の更新

### 目的

更新されたデザイン正本と利用者の最新指示に合わせ、カテゴリ親／タグ子、設定入力、検索、AIアシスタント、作成・管理、初回ホーム、archive、Drive／QR共有を実装タスクとテスト受入へ反映する。

### 変更

- カテゴリを親、タグを子とする固定2階層へ更新した。最終指示によりCATEGORY／TAG各namespaceの正規化名をglobal uniqueとし、タグは親をまたいでも同名別IDを禁止した。カテゴリ名とタグ名の相互一致は許可する。作成画面はcreate-onlyとし、競合時は既存選択元または別名へ案内する。
- タグ編集では親カテゴリを読取専用とし、親変更はISSUE-019決定後の別タスクとした。過去のWORKLOGにあるタグ同名別ID可は当時の履歴であり、本節で置換済みである。
- Bookmark／カテゴリ／タグ削除を確認画面なしsoft-delete＋undoとし、カテゴリ／タグ管理にはhover／focus鉛筆、子タグ残存カテゴリの削除BLOCK、cascadeなしをタスク・障害対応・fixtureへ反映した。
- 訪問回数とarchive日数を正整数入力、AI細分化だけを `0`〜`4` sliderとし、新規AIタグ上限 `0 / 1 / 2 / 4 / 6` へ対応付けた。`0` でも既存タグの自動付与を続ける。
- 検索を両一覧から移るフルページとし、入力中のkeyword候補を最大8件にした。AIは入力ポップアップ内で検索と応答確認を完結し、Bookmark探索に加えてBookmationの機能説明を扱う。
- Bookmark編集のカテゴリ／タグ別入力、最大8件候補、説明横の新規作成ボタン、同じmodal内side view、カテゴリ・タグ一覧での種類選択と連続作成をタスク化した。
- `runtime.onInstalled` の `reason=INSTALL` だけで初回ホーム状態を初期化し、UPDATEや通常起動では再初期化しない契約を追加した。
- 自動Bookmarkリマインダーの有効toggleと「次回以降表示しない」、カテゴリ・タグ／ページ名／URLだけのarchive、設定一覧からの選択復元を反映した。
- QRはカテゴリ／タグ／個別Bookmarkを検索とcheckboxで選択し、生成／読取previewを行う。Driveは同一accountの `appDataFolder` 同期と、別accountの通常Drive file＋permissions/capabilities共有を別経路にした。
- README、バックエンドフロー、Execution Plan規約、TASKS／TODO、QUICKSTART、技術的負債、トラブルシューティング、TESTINGのfixture／Playwright／人間受入を同じ仕様へ更新した。

### 検証

| 確認項目 | 結果 |
| --- | --- |
| 差分形式 | 担当11文書への `git diff --check` 成功 |
| Markdown | Nodeによる担当11文書のfenceと相対リンク172件、現行仕様assertionの検査に成功 |
| lint | `node_modules/.bin/eslint .` 成功 |
| 型検査 | `node_modules/.bin/tsc --noEmit` 成功 |
| unit test | `node_modules/.bin/vitest run` 成功（1 file、2 tests） |
| build | `node_modules/.bin/plasmo build` 成功（Chrome MV3） |
| `AI_GUIDE.md` | 0バイトを維持し、編集していない |

PATH上に `pnpm` がなかったため、同じcheckoutの `node_modules/.bin` にある固定済み実行ファイルで品質確認した。UI Webプレビュー、Playwright拡張E2E、人間の実Chrome確認、Prompt API、OS通知、QRカメラ、実Googleアカウント／Driveは未実装または未実施であり、文書更新だけで動作確認済みとはしない。

### 残課題

- TASK-013で最新画面状態のWeb fixtureとPlaywright harnessを実装し、AIエージェントの証拠を人間受入へ引き渡す。
- Drive通常file共有の権限粒度、QR容量、設定の正整数範囲は対応Plan／Issueで確定し、実アカウントと実機で確認する。

## 2026-08-17 — 最終監査: 名前予約・Undo・正規化・共有競合

### 目的

実装着手前の最終監査として、名前の一意性、削除からの復元、AI分類snapshot、訪問／archive権限、QR／Drive競合の境界を、実装タスク、fixture、障害対応、利用開始手順で同じ契約にそろえる。

### 変更

- Label Normalizer v1を、NFKC、Unicode whitespaceのtrim／collapse、固定localeに依存しないcase fold、制御／禁止不可視文字拒否、版番号を持つ規則としてfixture化した。CATEGORY／TAGは各namespaceでglobal uniqueとし、tombstone中も正規化名を予約する。同名作成では削除済み同一IDの明示復元または別名を求め、物理回収後だけ再利用できる。
- Bookmark／Category／Tagのsoft-deleteとundoを `deleteOperationId`＋revision照合へ統一し、`UNDO_EXPIRED` と `UNDO_CONFLICT` を分けた。削除→同名作成拒否→undoを必須fixtureにした。P0ではTagの親Category変更を扱わず、子Tagが残るCategoryの削除では「子Tagを削除」「中止」だけを案内する。
- AI細分化を `{ granularity, maxNewTags }` のdiscriminated snapshotとして `0→0 / 1→1 / 2→2 / 3→4 / 4→6` の5組へ限定した。`tagUniqueName` 競合はoriginを問わず既存Tagを再評価し、USER由来を優先しつつ親／意味不適合を `NEEDS_REVIEW` にする。
- 「次回以降表示しない」を対象canonical URLだけの `SUPPRESSED` とし、globalな `frequentVisitReminderEnabled` と別URLを維持する契約へ統一した。archive専用toggleは追加せず、初回開始時にhistory権限の目的を説明し、拒否時は入力日数を保持して「権限待ち」で停止する。notifications権限はリマインダーだけに使用する。
- QR checksumを破損／切詰め検出だけに限定し、真正性保証には使わないと明示した。異親同名Tagは既存再利用／親変更をせず、別名／skip／cancel後に再previewする。Driveの同一field更新、update-delete、add-delete、名前競合は自動LWWせず `syncConflicts` へ隔離する。
- CorepackまたはPATH上のpnpmを利用できない環境向けに、READMEとQUICKSTARTへ `npx --yes pnpm@10.15.1 ...` の固定版fallbackを追加した。

### 検証

| 確認項目 | 結果 |
| --- | --- |
| 差分形式 | 担当11文書への `git diff --check` 成功 |
| Markdown | Nodeによる担当11文書の相対リンク172件、code fence 30 markerを検査し、エラー0件 |
| 現行仕様assertion | 必須監査語と旧global抑止／旧設定名等の禁止表現を検査し、エラー0件 |
| lint | `node_modules/.bin/eslint .` 成功 |
| 型検査 | `node_modules/.bin/tsc --noEmit` 成功 |
| unit test | `node_modules/.bin/vitest run` 成功（1 file、2 tests） |
| build | `node_modules/.bin/plasmo build` 成功（Plasmo 0.90.5、Chrome MV3） |
| `AI_GUIDE.md` | 0バイトを維持し、編集していない |

UI Webプレビュー、Playwright拡張E2E、人間の実Chrome確認、Prompt API、OS通知、QRカメラ、実Googleアカウント／Driveは未実装または未実施である。静的検査と現行scaffoldのbuild成功を、これらの動作確認済みとは扱わない。

### 残課題

- TASK-013で今回固定したfixtureとWebプレビュー／Playwright harnessを実装し、同じcommit／buildを人間が確認する。
- archiveのhistory権限待ち、canonical URL単位の抑止、QR import解決、Drive `syncConflicts` は実装後に実Chrome／実アカウントで検証する。

## 2026-08-17 — 最終監査: Unicode asset・Tag tombstone親子・Drive解決証跡

### 目的

名称一意性を端末差から守り、Tagのsoft-delete／restore／GC順序とDrive競合解決の証跡を、要件・制約・実装タスク・fixtureで同じ契約に固定する。

### 変更

- Label Normalizer v1をproject-vendored Unicode 15.1.0のNFKC、`White_Space`、`Default_Ignorable_Code_Point`、`CaseFolding.txt` C＋F assetへ固定し、runtime ICUへ依存しない契約にした。生成asset hashは実装時に固定してgolden fixtureで照合する。
- active Tagだけにactive親Categoryを必須とした。tombstone Tagはdeleted親を参照できるが、Tag restoreは親Category restore後に限定し、全子Tag tombstoneが消滅するまで親Categoryの物理GCをblockする。
- P1 Drive競合をimmutable `syncSnapshots` と明示resolution planで扱い、open中のsnapshot GCを禁止した。解決後も30日保持し、Label ID／Bookmark-Label edgeを暗黙にremapしない契約とfixtureを追加した。
- CATEGORY／TAG各namespaceの正規化名global unique、tombstone中の名前予約、同名別ID禁止は維持した。

### 検証

- `git diff --check`（対象10文書）: 成功。
- Markdown静的検査（対象10文書）: 相対リンク109件、code fence 10 marker、エラー0件。
- 3契約の必須語と、同名別ID許可・tombstone親必須・runtime ICU依存・open中GC許可・暗黙remap許可の矛盾表現を静的検査し、エラー0件。
- 文書だけの変更であり、runtime test、Webプレビュー、Playwright、実Chrome／Drive確認は未実施。

### 残課題

- TASK-003／TODO-023でUnicode asset生成・hash固定とgolden vectorを実装する。
- TASK-104で競合snapshot、resolution plan、保持期限、明示解決UIを実装し、実Driveアカウントで確認する。

## 2026-08-17 — 仕様上書き: 削除Undoを提供しない

### 目的

Bookmark、Category、Tagの削除後にUndoを提供しないという最新の明示要件を、運用・計画・テスト文書へ反映する。確認画面なしの論理削除、tombstoneの名前予約と親子参照、同期競合時のtombstone安全性は維持し、ARCHIVED Bookmarkの復元とは区別する。

### 変更

- 削除Undo用のoperation／store／token／期限、`UNDO_EXPIRED`／`UNDO_CONFLICT`、Undo toast、設定／管理画面からの削除復元入口を実装タスクとfixtureから除外した。
- Category／Tagの削除済み同名項目は物理回収まで名前を予約し、別ID作成を拒否する。active Tag／active親の不変条件、tombstone Tagからdeleted親への参照、子Tag tombstoneが残る親CategoryのGC拒否を維持した。
- [ISSUES.md](ISSUES.md) のISSUE-021をOpen一覧から外し、ISSUE-D31へ「削除Undoなし」を決定として追加した。
- GitHub Issue #7、#10、#11、#12、#21の完了条件／依存を同じ決定へ更新し、決定Issue #42を「削除Undoを提供しない」で完了にした。既存のlabelとmilestoneは維持した。
- 2026-08-17の過去記録にあるsoft-delete＋Undo、削除済みID復元、親先行restoreの記述は、当時の履歴として残すが本項の最新決定により置換済みである。
- アーカイブ一覧からの復元と、Driveのupdate-delete競合／delete tombstone処理は削除Undoではないため変更していない。

### 検証

- `git diff --check`: 成功。
- 担当文書の現行仕様検索: `deleteOperationId`、`UNDO_EXPIRED`、`UNDO_CONFLICT`、ISSUE-021の現行参照が0件であることを確認した。WORKLOGの置換済み履歴は除外した。
- Markdown 25ファイル、相対リンク264件、code fenceを検査し、リンク切れと未閉鎖fenceが0件であることを確認した。
- `docs/AI_GUIDE.md`: 0バイトを維持し、編集していない。
- ESLint、`tsc --noEmit`、Vitest 2件、Plasmo production build: 成功。
- GitHub全Issueを逆検索し、旧仕様の即時Undo、削除復元、ISSUE-021依存が決定内容を示すclosed #42以外に残っていないことを確認した。
- 文書のみの更新であり、UI Webプレビュー、Playwright拡張E2E、実Chrome確認は未実施。

### 残課題

- 実装時に削除Undo用のUI、message、store、error codeを追加せず、確認なしsoft-delete、tombstone予約、親子GC、Drive同期競合を自動／E2Eテストする。

## 2026-08-17 — Tag-only Bookmark編集とCategory cascade再分類

### 目的

更新済みデザイン正本と利用者の最新指示に合わせ、Bookmark編集、Tag／Category作成、Category使用状況、Category削除後の再分類を同じ契約へ統一する。

### 変更

- Bookmark編集の分類入力をTagだけにし、名前／URL／Tagを編集対象とした。Categoryは選択Tagの親から自動導出し、直接入力を設けない。
- Tag作成でactiveな既存Categoryをkeyword入力し、一致度の高い最大8候補から必須選択する。Category新規作成は同じmodalのside viewで行い、Tag draftを保持して戻った時に新規Categoryを自動選択する。
- Tagの親Categoryを作成時固定とし、ISSUE-019をOpen一覧から外してDecidedへ移した。親変更UI／commandは提供しない。
- Category編集へ使用中Tagの実名一覧と件数、関連Bookmarkのunique件数を追加した。
- Bookmark／Tag削除は確認なしを維持し、Category削除だけは全子Tagと関連edgeのcascade soft-delete、影響件数、Bookmark再分類を警告して確認する。確認後はBookmark本体を残して再分類JobをPENDINGにし、AI失敗はNEEDS_REVIEW／手動分類へ送る。Undoは提供しない。
- タスク、Execution Plan規約、Web fixture／Playwright／人間受入、技術的負債、障害対応を、警告取消、revision競合、transaction rollback、PENDING／NEEDS_REVIEWまで追跡できる形へ更新した。
- `デザインシート.svg` は利用者が更新した正本をそのまま保持し、本作業では編集していない。現物のSHA-256 `1245e8b3f6eddaca45d1d821cd6800cca7c5321be30229b9e5f1e317df966522` を [REFERENCES.md](REFERENCES.md) へ記録した。
- 過去のWORKLOGにあるBookmarkのCategory直接編集、ISSUE-019保留、非空Category削除BLOCK／cascade禁止は当時の履歴として残すが、本節と現行要件により置換済みである。

### 検証

- `sha256sum デザインシート.svg`: `1245e8b3f6eddaca45d1d821cd6800cca7c5321be30229b9e5f1e317df966522`。
- 現行文書を逆検索し、ISSUE-019のOpen／決定待ち、非空Category削除BLOCK、cascade禁止、BookmarkのCategory直接編集が残っていないことを確認した。過去のWORKLOG記録だけは履歴として保持した。
- `git diff --check`: 成功。
- これは仕様文書と参照hashの静的検証である。UI Webプレビュー、Playwright、実Chrome、AI再分類、IndexedDB transactionの実行確認は実装後に必要であり、今回の成功条件には含めていない。hash一致だけではSVGの視覚的正しさを証明しない。

### 残課題

- Category cascade削除のexpected revision、原子的soft-delete、再分類Job冪等性を実装し、0件／大量件数／途中失敗をfixtureとE2Eで検証する。
- 更新済みデザインシートと実装画面の視覚差、警告文の理解しやすさ、keyboard／screen reader操作はAIエージェント確認後に人間が受け入れる。

## 2026-08-17 — Tag編集からの親Category変更を確定

### 目的

再保存された最新デザインシートと利用者指示を正本とし、管理モードのTag編集から親Categoryを変更できる仕様へ上書きする。

### 変更

- Tag編集modalへ親Category入力を置き、activeな既存Categoryをkeyword一致度順の最大8候補から選択できるようにした。必要なCategoryは同じmodalのside viewで作成し、Tag編集draftを保持して戻った時に自動選択する。
- 保存時はTagと選択先Categoryのexpected revision、およびsubmit開始時に1回発行する `tag-update:<UUID>` requestIdを検証し、Tag、新旧Category、全参照active Bookmark／edgeを1 transactionで再検証する。Tagの親を更新した後、各BookmarkのCategory closure、revision、検索派生データ、同期Outbox、mutation receiptを原子的に更新する。同request再送はreceiptに保存した同じ `UpdateTagResult` へ収束させ、別payloadでのrequestId再利用を拒否する。
- Category連鎖削除は `category-delete:<UUID>` requestIdとし、Tag更新とuse case別namespaceを分けて同期batch IDの衝突を防ぐ。UIは同一payloadの応答消失／retryで同じIDを再利用する。
- Tag IDとTag名のglobal unique規則を維持し、親変更を理由とするAI再分類は行わない。競合または途中失敗時は全件rollbackし、Tag編集dialogとdraftを保持する。
- 親変更は管理モードの利用者操作だけに限定し、AI分類、Import、同期競合から暗黙に実行しない。QR Importの異親同名競合を自動移動しない規則は維持する。
- [ISSUES.md](ISSUES.md) のISSUE-019を「管理モードTag編集から親変更可」のDecidedへ更新し、タスク、fixture、技術的負債、障害対応を参照Bookmark 0件／1件／多数、expected revision競合、全件rollback、AI再分類なしまで揃えた。
- 直前のWORKLOGにある「Tag親は作成時固定」とSHA-256 `1245e8b3...6522` は当時の入力に基づく履歴であり、本節で置換した。Category警告付きcascade soft-deleteと影響Bookmark再分類の契約は変更していない。

### 検証

- 完了直前の `sha256sum デザインシート.svg`: `44b39333bd9d91d3f617508703273bfed0c766802ecce935226a8c62c0bcd751`。
- 現行文書を逆検索し、Tag親固定、親変更UIなし、immutable error、親変更拒否が担当文書に残っていないことを確認した。WORKLOGの置換済み履歴と、AI／Importが親を暗黙変更しない規則は除外した。
- `git diff --check`: 成功。
- Markdown 25ファイル、相対リンク262件、code fenceを検査し、リンク切れと未閉鎖fenceが0件であることを確認した。
- ESLint、`tsc --noEmit`、Vitest 2件、Chrome MV3向けPlasmo production build: 成功。
- GitHub Issue #7、#12、#21、#40を最新のTag親変更／Category cascade契約へ更新した。既存ラベル、マイルストーン、open／closed状態を維持し、#10と#42は現行仕様と一致するため変更していない。
- `docs/AI_GUIDE.md`: 0バイトを維持し、編集していない。
- これは文書と参照hashの静的検証である。hash一致はSVGの視覚的正しさを証明しない。UI Webプレビュー、Playwright、実Chrome、IndexedDBの多数Bookmark transactionは実装後に検証する。

### 残課題

- Tag親変更の参照Bookmark 0件／1件／多数、同じ旧親を残す別Tagあり／なし、Tag／親revision競合、quota失敗、再送をRepository／E2E fixtureで検証する。
- 最新デザインシートと実装画面のCategory combobox、side view、draft／focus復帰をAIエージェントが確認し、その後に人間が受け入れる。

## 2026-08-17 — 右クリック保存の設定toggleを追加

### 目的

利用者が設定画面からpage／linkの右クリック保存項目を有効化または無効化できる確定仕様へ更新する。

### 変更

- 一般設定に `右クリックメニューから保存` switchを追加し、端末固有の `contextMenuBookmarkEnabled` として既定ONにした。
- ONではBookmation所有のpage／link固定IDを重複なく登録し、OFFではその2 IDだけを解除する契約へ統一した。OFF切替直前の遅延clickも保存前の設定再確認で拒否する。
- 旧settingsのfield欠損はON、boolean以外の破損値はOFFへ移行し、install／startup／storage変更時にService Workerが登録状態をreconcileすることをDB、backend、security、task、test、troubleshootingへ反映した。
- Chrome公式のcontextMenus APIとstorage.onChangedを2026-08-17に再確認し、参照先を更新した。

### 検証

- `git diff --check`: 成功。
- Markdown 25ファイルの相対リンク、code fence、table列数: 異常0件。
- `docs/AI_GUIDE.md`: 0バイトを維持し、編集していない。
- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 1ファイル／2件。
- `npx --yes pnpm@10.15.1 build`: 成功、Chrome MV3向けPlasmo production build。
- UIとChrome API実装は未実装であり、実際のmenu表示／解除はTASK-106とPlaywright／人間受入で確認する。

## 2026-08-17 — 初回Category template機能を仕様・タスク化

### 目的

具体的なcatalog内容は未確定のまま、初回オンボーディングでCategory templateを利用できる機能の採用を確定し、判断待ちと実装作業を追跡可能にする。

### 変更

- P0要件FR-031と決定ISSUE-D33で機能採用を確定し、候補名／件数、set、選択、初期選択、skip、名前編集、再表示、locale、version、再適用、競合UXをISSUE-022へ分離した。
- catalog閲覧だけではCategoryをseedせず、利用者の明示適用を既存の `origin=USER` Category作成へ合流させる境界を、UI、Frontend、Backend、DB、Securityへ反映した。
- TASK-014とBE-19を追加し、P0依存フロー、request冪等性、onboarding途中再開、update／reload非再適用、同名／tombstone競合、Web preview／Playwright／人間受入まで作業化した。
- TODO-025に比較fixture、TD-018に未実装リスク、TROUBLESHOOTINGに閲覧時seed／retry重複の診断を追加した。
- GitHubへ [#43 ISSUE-022](https://github.com/anti-fact/Bookmation/issues/43) と [#44 TASK-014](https://github.com/anti-fact/Bookmation/issues/44) を追加し、統合デモ [#22](https://github.com/anti-fact/Bookmation/issues/22) とWebプレビュー／Playwright [#38](https://github.com/anti-fact/Bookmation/issues/38) の本文を現行仕様へ更新した。

### 検証

- `git diff --check`: 成功。
- Markdown 25ファイル、相対リンク264件、code fence、table列数: 異常0件。
- FR 41件、ISSUE 50件、TASK見出し14件、BE見出し20件のID重複: 0件。
- `docs/AI_GUIDE.md`: 0バイトを維持し、編集していない。
- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 1ファイル／2件。
- `npx --yes pnpm@10.15.1 build`: 成功、Chrome MV3向けPlasmo production build。
- `gh issue view 22 38 43 44` 相当の個別照合: #43／#44はopen、`p0` と既存種別／領域label、`P0-3 一覧とカテゴリ` milestoneを持つ。#22のclosed、#38のopen、および両Issueの既存label／milestoneを維持した。
- Category templateのUI、catalog、Repository、E2Eは未実装であり、具体仕様はISSUE-022をDecidedにしてからTASK-014／BE-19で実装する。

## 追記テンプレート

```markdown
## YYYY-MM-DD — <成果>

### 目的

### 変更

### 検証

- コマンド: `...`
- 結果: 成功 | 失敗 | 未実施
- 証拠・観察: ...

### 残課題
```
