# QUICKSTART

## 現在できること

2026-08-16 時点で、Plasmo 拡張の開発基盤がある。同じコマンドで依存導入、lint、型検査、テスト、本番ビルドができる。popup は確認用画面のみで、保存・ホーム・dashboard は [TASK-002](TASKS.md) 以降である。

最初の縦切り方針は [Execution Plan](plans/2026-08-16-dev-scaffold.md) を正本とする。

## 文書から参加する最短手順

```bash
git clone https://github.com/anti-fact/Bookmation.git
cd Bookmation
git status --short --branch
```

既に checkout 済みなら clone は不要である。未コミット変更は他のメンバーの作業かもしれないため、削除・reset せず内容を確認する。

次の順で読む。

1. ルートの `AGENTS.md` — 文書への目次。詳細仕様の正本にはしない。
2. [INDEX.md](INDEX.md) — 目的別の文書索引。
3. [REQUIREMENTS.md](REQUIREMENTS.md) と [CONSTRAINTS.md](CONSTRAINTS.md) — 何を作るか、何が制約か。
4. [DESIGN.md](DESIGN.md)、[FRONTEND.md](FRONTEND.md)、[BACKEND.md](BACKEND.md)、[DB-SCHEMA.md](DB-SCHEMA.md) — 実装方針。
5. [SECURITY.md](SECURITY.md) と [UI.md](UI.md) — データ保護と画面挙動。
6. [TESTING.md](TESTING.md) — Webプレビュー、AIエージェントのPlaywright確認、人間受入。
7. [plans/2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md) — 現在の実装 Plan。
8. [TODO.md](TODO.md)、[ISSUES.md](ISSUES.md)、[TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) — 作業候補と既知の課題。

作業を選ぶ前に、文書だけの小規模作業か、Execution Planが必要な作業かを [PLANS.md](PLANS.md) で判定する。実施内容と検証結果は [WORKLOG.md](WORKLOG.md) に追記する。

## 開発コマンド

推奨 Node は 22（`.nvmrc`）。package manager は pnpm 10.15.1（`package.json` の `packageManager`）。Corepack を使う。

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Corepackまたは`pnpm`がPATHにない場合は、固定版を直接実行する。

```bash
npx --yes pnpm@10.15.1 install --frozen-lockfile
npx --yes pnpm@10.15.1 dev
```

品質確認:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

fallbackでは同様に `npx --yes pnpm@10.15.1 lint`、`typecheck`、`test`、`build` を実行する。`npx pnpm` のように版を省略しない。

本番ビルドは `build/chrome-mv3-prod`、開発ビルドは `pnpm dev` が `build/chrome-mv3-dev` へ出す。

`package.json` に `engines` は置かない。Plasmo / Parcel が popup を解決できなくなる既知の不具合がある。

## テスト入口

現在実行できる自動テストは `pnpm test` のVitestである。初回ホーム、フルページ検索、AI入力ポップアップ、カテゴリ・タグ管理、設定、archive、共有を確認するUI WebプレビューとPlaywright拡張機能E2Eは [TASK-013](TASKS.md) で実装するため、次のtarget scriptはまだ存在しない。

```bash
# TASK-013 完了後に利用可能になる目標コマンド
pnpm ui:preview
pnpm ui:build
pnpm test:e2e
pnpm test:e2e:ui
```

受入は、通常WebページでUI fixtureを確認し、AIエージェントがPlaywrightでビルド済み実拡張を確認して証拠を保存し、その後に人間が同じcommit／buildを実Chromeで確認する順とする。WebプレビューだけをChrome E2E成功として扱わない。詳細は [TESTING.md](TESTING.md) を参照する。

## Chrome への読込み

1. `pnpm dev` で開発ビルドを生成する。
2. Chrome で `chrome://extensions` を開く。
3. 「デベロッパー モード」を有効にする。
4. 「パッケージ化されていない拡張機能を読み込む」から `build/chrome-mv3-dev` を選ぶ。
5. 拡張機能アイコンを押し、確認用 popup が出ることを確認する。保存ボタンは TASK-002 まで無い。

