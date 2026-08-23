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

| 確認項目                     | 状態             | 備考                                                                                            |
| ---------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| 指定された文書が全て存在する | 確認済み         | 指定19ファイルが `docs/` 直下に存在する                                                         |
| `AGENTS.md` が目次だけである | 確認済み         | 見出しとMarkdownリンク以外の本文がない                                                          |
| Markdown相対リンクが解決する | 確認済み         | Markdownパーサーで相対リンク161件、見出しリンク12件、参照先漏れ0件                              |
| 外部参考リンクが応答する     | 確認済み         | 重複を除く25 URLへ2026-08-14にGETし、全てHTTP 200。内容の恒久性を保証するものではない           |
| `AI_GUIDE.md` が空である     | 確認済み         | `wc -c` で0バイト                                                                               |
| 要件と設計の矛盾がない       | 静的レビュー済み | 最新依頼をPDFより優先し、右タグサイドバー、3段階分類、3表示、Prompt APIの非Worker実行へ統一した |
| ビルド・lint・型検査・テスト | 実行不能         | 2026-08-14時点ではソースと`package.json`がない                                                  |
| Chrome実機・Prompt API       | 未実施           | 文書作業のみで、拡張機能も未実装                                                                |

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

| 確認項目       | 結果                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| 指定文書       | `docs/` 直下の19ファイルが存在する                                                                        |
| Markdownリンク | 相対リンク177件、うち見出しリンク13件をパーサーで検査し、参照先漏れ0件                                    |
| 旧仕様識別子   | `majorCategories`、`majorCategoryId`、`parentTagId`、旧検索scopeの現行仕様への残存0件                     |
| 文書形式       | コードフェンス不整合0件、末尾空白0件                                                                      |
| `AGENTS.md`    | 見出しと索引リンクだけである                                                                              |
| `AI_GUIDE.md`  | 0バイトのままである                                                                                       |
| 添付PDF        | SHA-256は `0817bed21a4a532572688ddb108a991232162fd30cf686a533cc88c79d591d31` で、文書更新前の確認値と同一 |
| 実装検証       | `package.json` とアプリソースがないため、build、lint、型検査、Chrome実機確認は実行不能                    |

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

| 確認項目           | 結果                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- |
| Markdownファイル名 | `README.md`、`AGENTS.md`、`docs/`直下19文書のベース名がすべて大文字規則に一致      |
| Markdownリンク     | README、AGENTS、docsを含む相対リンク192件、見出しリンク13件を検査し、参照先漏れ0件 |
| 旧ファイル名参照   | 現行リンクへの `index.md`、`db-schema.md`、`tech-debt-tracker.md` の残存0件        |
| `AI_GUIDE.md`      | 0バイトのままである                                                                |
| 実装検証           | `package.json` がないため、build、lint、Chrome実機確認は実行不能                   |

## 2026-08-14 — 実装タスク一覧の作成

### 目的

チームがBookmationの実装を依存順に分担できるよう、短期TODOや未決定事項とは別に、利用者へ届く成果と完了条件を持つワークパッケージを定義する。

### 変更

- `docs/TASKS.md`を追加し、文書の責務、状態、優先度、P0クリティカルパス、12件のP0 Task、4件のP1候補、直近の着手順、更新規則を記録した。
- `AGENTS.md`、`README.md`、`docs/INDEX.md`から`TASKS.md`へ到達できるようにした。
- `TODO.md`を小規模作業、`TASKS.md`を実装ワークパッケージ、`PLANS.md`を長時間作業の実行規約として区別した。

### 検証

| 確認項目       | 結果                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| 文書数         | `docs/`直下のMarkdownは20ファイル                                                  |
| Markdownリンク | README、AGENTS、docsを含む相対リンク213件、見出しリンク13件を検査し、参照先漏れ0件 |
| 文書名         | 全Markdownのベース名が大文字規則に一致                                             |
| `AGENTS.md`    | `docs/`直下20文書を過不足なく列挙                                                  |
| `AI_GUIDE.md`  | 0バイトのままである                                                                |
| 実装検証       | `package.json`がないため、build、lint、Chrome実機確認は実行不能                    |

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

| 確認項目      | 結果                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| 差分形式      | `git diff --check` 成功                                                                                          |
| Markdown      | 22ファイル、fence不整合0件、base nameは全て大文字規則に一致                                                      |
| リンク        | fence内templateを除く相対リンク199件、見出しリンク11件、参照エラー0件                                            |
| 旧UI識別子    | active specに旧search route/use case、ranked candidate、grid/bento列設定、BENTO enum、右追従sidebarの採用記述0件 |
| `AI_GUIDE.md` | 0バイトを維持                                                                                                    |
| SVG           | SHA-256 `c704c52370a61cc30dba54481e134bbd638acf775695690b92275512c4d181d8`。確認前後で同一                       |
| 実装検証      | `package.json` とアプリソースがないためbuild、test、Chrome実機確認は未実施                                       |

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

| 確認項目      | 結果                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| 差分形式      | `git diff --check` 成功                                                                   |
| Markdown      | 23ファイル、fence block 30件、未閉鎖0件                                                   |
| リンク        | fence内sampleを除く相対リンク217件、見出しリンク11件、参照エラー0件                       |
| ファイル名    | root／docsのMarkdown basenameは大文字、`AI_GUIDE.md` は0バイト                            |
| 旧仕様scan    | active specの旧名称、画面別search API、旧join名、保留表現、旧archive fieldは0件           |
| タスク整合    | BE-00〜BE-18が一覧19件・詳細19件で一致、Mermaid block 2件                                 |
| 正本assertion | FR-101〜110、TASK-101〜106、検索順、JSON、archive、閾値、権限・同期識別子を静的確認       |
| 実装検証      | `package.json` とアプリソースがないためbuild、test、Chrome実機、Drive、QR動作確認は未実施 |

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

| 確認項目      | 結果                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| 差分形式      | 担当11文書への `git diff --check` 成功                                      |
| Markdown      | Nodeによる担当11文書のfenceと相対リンク172件、現行仕様assertionの検査に成功 |
| lint          | `node_modules/.bin/eslint .` 成功                                           |
| 型検査        | `node_modules/.bin/tsc --noEmit` 成功                                       |
| unit test     | `node_modules/.bin/vitest run` 成功（1 file、2 tests）                      |
| build         | `node_modules/.bin/plasmo build` 成功（Chrome MV3）                         |
| `AI_GUIDE.md` | 0バイトを維持し、編集していない                                             |

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

| 確認項目          | 結果                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| 差分形式          | 担当11文書への `git diff --check` 成功                                         |
| Markdown          | Nodeによる担当11文書の相対リンク172件、code fence 30 markerを検査し、エラー0件 |
| 現行仕様assertion | 必須監査語と旧global抑止／旧設定名等の禁止表現を検査し、エラー0件              |
| lint              | `node_modules/.bin/eslint .` 成功                                              |
| 型検査            | `node_modules/.bin/tsc --noEmit` 成功                                          |
| unit test         | `node_modules/.bin/vitest run` 成功（1 file、2 tests）                         |
| build             | `node_modules/.bin/plasmo build` 成功（Plasmo 0.90.5、Chrome MV3）             |
| `AI_GUIDE.md`     | 0バイトを維持し、編集していない                                                |

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

## 2026-08-18 — 訪問リマインダーを訪問日数判定へ変更

### 目的

訪問回数ベースの保存リマインダーを、選択期間内で訪問した暦日数による判定へ置き換える。集計期間変更時の入力制約と、`いいえ` 後の再集計基準を実装可能な契約へ固定する。

### 変更

