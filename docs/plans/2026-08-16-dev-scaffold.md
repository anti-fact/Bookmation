# 同じ手順で開発を始め、URL保存まで縦に通す

- 状態: 進行中
- 作成日: 2026-08-16
- 最終更新: 2026-08-16 22:05 JST
- 担当: T-taku
- 関連: [要件](../REQUIREMENTS.md) / [設計](../DESIGN.md) / [TASK-001](https://github.com/anti-fact/Bookmation/issues/3) / [ISSUE-006](https://github.com/anti-fact/Bookmation/issues/4) / [ISSUE-007](https://github.com/anti-fact/Bookmation/issues/5)

## 目的と利用者への価値

新しい担当者が同じ Node / pnpm / 品質コマンドで拡張機能の開発ビルドを生成でき、Chrome に読み込んで空の popup を開ける。後続の TASK-002 以降で、popup から現在ページまたは URL を専用ストアへ保存し、再読込後も一覧に残る状態へ進む。

## 現在地

- 存在する: プロダクト文書、`デザインシート.svg`、GitHub Issues / Milestone。
- 存在しない（本Plan開始時）: `package.json`、lockfile、ソース、品質コマンド、実行可能な拡張機能。
- 確認済み: UIスタックは Plasmo + React + Tailwind、言語は TypeScript、P0権限候補は `storage` と `activeTab`。Prompt API は Service Worker で実行しない。
- 未決のまま進める: ハッカソン締切・審査基準・デモ端末（[ISSUE-007](../ISSUES.md)）。本Planの完了はツールチェーン固定と縦切り受け入れであり、締切日付は追記する。

ソース配置:

| パス | 役割 |
| --- | --- |
| `src/popup.tsx` | Plasmo popup。TASK-001 では確認用画面のみ。`src/` がある場合は entry をすべてここに置く |
| `src/ui/tokens.ts` | デザインシートから抽出した色・半径・min-width |
| `src/domain` / `application` / `ports` / `adapters` | バックエンド層の置き場所。実装は TASK-003 以降 |
| `tabs/` / `background.ts` | 未作成。TASK-002 で追加する |

## 対象範囲

- 対象: Node / pnpm / Plasmo / React / Tailwind / TypeScript の固定、品質スクリプト、最初の Execution Plan、デザイン token の抽出、空テストと開発ビルド。
- 対象外: popup の2ボタンと commands（TASK-002）、IndexedDB（TASK-003）、保存 use case（TASK-004）、Prompt API スパイク（TASK-007）、P1機能。

## 前提・用語

- package manager は pnpm。Plasmo が強く推奨し、lockfile は `pnpm-lock.yaml` を正本にする。
- Node.js は 20.11 以上 25 未満。推奨は `.nvmrc` の 22。
- Tailwind は v3。Plasmo 公式 quickstart が v3 + PostCSS を前提にしている（確認日: 2026-08-16、[with-tailwindcss](https://docs.plasmo.com/quickstarts/with-tailwindcss)）。
- Plasmo 0.90.5（npm latest、2025-05-17 公開を 2026-08-16 に確認）。
- React 18.3.1。Plasmo 公式例が React 18 であり、React 19 は未検証のため使わない。
- TypeScript 5.9.2。
- 利用者向け用語はカテゴリ／タグ。内部総称だけ `Label` を使う。
- 確認日のないハッカソン日程は事実として書かない。

## 実装方針

1. ルートに Plasmo プロジェクトを置き、popup だけを最初の entry にする。dashboard と Service Worker は TASK-002。
2. Manifest の初期権限は `storage` と `activeTab` だけにする。公式 Tailwind 例の `host_permissions: https://*/*` は採用しない。
3. Tailwind の `prefix: plasmo-` は使わない。P0 は content script UI を持たず、通常クラスの方が画面実装に合う。CSUI を足す場合は再検討する。
4. Domain は標準 TypeScript のみに依存する。UI と Chrome API を Domain へ持ち込まない。
5. `デザインシート.svg` は改変しない。抽出 token を `src/ui/tokens.ts` と `tailwind.config.js` へコピーする。
6. 品質コマンドは `dev` / `build` / `lint` / `typecheck` / `test` に固定する。CI は TASK-011。

### デザイン token（2026-08-16 抽出）

SVG を改変せず、`fill` 出現から次を採用した。

| token | 値 | 根拠 |
| --- | --- | --- |
| `canvas` | `#161616` | 最暗面 |
| `surface` | `#1E1E1E` | 主要背景（最多） |
| `muted` | `#505050` | 補助面 |
| `ink` | `#EAEAEA` | 本文 |
| `accent` | `#B9D4EA` | 強調 |
| `danger` | `#C33232` | 警告・削除 |
| `subtle` | `#8A8484` | 二次テキスト |
| `radius.card` | `14.5px` | カード rx の最多 |
| `radius.panel` | `24px` | パネル rx |

asset 方針: ローカル静的ファイルのみ。リモート画像 URL を一覧描画で直接参照しない。favicon / thumbnail の取得方法は ISSUE-002 / TASK-010。SVG 正本はルートの `デザインシート.svg` のままにする。

responsive 方針: デザインシートのデスクトップ構成を基準にする。GRID 列数は利用者設定にせず `repeat(auto-fit, minmax(16rem, 1fr))` を初期案とする。カード最小幅と breakpoint の確定は TASK-005。200% 拡大と狭い幅では sticky header を折り返し、機能を欠落させない。

## マイルストーン

### M1: 同じコマンドで開発ビルドを生成できる

- 成果: 新規 checkout から依存導入、lint、型検査、空テスト、開発ビルドが通る。Chrome で空 popup を開ける。
- 変更箇所: `package.json`、`pnpm-lock.yaml`、`src/`、品質設定、本Plan、QUICKSTART。
- 実行: `corepack enable && corepack prepare pnpm@10.15.1 --activate` のあと `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`
- 期待結果: 各コマンドが成功し、`build/chrome-mv3-prod` が生成される。
- 手動確認: `pnpm dev` の出力ディレクトリを Chrome の「パッケージ化されていない拡張機能を読み込む」で開き、popup に確認用文言が出る。保存ボタンはまだない。

### M2: 現在ページ／URL を専用ストアへ保存し、再読込後も残る

- 成果: TASK-002〜004。popup / shortcut / URL 入力から保存でき、worker 再起動後も Bookmark が残る。
- 変更箇所: popup、commands、dashboard 骨格、IndexedDB、SaveBookmark。
- 実行: 後続 TASK のテストコマンド。
- 期待結果: 3入口が共通 use case を使い、危険 scheme を拒否する。
- 手動確認: 保存後に拡張機能を再読込しても一覧に残る。AI 未実装でも保存できる。

### M3: 最近追加一覧で保存結果を確認できる

- 成果: TASK-005 の必要部分。`savedAt desc` の LIST で保存した項目を見られる。
- 変更箇所: dashboard の Bookmark list。
- 実行: 後続 TASK のテストコマンド。
- 期待結果: 件数と少なくとも LIST が表示される。
- 手動確認: 保存したタイトルまたは URL が一覧に出る。GRID・無限スクロールの完成は TASK-005 本体。

失敗時: 保存途中で worker が止まっても、部分的な Bookmark を黙って公開しない。未保存ならエラーを返し、既存データを消さない。

## 進捗

- [x] 2026-08-16 21:55 JST — TASK-001 / ISSUE-006 としてツールチェーンを固定し scaffold を追加する
- [x] 2026-08-16 22:03 JST — `pnpm lint` / `typecheck` / `test` / `build` が成功。`build/chrome-mv3-prod/popup.html` を確認
- [ ] TASK-002 以降 — popup 2ボタン、データ層、保存縦切り

## 発見事項

- 2026-08-16 — 発見: `package.json` の `engines` があると Plasmo/Parcel が `src/popup.tsx` を解決できず build が失敗する。
  - 証拠: [PlasmoHQ/plasmo#1040](https://github.com/PlasmoHQ/plasmo/issues/1040)、本リポジトリでの `Failed to resolve '../../src/popup.tsx'`。
  - 影響: Node 制約は `.nvmrc` と QUICKSTART に書き、`engines` は置かない。

## 判断ログ

- 2026-08-16 — 判断: pnpm を package manager にする。
  - 理由: Plasmo が強く推奨し、QUICKSTART の候補とも一致する。lockfile は `pnpm-lock.yaml`。
  - 検討した代替案: npm / yarn。npm は Plasmo 非推奨ではないが lockfile と hoisting 差が出やすい。
  - 再検討条件: Plasmo が pnpm 以外を公式標準にした場合。
- 2026-08-16 — 判断: Tailwind v3 を使う。
  - 理由: Plasmo 公式手順が v3 + PostCSS。v4 は未検証。
  - 検討した代替案: Tailwind v4。
  - 再検討条件: Plasmo が v4 を公式例にした場合。
- 2026-08-16 — 判断: React 18 を使う。
  - 理由: Plasmo 0.90 系の公式例が 18.2。React 19 は未検証。
  - 検討した代替案: React 19。
  - 再検討条件: Plasmo 公式例が React 19 に更新され、build が通ることを確認したとき。
- 2026-08-16 — 判断: ISSUE-007（ハッカソン日程）は本Plan完了をブロックしない。
  - 理由: ツールチェーン固定に日程は不要。成功指標は「同じコマンドで開発開始できること」とする。
  - 検討した代替案: 日程確定まで TASK-001 を止める。
  - 再検討条件: 締切が判明したら本Planの「結果と残課題」へ追記する。

## 検証と受け入れ条件

- [x] 自動検証: `pnpm lint` が成功する。
- [x] 自動検証: `pnpm typecheck` が成功する。
- [x] 自動検証: `pnpm test` が成功する（2 tests）。
- [x] 自動検証: `pnpm build` が成功し、`build/chrome-mv3-prod/popup.html` と `storage` / `activeTab` 権限の manifest ができる。
- [ ] 手動検証: `pnpm dev` の出力を Chrome に読み込み、popup に確認用文言が出る。この環境では未実施。
- [x] エラー経路: 本マイルストーンは保存処理を持たない。失敗時も既存文書と SVG を消さない。
- [x] 文書: QUICKSTART、CONSTRAINTS、TASKS、ISSUE-006、本Planが実装と一致する。

## 再実行・復旧

- `pnpm install` は繰り返し実行してよい。lockfile を手編集しない。
- 品質コマンドは破壊的ではない。`build/` と `.plasmo/` は gitignore 済みで、消して再実行できる。
- `デザインシート.svg` は改変しない。
- 依存を足すときは `pnpm add` で lockfile を更新し、本Planの判断ログへ理由を書く。

## 結果と残課題

M1 は自動検証まで完了した。Node は実行環境が v23.5.0、推奨は `.nvmrc` の 22。`package.json` の `engines` は Plasmo/Parcel の解決バグを避けるため置かない。現行の同梱 `assets/icon.png` は正式アイコンではなく、ISSUE-002で定めた取得失敗時ロゴfallbackの実装assetはTASK-010で確定する。Chrome への手動読込み、popup 2ボタン、データ層は TASK-002 以降。ISSUE-007とPrompt API 対応条件は未決のまま残す。