Prompt API の初回モデル取得には利用者の操作、対応環境、空き容量、ネットワークが必要になる場合がある。AI が使えない場合もブックマーク保存と手動タグ付けを止めない（保存自体は TASK-004）。切り分けは [TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照する。

## 人間の最小スモークテスト（AIエージェント確認後）

- 拡張機能を再読込しても保存済みブックマークが残る。
- 新規profileの `runtime.onInstalled` `reason=INSTALL` では初回インストール用ホームを表示し、UPDATEや完了後の再訪では初期化し直さず最近追加ホームを表示する。
- 同じ操作を連打しても意図しない重複登録をしない。
- Prompt APIが利用不可でも、URLとタイトルを保存して手動分類できる。
- AIがカテゴリを新規作成せず、既存のユーザー定義カテゴリだけを割り当てる。
- AI細分化スライダーは `0`〜`4` だけを取り、新規AIタグ上限 `0 / 1 / 2 / 4 / 6` に対応する。Jobには両値をdiscriminated snapshotとして保存し、不一致を拒否する。`0` では新規AIタグを作らず既存のユーザー定義タグを自動付与できる。
- カテゴリを親、タグを子として表示・保存する。カテゴリ名はカテゴリ全体、タグ名は親をまたぐタグ全体で重複不可であり、カテゴリ名とタグ名の相互一致だけを許す。Label Normalizer v1はproject-vendored Unicode 15.1.0へ固定し、tombstone中も名前を予約する。active Tagはactive親を必須とし、親Categoryの物理回収は子Tag tombstoneがなくなった後だけ許す。
- ブックマーク編集ではカテゴリ／タグを別入力で変更し、入力候補を最大8件から選べる。説明横の新規作成から同じmodalのside viewへ進み、元の入力を失わない。
- Bookmark／Category／Tag削除は確認画面なしのsoft-deleteとし、削除後のUndo toast、token、期限、復元入口を設けない。アーカイブ一覧からの復元は削除Undoとは別機能として維持する。
- カテゴリ・タグ一覧の新規作成は種類を選択してmodalを開き、閉じるまで連続作成できる。既存IDを選択・関連付ける画面ではなく、有効な同名は元画面で選択し、削除済み同名は物理回収まで別名へ直す。管理モードのhover／focus鉛筆から編集でき、タグの親カテゴリは読取専用である。
- 管理モードのカテゴリ／タグ削除は確認画面を挟まずsoft-deleteする。子タグが残るカテゴリでは「子タグを削除」「中止」だけを案内し、移動やcascade deleteを出さない。
- 両一覧からフルページ検索へ移り、入力中の候補が最大8件に収まる。結果はカテゴリ・タグを上、Bookmarkを下に表示する。
- AI入力ポップアップ内で自然言語検索の入力と結果を確認でき、保存、設定、分類、共有などBookmation全般の質問にも応答できる。AI検索候補は無順位で複数返す。
- リスト／グリッドだけを切り替えられ、カテゴリは常時、タグはキーボードでも展開できる。
- ホームには最近追加が表示され、全画面カテゴリ一覧の選択で対象一覧へ移動できる。
- 両一覧の追従ヘッダー、無限スクロール、件数、トップへ戻る、編集モーダルが動作する。
- 全画面設定では訪問回数とarchive日数だけが正整数の数値入力、AI細分化だけがスライダーであり、リマインダーを有効／無効にできる。
- URL指定保存が `http` / `https` を受け付け、メタデータ取得失敗時もURLを失わない。
- service workerを停止・再起動しても、処理中状態が壊れず再開または安全に失敗する。
- JSON正本がschema検証され、BlobがJSONへ埋め込まれない。
- 訪問閾値到達時は確認前に保存せず、「次回以降表示しない」で対象canonical URLだけをSUPPRESSEDにする。他URLのリマインダーと `frequentVisitReminderEnabled` は維持する。
- 自動archiveは初回開始時にhistory権限の目的を説明する。拒否時は入力日数を保持して「権限待ち」で停止し、notificationsは要求しない。最終訪問日時なしをskipし、カテゴリ・タグ、ページ名、URLだけを保持して設定のリストから復元する。UIにない `autoArchiveEnabled` は前提にしない。
- QR checksumは破損／切詰めだけを検出し、真正性を保証しない。異親同名Tagは既存再利用／親変更せず、別名／skip／cancel後に再previewする。
- Driveは設定で対象アカウントを選び、同一アカウントの `appDataFolder` 同期と、別アカウントの通常Drive file＋permissions/capabilities共有を分ける。同一field、update-delete、add-delete、名前競合を自動LWWせず `syncConflicts` として表示する。
- 標準Bookmark取込、context menu保存がそれぞれの権限・確認境界を守る。
- エクスポートまたはバックアップが実装されるまでは、実データを唯一の保存先として使わない。

## 次に進む場所

- 小さな作業を選ぶ: [TODO.md](TODO.md)
- 初期実装を続ける: [plans/2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md)
- 実装前の問題を確認する: [ISSUES.md](ISSUES.md)
- テストと受入を確認する: [TESTING.md](TESTING.md)
- 設計の暫定箇所を確認する: [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md)