- 集計期間を `1週間`／`1ヶ月`／`1年` のプルダウンとし、当日を含む直近7／30／365暦日へ対応させた。同一canonical URLへの同日複数訪問は1日と数える。
- 期間変更時に訪問日数入力をnullへ戻し、1〜7／1〜30／1〜365へ制限する。有効な組がそろうまで `REMINDER_CONFIG_REQUIRED` として判定を停止する。
- `いいえ` は対象canonical URLの `countingResetAt` を応答時刻へ更新し、それ以前の訪問日を次回集計へ使わない。`次回以降表示しない` はresetより優先するURL単位のSUPPRESSEDとして維持した。
- `frequentVisitThreshold` を廃止し、`frequentVisitWindow` とnullableな `frequentVisitDayThreshold` へ置き換えた。旧回数値は日数へ暗黙移行せず、リマインダーを無効・設定未完了へ戻して再入力を求める。
- Bookmarkから `visitCount` を外し、訪問日数は `chrome.history.getVisits()` の `visitTime` を評価時だけ暦日集合へ縮約する契約にした。完全なvisit列や日別一覧は永続化しない。
- 自動archiveの「権限未許可」を判定全体の権限待ち、「履歴なし」を権限許可済みでも対象URLの信頼できる訪問日時がなく `lastVisitedAt=null` の個別skipとして区別した。再照会／手動archive UIはISSUE-009の未決事項として維持した。
- 過去のWORKLOGにある訪問回数入力と集計期間未定の記録は当時の履歴として残し、本節と現行要件で置き換えた。デザインシートは編集していない。

### 検証

- Chrome公式 `chrome.history` APIを2026-08-18に再確認し、`getVisits()` がURL別の `VisitItem.visitTime` を返すことを確認した。
- `git diff --check`: 成功。
- Markdown 25ファイル、相対リンク264件、code fence、table列数: 異常0件。
- FR 41件、ISSUE 51件、TASK見出し14件、BE見出し20件のID重複: 0件。
- `docs/AI_GUIDE.md`: 0バイトを維持し、編集していない。
- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 1ファイル／2件。
- `npx --yes pnpm@10.15.1 build`: 成功、Chrome MV3向けPlasmo production build。
- 訪問リマインダーと自動archiveは未実装である。今回の成功は文書・既存scaffoldの静的検証であり、実履歴、通知、日付境界、timezone変更、Playwright、実Chromeの動作を証明しない。

## 2026-08-18 — QR／CSV共有と権限gate付き自動archiveを確定

### 目的

QR容量を超える共有でも選択内容を失わずにexportできる導線と、自動archiveを利用者が安全に有効化できる権限境界を確定する。あわせて、訪問リマインダーとarchiveの既定値を実装可能な状態へ固定する。

### 変更

- 同じ固定Bookmark集合に対してQRとCSVの2つのexport操作を提供する契約へ更新した。QRが実encoder容量を超える場合は分割・切捨て・部分生成を行わず、`QR_CAPACITY_EXCEEDED` と `CSVでエクスポート` を表示し、選択を維持してCSVへ移る。
- CSV v1をUTF-8、header付き、1 Bookmark 1行の `BOOKMATION_CSV_1` とし、`formatVersion,title,url,categoriesJson,tagsJson` の固定列、CSV escape、数式注入対策、秘密情報除外を要件・設計・task・testへ反映した。CSV importは今回の対象外とした。
- `autoArchiveEnabled` を既定OFFのtoggleとして追加した。ON操作は利用者gesture内でhistory権限を確認・必要時に要求し、許可と設定保存が成功した場合だけONへcommitする。拒否、取消、例外、後発の権限削除ではOFFを維持またはOFFへ戻し、alarmを止める。
- `archiveAfterDays` の新規install／欠損migration既定を30日とした。訪問リマインダーの `frequentVisitDayThreshold` は既定値を持たないnullとし、有効な日数を入力するまで判定しない。
- history権限があっても対象URLの信頼できる訪問日時を取得できない状態を「履歴なし」とし、`lastVisitedAt=null` のまま `ARCHIVE_HISTORY_NOT_FOUND` と `履歴がないためアーカイブできません` を項目別表示してarchive不可にした。
- 過去のWORKLOGにある「自動archive toggleを設けない」と「履歴なしを個別skipするだけ」という記録は当時の履歴として残し、本節と現行要件で置き換えた。実行頻度、履歴再確認／手動archive UI、評価結果の保持期間はISSUE-009で引き続き未決とした。
- GitHub Issue [#23](https://github.com/anti-fact/Bookmation/issues/23)〜[#29](https://github.com/anti-fact/Bookmation/issues/29)を現行仕様へ同期した。ISSUE-010の[#27](https://github.com/anti-fact/Bookmation/issues/27)とISSUE-017の[#28](https://github.com/anti-fact/Bookmation/issues/28)はCSV fallback採用でDecided／completedとし、残る判断Issueと実装Taskは既存label／milestoneを維持してopenとした。

### 検証

- Chrome公式のPermissions APIとHistory APIを2026-08-18に再確認し、optional permissionの利用時要求、利用者gesture内の `permissions.request()`、実権限確認／取消通知、およびURL別訪問日時取得を設計境界に反映した。
- `git diff --check`: 成功。
- Markdown 25ファイル、相対リンク264件、code fence、table列数: 異常0件。
- FR 41件、ISSUE 51件、TASK見出し14件、BE見出し20件のID重複: 0件。
- `docs/AI_GUIDE.md`: 0バイトを維持し、編集していない。
- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 1ファイル／2件。
- `npx --yes pnpm@10.15.1 build`: 成功、Chrome MV3向けPlasmo production build。
- `gh issue view 23 24 25 26 27 28 29` 相当の個別照合: #23〜#26／#29はopen、#27／#28はcompletedでclosed、全Issueが従来のlabel／`P1 確定機能` milestoneを維持した。
- QR／CSV共有、自動archive、訪問リマインダーは未実装である。今回の成功は文書・既存scaffoldの静的検証であり、実QR容量、CSV download、history権限prompt、履歴照会、alarm、Playwright、実Chromeの動作を証明しない。

## 2026-08-18 — 標準Bookmark取込を直上FolderのTagだけに限定

### 目的

Chrome標準BookmarkのFolder treeをBookmation分類へ過剰に持ち込まず、各Bookmarkが実際に入っている直上FolderだけをTagとして再利用／作成する取込契約へ固定する。

### 変更

- `A / B / ページ` の取込では、Folder由来Tagを `B` の1件だけとした。祖先 `A`、full path、兄弟FolderをCategory／Tagへ変換せず、取込と同時にAI分類Jobも作らない。
- 同名のactive Tagが存在する場合は、そのTag IDと既存の親Categoryを再検証して再利用する。新規Tagの場合は、previewで利用者がactiveな親Categoryを選択するか同一導線のside viewでCategoryを作成してから `origin=IMPORT` で作る。Folder名からCategoryを暗黙作成しない。
- 直上Folder名が空／Normalizerで不正、または同名tombstoneが名前を予約中の場合は、placeholder、自動rename、削除済みLabel復元を行わず、項目skipまたはImport全体cancelへ送る。
- Import Jobへ選択fingerprintとFolder→Tag解決snapshotを持たせ、commit時にTag／親Category revisionを再検証する。選択BookmarkごとにFolder由来Tag edgeを1件だけ作り、Category edgeはTag親集合から導出する。
- ISSUE-016をOpenからDecidedへ移し、FR-109、TASK-105、BE-15、UI、Frontend、Backend、DB、Security、Test、Troubleshooting等を同じ契約へ更新した。過去のWORKLOGにあるFolder対応未定の記録は当時の履歴として残し、本節と現行要件で置き換えた。
- GitHub [#32](https://github.com/anti-fact/Bookmation/issues/32)を同じ決定本文へ更新してcompletedでcloseし、実装Task [#33](https://github.com/anti-fact/Bookmation/issues/33)を直上FolderだけのTag化、親Category解決、AI分類なし、元tree不変の完了条件へ更新してopenを維持した。既存labelと `P1 確定機能` milestoneは変更していない。

### 検証

- `git diff --check`: 成功。
- Markdown 25ファイル、相対リンク264件、code fence、table列数: 異常0件。FR 41件、ISSUE 51件、TASK見出し14件、BE見出し20件のID重複: 0件。
- `docs/AI_GUIDE.md`: 0バイトを維持し、編集していない。
- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 1ファイル／2件。
- `npx --yes pnpm@10.15.1 build`: 成功、Chrome MV3向けPlasmo production build。
- GitHub connectorのwriteはintegration権限不足で403となったため、認証済み `gh` fallbackで更新した。更新後の再取得で#32はclosed／completed、#33はopen、両Issueの従来label／milestone維持を確認した。
- 標準Bookmark取込は未実装である。今回の成功は文書・既存scaffoldの静的検証であり、実Bookmark tree、optional permission prompt、中断再開、Playwright、実Chromeの取込動作を証明しない。

## 2026-08-19 — Figmaデザイン正本の移動とフロントエンド実装ガイド

### 目的

利用者が `figma/` フォルダへ更新した画面／componentデザインシートを新しいUI正本として記録し、Radix Primitives、Plasmo、Tailwind CSS v3で実装する再現可能な手順を用意する。

### 変更

- 画面正本を `figma/Bookmation.svg`、部品・状態の正本を `figma/Bookmation_component.svg` として、要件、制約、設計、UI、Frontend、Memory、Reference、README、索引へ同期した。
- 旧repository直下の `デザインシート.svg` は利用者による削除を保持し、復元・変換・編集していない。新しい2つのSVGも参照・一時renderだけに使い、編集していない。
- ルートへ [FRONTEND_GUIDE.md](../FRONTEND_GUIDE.md) を追加した。正本の優先順位、visual inventory、Radix導入、Tailwind token、Plasmo entry／Port境界、各画面の実装順、状態管理、アクセシビリティ、Webプレビュー、Playwright／人間受入、PR分割と完了条件を記載した。
- Radix PrimitivesをUI behavior基盤として採用した。Radix依存自体はまだ追加せず、実装PRで互換性を確認してexact versionをlockfileへ固定する境界を明記した。
- [AGENTS.md](../AGENTS.md) は見出しとMarkdownリンクだけの目次を維持したまま、実装ガイドへのリンクを1件追加した。[AI_GUIDE.md](AI_GUIDE.md) は空のまま保持した。
- Radix、Plasmo、Tailwind CSS v3の公式資料を2026-08-19に再確認し、[REFERENCES.md](REFERENCES.md) へ確認範囲を記録した。

### 検証

- `sha256sum figma/Bookmation.svg`: `d05997589696ff346f59f3850bfc3296bd5b6acbd3e518980421ff6e0533ea8b`。
- `sha256sum figma/Bookmation_component.svg`: `f6c44b21deea9893c01f1f08c8b8556d1479b05f336dfb6cd70bd1ba0cce8f89`。
- 更新済みSVGを一時PNGへrenderして全体を目視し、画面sheetとcomponent sheetの役割を分けてガイドへ反映した。font familyはpath化されたSVGから確定できないため、Figma Text Style確認を実装前gateとして残した。
- `git diff --check`: 成功。
- Markdown相対リンク、code fence、AGENTS目次形式: 異常0件。テンプレートcode block内の例示リンクは実リンク検査から除外した。
- `docs/AI_GUIDE.md`: 0バイトを維持した。
- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 1ファイル／2件。
- `npx --yes pnpm@10.15.1 build`: 成功、Plasmo 0.90.5でChrome MV3 production build。
- UI本体、Radix依存、Webプレビュー、Playwright、実Chromeは未実装／未実施である。今回の成功は文書、既存scaffold、静的SVG観察の範囲であり、完成画面のvisual一致やruntime動作を証明しない。

## 2026-08-19 — UI-01 token／Radix wrapper／Web component sheet

### 目的

Figmaを見た目の正本、現行docsを挙動・データ・権限の正本として、UI-01だけを実装する。Figmaは読み取り専用とし、feature画面、Chrome API接続、永続化、Playwright E2Eへ範囲を広げない。

### 変更

- Figma URLの対象node `28:343`を`get_design_context`で読み取り専用取得し、`figma/Bookmation.svg`と`figma/Bookmation_component.svg`も変更せず参照した。paper／ink／accent／panel／muted／danger／error、control寸法、radius、shadow、layerをsemantic tokenへ反映した。小さい補助文字は、Figmaの`#7A7A7A`を装飾用に保持しつつ、WCAG AAを下回らない`#505050`の`muted-text`を使う。
- `radix-ui` 1.6.7と`@radix-ui/react-icons` 1.3.2をexact固定した。Button、Dialog、Switch、Slider、Selectのproduction wrapperを追加し、disabled／loading、Portal、focus trap／return、keyboard操作、label／description、`asChild`、reduced motionを共通化した。Dialog内Selectがscrimの背面へ入らないよう、layerをDialog 50、popover 55、Toast 60とした。
- Vite 7.3.6の`preview/ComponentSheet.tsx`を追加し、production token／wrapperを通常Webページで操作できるようにした。`ui:preview`は`127.0.0.1:4173`、`ui:build`は`build/ui-preview`を使う。production用Tailwind scanは`src`だけ、preview用configだけが`preview`もscanし、Plasmo成果物へfixture文字列・preview専用CSSを含めない。
- Vitestをjsdom component testへ拡張し、Button props／ref／`asChild`、Dialog open／Tab cycle／Escape／close／focus return、Switch／Slider／Select keyboard、disabled／pending、reduced motion、component sheetのproduction primitive利用を固定した。
- README、Frontend Guide、Frontend／Testing／Quickstart／Issues／Tasks／References／Troubleshooting／Tech DebtをUI-01の実装状態へ更新した。`AI_GUIDE.md`は0バイトを維持した。

### 検証

- 対象: base commit `d281b524c90a`上の未commit UI-01差分。commit／pushは利用者確認待ちで未実施。
- 環境: Node.js `v22.23.2`、pnpm `10.15.1`、Plasmo `0.90.5`、Vite `7.3.6`。
- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 8ファイル／18件。
- `npx --yes pnpm@10.15.1 ui:preview`: 起動成功。`http://127.0.0.1:4173/`と`main.tsx`のHTTP応答、ComponentSheet entryを確認して終了。
- `npx --yes pnpm@10.15.1 ui:build`: 成功。`build/ui-preview/index.html`のSHA-256は`00beec8c01fbf7c2cc00c77ee4cda511e4f443693bd16ec28997e05925796e88`。
- `npx --yes pnpm@10.15.1 build`: 成功、Chrome MV3向けPlasmo production build。`manifest.json`のSHA-256は`4c5d2fdc5af03816bab23496ebd8bade90457702edd112869b289e625a7a2801`。
- production成果物に`TEST PREVIEW`等のfixture文字列および`min-h-dvh`等のpreview専用CSSがないこと、`git diff --check`、Radix exact解決、Figma 2ファイルの差分なし、`docs/AI_GUIDE.md` 0バイトを確認した。

### 残課題

- Playwright 1.62.1のChromiumで、1440×900 viewportの全ページcomponent sheetを撮影し、日本語fontを含む全sectionの描画を目視確認した。git管理外の`build/screenshots/ui-01-component-sheet.png`は1440×1846 px、SHA-256 `8cc07354ea31b6451097092a3a225e8c99491e5ec323e6c1fcb85c5ad6165be9`である。Figmaとのpixel比較、320 CSS px、200% zoom、screen reader、人間による最終受入は未実施であり、この撮影だけでは見た目の一致を証明しない。
- Figma対象nodeからNoto Sans JP Mediumの参照は得たが、path化された全sheetのText Style数値は確定できない。現行の日本語system sans stackは暫定である。
- App Shell、保存／一覧／検索等のfeature fixture、fake Port、Playwright実拡張E2E、人間の実Chrome受入はTASK-013以降の範囲であり、UI-01では未実装／未実施である。

## 2026-08-19 — UI-02 App Shell／typed hash route／共通header

### 目的

UI-01のtokenとRadix wrapperを土台に、Bookmation全画面で再利用するApp Shell、header、route、error boundaryを実装する。Figmaは見た目の正本として読み取り専用で使い、最新要件とdocsを挙動の正本とする。feature固有データやChrome API接続はUI-02へ含めない。

### 変更

- Figma URLからdefault header `6:16`、カテゴリ・タグ一覧header `62:1093`、設定header `95:1140`、logo `39:593`を`get_design_context`で取得した。Figma fileは編集せず、logoとAI iconのassetを実装へ取り込んだ。カテゴリ・タグ一覧headerには、Figma nodeで省略されていたAI検索を最新要件に従って同じ外観で追加した。
- `AppProviders`、`AppErrorBoundary`、`ExtensionApp`、native document scrollの`AppShell`、default／labels／settingsの`AppHeader`、`IconButton`、Radix Tooltip wrapperを追加した。
- `#/welcome`、`#/home`、Category／Tag別Bookmark一覧、全画面検索、カテゴリ・タグ一覧、一般／archive／共有設定の9 route形式を判別共用体で表し、不正hashは暗黙redirectせずnot-foundとして表示するtyped hash routeを追加した。
- SPA route変更時だけ見出しへfocusし、初回mountではfocus ringを出さない。labels／settingsをアプリ内から開いた場合はbrowser backで元routeとscrollを復元し、直接entryではhomeへreplaceする。settings section間は同じhistory entryをreplaceする。
- 320 CSS pxで折り返すlabels headerの高さに合わせて見出しのscroll marginを256 pxとし、`lg`以上は128 pxへ戻した。labels headerは`lg`未満で折り返し、768 pxでも検索操作を潰さない。
- Web previewはcomponent sheetをrootに維持し、`?view=app-shell#/home`でproduction App Shellとpreview専用fixture menuを表示できるようにした。preview fixtureはPlasmo production bundleへ含めない。
- UI-02コードと`src/ui`全35テキストファイルの日本語解説コメントを単一commit `9d5e44d`へまとめ、Markdownを含まないDraft PR [#49](https://github.com/anti-fact/Bookmation/pull/49)としてUI-01コードPR #45へ積み上げた。旧PR #47はコメント未commit版として#49へ置き換え、本節を含む文書更新は別PRとして管理する。

### 検証

- `npx --yes pnpm@10.15.1 lint`: 成功。
- `npx --yes pnpm@10.15.1 typecheck`: 成功。
- `npx --yes pnpm@10.15.1 test`: 成功、Vitest 17ファイル／84件。
- `npx --yes pnpm@10.15.1 ui:build`: 成功。
- `npx --yes pnpm@10.15.1 build`: 成功、Chrome MV3向けPlasmo production build。
- 最終tabs bundleのSHA-256は`d69840b75916e63bb5f45dadbb1b84713608bc7b6984546c1986f8149dc8aa51`、manifestのSHA-256は`4c5d2fdc5af03816bab23496ebd8bade90457702edd112869b289e625a7a2801`である。
- Playwright 1.62.1とbundled Chromium 151.0.7922.34で最終production buildをunpacked extensionとして読み込み、初回homeで見出しをfocusしないこと、route変更後の見出しfocus、homeの`scrollY=600`復元、back／forward履歴、直接entry時のreplace fallbackを確認した。
- 320 CSS pxのlabels画面ではdocument横overflowなし、header実測約231.8 pxに対して見出しscroll margin 256 pxを確認した。768 CSS pxでは検索操作がviewport内で460×50 pxを確保し、AI検索を含む操作のaccessible nameと応答を確認した。確認経路のconsole error／page errorは0件だった。
- production成果物にWeb preview fixture codeが含まれないこと、`git diff --check`、Figma read-only、`docs/AI_GUIDE.md` 0バイトを確認した。

### 残課題

- Bookmark実データ、保存、検索候補、AI応答modal、カテゴリ・タグ管理、設定formは後続UIで実装する。現在のroute bodyと操作応答には準備中のfixtureが含まれる。
- Playwrightのrepository管理script、CI、report／trace保存、証拠manifest、人間による実Chrome最終受入は未実装／未実施である。今回の一回限りのAI実拡張確認は、その恒常的な受入gateを置き換えない。
- Figmaとのpixel単位比較、200% zoom、screen reader、正式typographyの確定は未検証である。

## 2026-08-22 — BE-01 Domain型と不変条件の実装

### 目的

UI、DB、AIの全入口で共通適用するDomain型、不変条件バリデーター、値オブジェクト、LabelNormalizer v1（Unicode 15.1.0 vendored asset）、およびAI境界・エラーコードを実装し、後続BEタスク（BE-02以降）の基盤を確立する。

### 変更

- `src/domain/types.ts`: `Id`, `EpochMs`, `EntityOrigin`, `LabelKind`, `ArchiveState`, `ClassificationState`, `FrequentVisitWindow`, `JsonValue`, `JsonDocumentEnvelope`, `ClassificationPolicySnapshot`, `UpdateTagCommand` の共通型を定義。
- `src/domain/errors.ts`: `DomainErrorCode`（全23種）、`DomainError` クラス、UI向け安全メッセージ変換辞書 `SAFE_MESSAGES` / `toSafeMessage()` を定義。
- `src/domain/value-objects/`:
  - `id.ts`: UUID v4 形式検証
  - `url.ts`: `http`/`https` スキーム限定、最大長2048文字、正規化形式
  - `epoch-ms.ts`: 有限整数・非負値検証
  - `revision.ts`: 非負整数検証、`nextRevision` ヘルパー
  - `json-value.ts`: `undefined`, `BigInt`, 循環参照, 非有限数の拒否
  - `cursor.ts`: 文字列・有限整数・深さ1配列のJSON round-trip可能カーソル検証
  - `index.ts`: 公開エクスポート
- `scripts/generate-unicode-data.mjs`: `@unicode/unicode-15.1.0` および Node.js 組み込み ICU（Unicode 15.1.0 対応）を用いて vendored TypeScript テーブルを自動生成するスクリプトを作成・実行。
- `src/domain/normalizer/vendor/`:
  - `white-space.ts`: `White_Space` 二分探索判定
  - `default-ignorable.ts`: `Default_Ignorable_Code_Point` 判定
  - `general-category.ts`: `Cs` (Surrogate) / `Cc` (Control) 判定
  - `nfkc.ts`: 5914件の NFKD 展開テーブル、699ペアの正準合成テーブル、Non-starter 集合
  - `case-folding.ts`: 1530件の CaseFolding status C+F マッピング
  - `asset-sha256.ts`: `UNICODE_DATA_ASSET_SHA256` 定数
- `src/domain/normalizer/label-normalizer.ts`: DB-SCHEMA.md 仕様に準拠した6段階正規化処理（Cs/DI 拒否 → NFKC → White_Space collapse/trim → Cc/Cs/DI 拒否 → CaseFold C+F → 最終検証）を実装。
- `src/domain/label.ts`: `LabelRecord` 型、CATEGORY（`origin=USER`, `parentCategoryId=null`, `categoryUniqueName=normalizedName`）/ TAG（active 親必須, `tagUniqueName=normalizedName`）不変条件、同名競合チェック、親変更コマンド検証、物理GCブロック確認。
- `src/domain/bookmark.ts`: `ActiveBookmarkRecord` / `ArchivedBookmarkRecord` 型、Category 直接更新拒否、Archived payload 最小性検証。
- `src/domain/bookmark-label.ts`: `BookmarkLabelRecord` 型、confidence 検証（AI 割当時 0〜1、それ以外 null）、Category edge 直接操作拒否、重複防止。
- `src/domain/classification-job.ts`: `ClassificationJobRecord` 型、5種の固定 policy snapshot 組み合わせ検証（0/0, 1/1, 2/2, 3/4, 4/6）、状態遷移検証。
- `src/domain/local-settings.ts`: `LocalSettings` 型、バリデーター、migration 関数（旧 `frequentVisitThreshold` 回数は日数へ暗黙変換せず null にリセット、archive 既定 30、context menu 欠損 true / 不正値 false 縮退、AI 細分化 0〜4 縮退）。
- `src/domain/schema-meta.ts`: `SchemaMetaRecord` 型、`unicodeDataAssetSha256` 整合性検証。
- `src/domain/ai-boundary.ts`: AI 出力外形スキーマ解析 `parseAiClassificationResult()`、Category 作成禁止検証、候補外 Label ID 拒否検証。
- `src/domain/index.ts`: Domain 層の公開 API 一元エクスポート。
- `src/domain/**/*.test.ts`: 単体テスト 89 件を作成。

### 検証

- `pnpm typecheck`: 成功（エラー 0 件）。
- `pnpm test`: 成功。全 22 テストファイル / 173 テストすべて pass（既存 UI テスト 84 件 + 新規 Domain テスト 89 件）。
  - `src/domain/normalizer/label-normalizer.test.ts` (18 tests)
  - `src/domain/label.test.ts` (21 tests)
  - `src/domain/classification-job.test.ts` (20 tests)
  - `src/domain/local-settings.test.ts` (18 tests)
  - `src/domain/value-objects/url.test.ts` (12 tests)

### 残課題

- BE-02 (IndexedDB と Repository 実装): Domain 型・不変条件を利用して IndexedDB schema、ストア、インデックス、トランザクション境界、Repository を実装する。

## 2026-08-22 — TASK-007 Prompt API Host Spike - 初回実機テスト

### 目的

Chrome Prompt API（Gemini Nano）の対応条件を実機で検証し、ISSUE-001 の要件を確認する。Dashboard top-level page で LanguageModel.availability()・create()・prompt() をテストし、対応環境、最低 Chrome バージョン、日本語対応、構造化出力を記録する。

### 変更

- `src/ui/app/PromptApiTester.tsx` を新規作成。Availability チェック、日本語分類テスト、環境情報表示機能を実装した。
- `src/ui/app/ExtensionApp.tsx` の settings セクション（一般設定）に PromptApiTester を統合。
- Chrome Prompt API の型定義を追加し、`window.LanguageModel` にアクセスする型安全なインターフェースを定義した。
- `docs/TASK-007-spike-impl.md`、`docs/TASK-007-test-manual.md` を作成し、実装詳細とテスト手順を記録した。

### 検証・実機テスト結果

**環境:**

- Chrome バージョン: 151.0.7922.172（公式ビルド、64 ビット）
- OS: Windows 11 Version 25H2（Build 26200.9168）
- デバイス: デスクトップ

**テスト実行:**

- `pnpm build`: 成功。`build/chrome-mv3-prod/` へ拡張機能が生成された。
- Chrome 拡張読み込み: 成功。`chrome://extensions` で拡張機能を読み込みした。
- PromptApiTester UI 起動: 成功。Dashboard > Settings > 一般 でテスターが表示された。
- Availability チェック: **失敗**。以下のエラーが発生：
  ```
  エラー: Availability check failed: Failed to execute 'availability' on 'LanguageModel':
  Failed to read the 'expectedInputs' property from 'LanguageModelCreateCoreOptions':
  The provided value is not of type 'LanguageModelExpected'.
  ```

**原因分析:**

- `expectedInputs: ["text"]` の形式が正しくない。Chrome Prompt API v151 では異なる型定義が必要。
- 公式ドキュメント再確認が必要。

**暫定結論:**

- LanguageModel は環境で利用可能（エラーが出ているため、定義とアクセスは成功）。
- 型引数の形式修正が必須。
- Chrome 151 での Prompt API 対応は確認（実装側の型定義の問題）。

### 次のステップ

1. Chrome Prompt API v151 の公式仕様を再確認。
2. `expectedInputs` / `expectedOutputs` の正しい型を特定。
3. PromptApiTester.tsx を修正。
4. 再度実機テスト実行。

### 残課題

- Availability / モデル準備 / 日本語分類テストの実行。
- 最低 Chrome バージョン確認。
- AI 非対応時のエラーハンドリング検証。

## 2026-08-22 — TASK-007 型定義修正と再テスト

### 目的

Chrome Prompt API v151 での型定義エラーを修正し、Availability チェックが正常に動作することを確認する。

### 変更

- `src/ui/app/PromptApiTester.tsx` の型定義を修正。
  - 旧: `expectedInputs: string[]` / `expectedOutputs: string[]`
  - 新: `expectedInputs: {type: string}[]` / `expectedOutputs: {type: string}[]`
- Chrome v151 での LanguageModelOptions インターフェースを `{type: string}[]` 形式に更新。

### 検証・再テスト結果

**環境:**

- Chrome バージョン: 151.0.7922.172（公式ビルド、64 ビット）
- OS: Windows 11 Version 25H2（Build 26200.9168）
- デバイス: デスクトップ

**テスト実行:**

- `pnpm build`: 成功。
- 型チェック: 成功（エラー0件）。
- 拡張機能再度読み込み: 成功。
- Availability チェック実行: **成功** ✓
  - **状態: `downloadable`**（青で表示）
  - Gemini Nano モデルがダウンロード可能な状態

**結論:**

- Chrome v151 での型定義修正成功。
- Prompt API は対応環境で利用可能（Gemini Nano 候補確認）。
- モデルはダウンロード可能だが、まだインストールされていない。

### 次のステップ

1. **モデル取得** - ユーザー操作でモデルをダウンロード（数GB になる可能性）
   - Availability が `downloading` → `available` に遷移することを確認
2. **日本語分類テスト** - モデル準備完了後に実行
3. **構造化 JSON 出力確認** - プロンプト応答形式を確認
4. 最終結果を ISSUE-001 に記録

### 残課題

- モデルダウンロード完了待機（`downloadable` → `downloading` → `available`）。
- 日本語分類テストの実行。
- モデル取得に要する時間と容量の確認。

## 2026-08-22 — TASK-007 モデル取得後の日本語分類テスト

### 検証・実機テスト結果

- Chrome バージョン: 151.0.7922.172（公式ビルド、64 ビット）
- OS: Windows 11 Version 25H2（Build 26200.9168）
- モデル取得後の分類テスト: **成功**
- 日本語プロンプト入力: 成功
- 日本語分類結果: 成功
- 構造化 JSON 形式の応答: 成功

実機で以下の応答を確認した。

```json
{
  "category": "開発・技術",
  "tags": ["React", "JavaScript", "Web開発", "フレームワーク"],
  "confidence": 0.95
}
```

### 結論

- Chrome 151、Windows 11 の Dashboard top-level extension page で、モデル取得後に日本語分類と JSON 形式の応答を確認できた。
- Prompt API は実機環境で正常に実行できた。
- `confidence` やカテゴリ・タグ名はAI出力であるため、実装時はDomain境界で検証し、候補外IDや不正値をそのまま適用しない。

### 残課題

- `downloadable` から `available` までのモデル取得状態遷移、取得時間、容量は未記録。
- Chrome 151 は検証できた環境であり、最低対応Chrome版は未確定。
- 非対応環境、モデル取得失敗、セッション終了時のfallback検証。

## 2026-08-22 — UI-03 popup・shortcut・保存状態

### 目的

`FRONTEND.md`のUI-03に従い、production popupを保存／ホームの2操作、現在のshortcut、Chrome管理画面への案内、保存中／成功／重複／失敗状態を持つ画面へ更新する。

### 変更

- `PopupApp`／`PopupView`と`PopupPort`を追加し、画面からChrome APIを分離した。
- Chrome adapterでallowlist済み2 commandのshortcut取得、現在ページ保存message、`#/home`表示、`chrome://extensions/shortcuts`表示を実装した。
- popupを開いただけでは保存せず、保存結果をpopup内のlive regionへ残すようにした。
- productionと同じ`PopupView`を使い、割当済み／未割当、保存中／成功／重複／失敗、shortcut取得失敗を切り替えるWeb fixtureを追加した。
- popup本体の外周を3pxのink線と8px角丸に変更し、Web fixture側の重複する外枠を削除した。
- `chrome.action.openPopup()`で実action popupを確認すると、透明化したHTML背景はChromeのnative popup surfaceで白へ合成された。このため透明化を撤回し、popup専用CSSで2pxの均一な白余白を設け、その内側へ角丸枠を配置して角だけがはみ出して見えない構成へ変更した。
- 320px相当でも操作名とshortcutが重ならないよう、操作button内を縦配置にした。

### 検証

- デザイン正本SHA-256: `Bookmation.svg` は `d05997589696ff346f59f3850bfc3296bd5b6acbd3e518980421ff6e0533ea8b`、`Bookmation_component.svg` は `f6c44b21deea9893c01f1f08c8b8556d1479b05f336dfb6cd70bd1ba0cce8f89`。
- `pnpm test`: 30 files／216 tests成功。
- `pnpm typecheck`: 成功。
- UI-03変更対象のESLint: 成功。
- `pnpm ui:build`: 成功。
- `pnpm build`: 成功。
- Web fixture: Chromiumで通常幅と320px幅を確認し、320pxで見つかった右端切れとbutton内の重なりを修正後、再確認した。
- build済み拡張: 隔離したheadless Chromiumへ読み込み、`chrome-extension://eniieiddckicpmlijkhkglklehlgmpjd/popup.html`とService Worker targetの起動、未割当表示、表示欠けがないことを確認した。
- 角丸外側: build済み拡張の`chrome.action.openPopup()`で、透明化CSSが実action popupへ適用されてもChromeのnative surfaceで白へ合成されることを確認した。HTMLからnative window形状は変更できないため、2pxの均一な白余白を持つinset枠へ切り替えた。
- `pnpm lint`: 失敗。今回未変更のUnicode生成script、Domain import、Normalizer testに既存27件のerrorがあり、UI-03変更対象にはerrorなし。

### 残課題

- 現行Service Workerの保存Applicationは`ACTION_NOT_AVAILABLE`を返すため、実Bookmark保存、重複判定、command保存はTASK-004で接続する。
- repository管理されたPlaywright拡張E2E、toolbarから開いた実popupの自動操作、人間による実Chrome受入は未実施。
- 全体Lintの既存27件を別作業で解消する。

## 2026-08-22 — BE-07 Prompt API Host Spikeの要件補完

### 変更

- `PromptApiTester` の `expectedInputs` / `expectedOutputs` に日本語 `languages` を指定し、availability と create で同じオプションを使うようにした。
- `prompt()` の `responseConstraint` にカテゴリ・タグ・信頼度のJSON Schemaを渡すようにした。
- `create({ monitor })` の `downloadprogress` を準備状態へ反映し、`downloadable` からユーザー操作でモデル取得を開始できるようにした。
- `session.destroy()` を成功・失敗時に実行し、非対応、モデル準備、モデル取得失敗、セッション終了、構造化出力不正をApplication errorコードへ変換した。
- 既存の `ai-host` 用 `CLAIM_CLASSIFICATION_JOB` / `APPLY_CLASSIFICATION_RESULT` メッセージ契約を、Service Workerとのメッセージング境界として確認した。
- BE-07、ISSUE-001、設計文書、スパイク文書へ実機確認済み項目と残課題を反映した。

### 検証

- 変更対象の `get_errors`: エラーなし。
- 変更対象のESLint: 成功。
- `git diff --check`: 成功。
- `pnpm typecheck`: 失敗。今回未変更のIndexedDB実装で `idb` モジュール未解決、および既存の暗黙 `any` が発生。PromptApiTester / ExtensionAppにはエラーなし。
- `pnpm build`: 失敗。上記と同じく既存IndexedDB実装の `idb` 解決失敗で停止。
- 公式Prompt APIドキュメント（2026-05-19更新）を再確認し、`languages`、`responseConstraint`、`downloadprogress`、`destroy()`、Web Worker非対応を実装へ反映した。

### 残課題

- ISSUE-001の最低Chrome版を確定する。
- モデル取得の実測時間・容量、非対応／取得失敗／セッション終了時のBE-04/BE-05 fallbackを実機で確認する。
- `idb`依存解決と既存IndexedDB型エラーは別タスクで修正する。

## 2026-08-22 — UI-04 Bookmark LIST／GRID・一覧toolbar・cursor追加読込

### 目的

`FRONTEND.md`のUI-04に従い、最近追加とカテゴリ／タグ条件のBookmark一覧を、productionデータ境界を持つLIST／GRID画面として実装する。Bookmark編集、keyword検索、AI応答は後続UIへ分離する。

### 変更

- `BookmarkListPage`と`BookmarkListPort`を追加し、最近追加、カテゴリ条件、タグ条件を同じ画面へ統合した。
- カテゴリとタグの複合条件を型付きrouteとPortへ追加し、両方に一致するBookmarkだけを返す積集合検索を実装した。絞り込みリボンはhover／focus時に反転・減光して中央へ解除ボタンを表示し、片方の解除は単独条件、最後の解除はホームへ遷移する。
- IndexedDB adapterでactive Bookmarkとactive Label edgeを`savedAt desc`のcursor pageへ変換し、カテゴリ／タグを表示用データへhydrateした。LIST／GRID設定は検証後に`chrome.storage.local`へ保存する。
- Figma snapshotを基準に、App Header直下へ通常配置するsecondary toolbar、現在位置、読込済み／全件数、Radix `RadioGroup`のLIST／GRID切替を実装した。toolbarは画面scrollへ追従させず、カテゴリ・タグ一覧への導線はApp Headerの望遠鏡だけとして重複buttonを削除した。
- responsiveな1／2／3列GRIDと密なLIST row、全項目の編集button、カテゴリ常時表示、Radix `Collapsible`とTooltipを使うタグ開閉、画像／favicon fallbackを追加した。
- GRIDの編集buttonとグレーマスクはサムネイルhover／focus時だけ表示し、サムネイルとタイトルの両方を同じ外部URLへのリンクにした。カテゴリリボン型の小ラベルは左端を直角にした。
- 初回loading／空／失敗、cursor追加loading／失敗再試行／終端、requestId照合、同cursor多重要求防止、ID重複除去、stale response破棄、IntersectionObserver sentinel、追加件数と終端のlive通知、トップへ戻るとheading focusを実装した。
- 設定画面は解像度にかかわらずカテゴリ一覧・区切り線・説明の3列配置を維持し、カテゴリ一覧を右へ寄せた。一般／アーカイブ／共有には16pxの意味別iconを追加し、文字との間隔を12pxにした。
- productionの`ExtensionApp`とtabs entryへadapterを接続し、Web previewへ`grid`／`list`／`empty`／`single`／`many`／`loading`／`initial-error`／`page-error`の版管理fixtureを追加した。
- Radix `RadioGroup`／`Collapsible` wrapper、共通control radius token、adapter／一覧component／fixtureのテストを追加した。

### 検証

- 見た目の基準: オンラインFigma node `66:830`の再取得はStarter planのMCP呼出上限で失敗したため、repository内の`Bookmation.svg`（SHA-256 `d05997589696ff346f59f3850bfc3296bd5b6acbd3e518980421ff6e0533ea8b`）と`Bookmation_component.svg`（SHA-256 `f6c44b21deea9893c01f1f08c8b8556d1479b05f336dfb6cd70bd1ba0cce8f89`）を使用した。
- `pnpm test`: 39 files／248 tests成功。
- `pnpm typecheck`: 成功。
- UI-04変更対象のESLint: 成功。
- `pnpm ui:build`: 成功。
- `pnpm build`: 成功。
- `git diff --check`: 成功。
- Web fixture: ChromiumでGRID 1440 px、LIST 1440 px、狭幅320 pxを確認した。GRID 3列、LIST row、通常flowのtoolbar、狭幅1列とcontrol折返しを確認した。
- `pnpm lint`: 失敗。今回未変更のUnicode生成script、Domain import、Normalizer test、schema-metaに既存27件のerrorがあり、UI-04変更対象にはerrorなし。

### 残課題

- Bookmark編集／Tag作成side view／削除はUI-05で実装済みである。
- toolbarのkeyword検索候補／結果はUI-07、AI応答はUI-08で実装する。
- IndexedDBに保存したthumbnail／favicon Blobの画面用URL解決はTASK-010へ残し、現時点のproduction一覧は同梱ロゴ／iconへ縮退する。
- repository管理されたPlaywright拡張E2Eと人間による実Chrome受入は未実施である。
- 実装はbase commit `e770827`上の未commit差分であり、commit／pushは未実施である。

## 2026-08-23 — UI-05 Bookmark追加／編集Tag field・同一Dialog side view

### 目的

UI-04の全Bookmark編集buttonとApp Headerの追加buttonを、追加／編集で共通のTag field、Tag／Category作成side view、確認なしのBookmark論理削除へ接続する。

### 変更

- `BookmarkDialog`を`FORM | CREATE_TAG | CREATE_CATEGORY`のstep state machineとして追加し、Radix Dialogを重ねずにBookmark draft、Tag検索語、作成draftを保持するようにした。
- `BookmarkTagField`へ親Category名付き最大8件候補、正規化完全一致、IME変換中を除くEnter、1件ずつの追加、重複防止、入力clear／focus復帰、初期展開Tag chipと個別解除、TagからのCategory読取表示を実装した。
- Tag作成からCategory作成へ進み、新Categoryを自動選択してTag作成へ戻すside viewを実装した。作成済みTagは解決済み候補へ戻し、利用者が`追加`／EnterするまでBookmark draftへ確定しない。
- `BookmarkFormPort`とChrome adapterを追加し、候補検索、Category／Tag作成、Bookmark保存／更新／論理削除を既存message／Application／IndexedDBへ接続した。同じ作成draftのretryではrequest IDを再利用し、安全なDomain error codeをUI文言へ変換する。
- Dashboard URL保存で0件以上の明示Tag IDを受け取り、Bookmark、Tag／自動導出Category edge、初期分類Jobを同じIndexedDB transactionへ保存してからmetadata取得を始めるようにした。
- UI-04一覧itemへBookmark revisionとTagの親Category情報をhydrateし、編集modalの初期draftへ渡すようにした。
- Web fixtureを可変のUI-05 Portへ更新し、追加／編集／Tag・Category作成／削除後の一覧再読込をproduction componentで確認できるようにした。
- 通常画面とカテゴリ・タグ一覧のヘッダー末尾操作を同じ右余白へ揃え、折返し時も右寄せを維持するようにした。トップへ戻る操作は共通`IconButton`へ置き換え、閉じる操作と同じ85×50 pxのピル型に統一した。
- 共通Button／IconButton、Select、候補、表示形式、開閉操作、選択済みTagを、hover中と選択／open継続中のどちらも黒背景・白文字へ統一した。カテゴリ・タグ一覧の管理Toggleと設定カテゴリ一覧は指定どおり既存のhover／選択表現を維持した。

### 検証

- 最新`origin/main`へrebase後の`pnpm typecheck`: 成功。
- 最新`origin/main`へrebase後の`pnpm test`: 55 files／332 tests成功。
- UI-05変更対象のESLint: 成功。
- `pnpm ui:build`: 成功。
- `pnpm build`: 成功、Chrome MV3向けPlasmo production build。
- `git diff --check`: 成功。
- `pnpm lint`: 失敗。今回未変更のUnicode生成script、Domain import、Normalizer test、schema-meta、security正規表現に既存29件のerrorがあり、UI-05変更対象にはerrorなし。
- Web fixture: 最終差分をChromiumで開き、追加modalを1440×1000 pxと320×900 px、編集modalとTag／Category side viewを1440×1000 pxで確認した。横overflowはなく、狭幅modalはviewport内でscroll可能な高さに収まった。追加時はURLへ初期focusし、Tag side viewから戻るとTag入力へfocusが復元され、確認経路のconsole error／runtime exceptionは0件だった。
- Web fixture: Chromiumの1440／768／320 px幅で通常画面とカテゴリ・タグ一覧のヘッダー右余白差がすべて0 pxであることを計測した。トップへ戻る操作と閉じる操作はいずれも85×50 pxだった。
- `pnpm exec vitest run src/ui preview`: 24 files／117 tests成功。highlight共通契約、表示形式選択、Tag開閉、候補選択、管理Toggle／設定カテゴリ一覧の例外を含む。
- Chromium Web fixture: 検索、IconButton、閉じる、Select、表示形式、Tag開閉のhover／継続状態が`#1e1e1e`／`#ffffff`、管理Toggleのhoverが`#ffffff`／`#1e1e1e`、設定カテゴリ一覧のhover背景が`#b9d4ea`であることを算出styleで確認した。
- highlight変更対象のESLint、Prettier、`git diff --check`、`pnpm ui:build`、`pnpm build`: 成功。
- 最新`origin/main`の分類Job／字句検索APIとUI-05の親Category付き候補を統合し、競合解消後も型検査、全test、変更対象ESLint、UI／拡張buildが成功した。

### 残課題

- repository管理されたPlaywright拡張E2E、build済みChrome拡張でのmessage／IndexedDB永続化確認、人間による実Chrome受入は未実施である。
- keyword検索候補／結果はUI-07、AI応答はUI-08で実装する。

## 2026-08-23 — UI-06 Labels VIEW／MANAGE

### 変更

- `LabelsPage`と`LabelManagementPort`を追加し、Category ribbonと子Tag chipを同じDOM順で表示した。
- VIEWではBookmark絞込みへ遷移し、MANAGEではhover／focus鉛筆からTag編集またはCategory影響previewを開くようにした。
- headerのNew menuをCategory／Tagの連続作成へ接続し、Tagの名前／親Category変更、即時soft-delete、Category cascade削除を既存Applicationへ接続した。
- 空keywordのlabel queryをactive全件取得として扱い、Web fixtureでもproduction componentを表示した。

### 検証

- `pnpm typecheck`: 成功。
- `pnpm test`: 58 files／340 tests成功。
- UI-06変更対象ESLint、`git diff --check`: 成功。
- `pnpm ui:build`、`pnpm build`: 成功。

### 残課題

- keyword combobox／全画面検索はUI-07、AI assistantはUI-08で接続する。
- labelsのcursor追加読込／back-to-topはデータ量計測後のfollow-upとし、現時点はactive Label全件を1回で取得する。
- build済み拡張のPlaywright E2Eと人間による実Chrome受入は未実施である。

## 2026-08-23 — UI-07 共通keyword候補と全画面検索

### 目的

Bookmark一覧とカテゴリ・タグ一覧の検索入口を、同じ候補操作と全画面結果へ接続する。

### 変更

- 共通`SearchBox`へ200 ms debounce、IME composition guard、古い応答の破棄、全種類合計最大8件、Label優先group、Arrow／Enter／Escape／pointer操作と`aria-activedescendant`を実装した。
- Enterまたは検索buttonから型付き`search` routeへ移り、カテゴリ／タグを上、Bookmarkを下に表示する`SearchResultsPage`を追加した。Label候補／結果は既存のBookmark filterへ遷移する。
- `SearchPort`とChrome adapterを追加し、既存`search-library` messageの`SUGGEST`／`SEARCH`へ接続した。応答request IDと構造をadapter境界で検証する。
- App Shell Web previewへfake検索候補と検索結果を追加した。

### 検証

- `pnpm typecheck`: 成功。
- 検索component／adapter／App Shell対象test: 成功。
- `pnpm test`: 65 files／366 tests成功。
- UI-07変更対象のESLint: 成功。
- `pnpm ui:build`、`pnpm build`: 成功。
- `git diff --check`: 成功。

### 残課題

- 現行backendの字句検索は1応答最大8件でcursorを返さない。全画面結果の追加読込はbackend pagination契約と合わせて実装する。
- AI popup、自然言語検索、機能案内、AI unavailable時の応答はUI-08で実装する。
- repository管理された実拡張E2Eと人間による実Chrome受入は未実施である。

## 2026-08-23 — UI-08 AIアシスタントpopup

### 目的

Bookmark一覧とカテゴリ・タグ一覧の画面上で、自然言語検索とBookmationの機能案内を完結させる。

### 変更

- desktop右下の非modal panelと狭幅full-height dialogを同じ`AiAgentPopup` stateで実装し、入力、処理中、応答生成中、回答、候補、再試行、reset、closeを同一面へ配置した。
- `AiAssistantPort`とbrowser adapterを追加し、トップレベル画面でのみPrompt APIによるcanonical intent分類と検索語展開を行うようにした。会話、query、回答は永続化しない。
- Prompt API利用不可／準備中／不正応答では、検索を既存`search-library` message、機能説明を版付きCapability Catalogへ縮退する。AI不可と候補0件を別表示にした。
- 検索候補はService Workerの現行recordだけを受け入れ、カテゴリ／タグを上、Bookmarkを下に中立順で表示する。rank、score、best表現とmutation commandは持たない。
- App Shellへfake AI Portを追加し、production entryへbrowser adapterを接続した。

### 検証

- `pnpm typecheck`: 成功。
- AI popup／adapter／App Shell対象test: 成功。
- `pnpm test`: 67 files／373 tests成功。
- UI-08変更対象のESLint: 成功。
- `pnpm ui:build`、`pnpm build`: 成功。
- `git diff --check`: 成功。

### 残課題

- AIへ提示済み候補からID集合を選ばせ、Service Workerで再検証する二段階backend契約は未接続である。現時点はモデルへ候補IDを渡さず、trustedな字句検索候補をそのまま表示する。
- repository管理された実拡張E2E、実Prompt APIモデル、人間による実Chrome受入は未実施である。

## 2026-08-23 — UI-09 Welcome／Category template再開と明示適用

### 目的

install時だけwelcomeを開き、Category templateの選択を途中再開し、明示保存後だけ通常のCategory／Tagを作成する。

### 変更

- `reason=INSTALL`の初回だけinstall stateとonboarding stateを同時に初期化し、update、通常起動、同じinstall signalの再送ではwelcomeを開かない既存境界を維持した。
- welcome開始、Category step、選択draft、apply request ID、完了を`chrome.storage.local`へ保存し、未完了状態でホームを開いた場合はwelcomeまたはCategory stepへreplace遷移するようにした。
- 既存のaccordion内checkboxへ初期選択復元と変更通知、保存中、失敗、再試行を追加した。catalog閲覧だけではLabelを作らない。
- `OnboardingPort`とChrome adapterを追加し、明示保存されたCategoryとTagだけを既存`BookmarkFormPort`の通常作成use caseへ渡した。部分失敗のretryでは保存済みapply request IDを再利用する。
- 既存同名Category／Tagは再利用し、別親に同名Tagがある場合は自動移動せずdraftを保持してエラーにする。完了後だけonboarding selectionを消して最近追加ホームへ移る。
- App Shell Web previewへonboarding fake Portを追加した。

### 検証

- `pnpm typecheck`: 成功。
- onboarding state／install／adapter／component／App Shell対象test: 成功。
- `pnpm test`: 69 files／380 tests成功。
- UI-09変更対象のESLint: 成功。
- `pnpm ui:build`、`pnpm build`: 成功。
- `git diff --check`: 成功。

### 残課題

- ISSUE-022の初回後の再表示、名前編集、locale追加、catalog更新／再適用の詳細UXは未決であり実装していない。
- repository管理された実拡張E2E、build済み拡張のinstall event、人間による実Chrome受入は未実施である。

## 2026-08-23 — UI-11 reminder／import／共有dialog

### 目的

訪問候補への回答、Chrome標準Bookmark取込、QR／CSV／Drive共有を、利用者操作から開始する独立dialogとして実装する。

### 変更

- `VisitReminder`を追加し、タイトル、URL、期間内訪問日数、はい／いいえ、URL単位の`次回から表示しない`を表示した。保存／dismiss commandが成功するまでdialogを保持し、`いいえ`のresetとsuppressionをPort入力で区別した。
- `ChromeBookmarkImportDialog`を追加し、開始操作後だけpreviewを取得する。Bookmarkを直上Folderでgroup化し、既存Tag再利用、新規Tagの親Category必須、Category作成、invalid groupのskip、取込結果を扱う。祖先pathは出所表示だけにした。
- `ShareWorkflowPanel`を追加し、Category／Tag／Bookmark選択をBookmark ID集合へ展開してdedupeした。QR／CSVの固定選択、QR容量超過後のCSV誘導、カメラ拒否時の画像fallback、不正payload、重複付きpreview、取込結果を別状態にした。
- Drive dialogで同一accountの`appDataFolder`同期と別accountの通常共有fileを別操作にし、接続状態、権限不足、競合、ローカル／Drive選択を表示した。
- App Shellへ各Portを注入し、共有設定ルートと`fixture=reminder`でproduction componentの状態を確認できるWeb fixtureを追加した。権限要求はrender時に実行しない。

### 検証

- `pnpm typecheck`: 成功。
- `pnpm test`: 72 files／386 tests成功。
- UI-11変更対象のESLint: 成功。
- `pnpm ui:build`、`pnpm build`: 成功。Web buildには既知のchunk size警告がある。
- `git diff --check`: 成功。

### 残課題

- TASK-101、TASK-103、TASK-104、TASK-105のApplication／Repository／Chrome権限adapterは未着手であり、production entryは空Portを使う。Web fixtureとcomponent testではdialog状態とPort契約だけを検証した。
- repository管理された実拡張E2E、camera／bookmarks／Driveの実権限、人間による実Chrome受入は未実施である。

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
