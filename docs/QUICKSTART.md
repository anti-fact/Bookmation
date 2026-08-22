# QUICKSTART

## 現在できること

2026-08-19 時点で、Plasmo拡張の開発基盤、UI-01のsemantic token／Radix wrapper／通常Webページのcomponent sheet、UI-02のdashboard App Shell／型付き9 route／3種の共通headerがある。同じコマンドで依存導入、lint、型検査、テスト、Webプレビュー、本番ビルドができる。popupは確認用画面のままであり、dashboardの各route本文もshell確認用である。Bookmark保存、一覧データ、検索／AI、カテゴリ・タグ管理、設定等のfeatureは [TASK-002](TASKS.md) 以降で実装する。

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
pnpm ui:build
pnpm build
```

fallbackでは同様に `npx --yes pnpm@10.15.1 lint`、`typecheck`、`test`、`build` を実行する。`npx pnpm` のように版を省略しない。

本番ビルドは `build/chrome-mv3-prod`、開発ビルドは `pnpm dev` が `build/chrome-mv3-dev` へ出す。

`package.json` に `engines` は置かない。Plasmo / Parcel が popup を解決できなくなる既知の不具合がある。

## テスト入口

`pnpm test`はtoken、UI-01 wrapper、UI-02のhash route／App Shell／headerのVitest unit・component testを実行する。`pnpm ui:preview`はViteの通常Webページを開き、root URLのcomponent sheetと `?view=app-shell` のApp Shell fixtureをproduction componentで確認できる。`pnpm ui:build`は同じページを `build/ui-preview` へ静的生成する。

```bash
pnpm ui:preview
pnpm ui:build
```

プレビューの入口は次のとおりである。

- `http://127.0.0.1:4173/` — UI-01 component sheet。
- `http://127.0.0.1:4173/?view=app-shell#/home` — UI-02 App Shell。hashは `#/welcome`、`#/home`、`#/bookmarks?category=<id>`、`#/bookmarks?tag=<id>`、`#/search?q=<query>`、`#/labels`、`#/settings/general`、`#/settings/archive`、`#/settings/share` に差し替えられる。

App Shell fixtureはroute、共通header、layout、focus／scroll復元、error fallbackの確認用である。初回ホームの機能、Bookmark一覧データ、フルページ検索、AI入力ポップアップ、カテゴリ・タグ管理、設定、archive、共有のfeature fixtureはまだない。`pnpm test:e2e` と `pnpm test:e2e:ui` のscriptも現時点では存在せず、Playwright拡張機能E2Eと人間による実Chrome受入は未完了である。

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
- 初回ホームでCategory template機能へ進める。catalogを表示しただけではCategoryは増えず、利用者が適用したものだけが通常のCategoryとして作成される。具体的な候補と選択UIはISSUE-022の決定後に確認項目を固定する。
- 同じ操作を連打しても意図しない重複登録をしない。
- Prompt APIが利用不可でも、URLとタイトルを保存して手動分類できる。
- AIがカテゴリを新規作成せず、既存のユーザー定義カテゴリだけを割り当てる。
- AI細分化スライダーは `0`〜`4` だけを取り、新規AIタグ上限 `0 / 1 / 2 / 4 / 6` に対応する。Jobには両値をdiscriminated snapshotとして保存し、不一致を拒否する。`0` では新規AIタグを作らず既存のユーザー定義タグを自動付与できる。
- カテゴリを親、タグを子として表示・保存する。カテゴリ名はカテゴリ全体、タグ名は親をまたぐタグ全体で重複不可であり、カテゴリ名とタグ名の相互一致だけを許す。Label Normalizer v1はproject-vendored Unicode 15.1.0へ固定し、tombstone中も名前を予約する。active Tagはactive親を必須とし、親Categoryの物理回収は子Tag tombstoneがなくなった後だけ許す。
- ブックマーク編集では名前、URL、Tagだけを変更し、Categoryは選択Tagの親から自動導出する。Tag候補を最大8件から選び、説明横の新規作成から同じmodalのTag作成side viewへ進んでも元の入力を失わない。
- Bookmark／Tag削除は確認画面なしのsoft-deleteとし、Category削除だけは影響件数と連鎖削除・再分類を警告して確認する。削除後のUndo toast、token、期限、復元入口は設けない。アーカイブ一覧からの復元は削除Undoとは別機能として維持する。
- カテゴリ・タグ一覧の新規作成は種類を選択してmodalを開き、閉じるまで連続作成できる。Tag作成では入力に一致するactive Categoryを最大8候補から必ず選ぶ。必要なCategoryは同じmodalのside viewで作成し、Tag draftを保持して戻った時に自動選択する。有効な同名は元画面で選択し、削除済み同名は物理回収まで別名へ直す。
- 管理モードのhover／focus鉛筆から編集できる。Tag編集では名前と親Categoryを変更し、active Categoryを最大8候補から選ぶか同じmodalのside viewで作成できる。Tag／選択親のexpected revisionを検証し、親変更後は全参照BookmarkのCategory表示と検索文書を原子的に更新するが、AI再分類は行わない。Category編集では使用中Tagの実名一覧・件数と関連Bookmark unique件数を確認できる。
- Category削除を確認するとCategory、全子Tag、関連edgeがcascade soft-deleteされ、Bookmark本体は残って再分類される。AI失敗時はNEEDS_REVIEWとして手動分類へ進める。
- 両一覧からフルページ検索へ移り、入力中の候補が最大8件に収まる。結果はカテゴリ・タグを上、Bookmarkを下に表示する。
- AI入力ポップアップ内で自然言語検索の入力と結果を確認でき、保存、設定、分類、共有などBookmation全般の質問にも応答できる。AI検索候補は無順位で複数返す。
- リスト／グリッドだけを切り替えられ、カテゴリは常時、タグはキーボードでも展開できる。
- ホームには最近追加が表示され、全画面カテゴリ一覧の選択で対象一覧へ移動できる。
- 両一覧の追従ヘッダー、無限スクロール、件数、トップへ戻る、編集モーダルが動作する。
- 全画面設定では訪問集計期間が1週間／1ヶ月／1年のプルダウン、訪問日数とarchive日数が数値入力、AI細分化だけがスライダーである。訪問日数は既定値なし、archive日数は既定30日で、期間変更時は訪問日数が空になり1〜7／1〜30／1〜365の範囲へ切り替わる。リマインダー、自動archive、「右クリックメニューから保存」をそれぞれswitchで有効／無効にできる。
- URL指定保存が `http` / `https` を受け付け、メタデータ取得失敗時もURLを失わない。
- service workerを停止・再起動しても、処理中状態が壊れず再開または安全に失敗する。
- JSON正本がschema検証され、BlobがJSONへ埋め込まれない。
- 選択期間内の訪問日数到達時は確認前に保存せず、同日複数訪問を1日と数える。`いいえ` の後はそのcanonical URLの応答後訪問日だけを0から数え直し、「次回以降表示しない」では対象URLだけをSUPPRESSEDにする。他URLのリマインダーと `frequentVisitReminderEnabled` は維持する。
- 自動archiveは既定OFFで、switchをONにする操作からhistory権限の目的を説明する。許可できた場合だけONになり、拒否／取消時はOFFのまま、後から権限がなくなった場合もOFFへ戻る。履歴なしは `履歴がないためアーカイブできません` と表示して対象をarchiveしない。notificationsは要求しない。archive後はカテゴリ・タグ、ページ名、URLだけを保持して設定のリストから復元する。
- ユーザー間共有は同じ選択をQRまたはCSVでexportできる。QR容量超過ではQRを分割・切捨てず、エラーの `CSVでエクスポート` へ進む。QR checksumは破損／切詰めだけを検出し、真正性を保証しない。QR取込時の異親同名Tagは既存再利用／親変更せず、別名／skip／cancel後に再previewする。
- Driveは設定で対象アカウントを選び、同一アカウントの `appDataFolder` 同期と、別アカウントの通常Drive file＋permissions/capabilities共有を分ける。同一field、update-delete、add-delete、名前競合を自動LWWせず `syncConflicts` として表示する。
- 標準Bookmark取込は、各Bookmarkの直上Folderだけを1件のTagとしてpreviewし、祖先／full pathを分類へ入れない。同名active Tagは再利用し、新規Tagは親Categoryを選択／作成してから確定する。取込時にAI Tagを追加せず、元の標準Bookmark treeを変更しない。右クリック保存は設定ONでpage／linkが各1件だけ表示され、OFFで両方が消え、再度ONにしても重複しない。
- エクスポートまたはバックアップが実装されるまでは、実データを唯一の保存先として使わない。

## 次に進む場所

- 小さな作業を選ぶ: [TODO.md](TODO.md)
- 初期実装を続ける: [plans/2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md)
- 実装前の問題を確認する: [ISSUES.md](ISSUES.md)
- テストと受入を確認する: [TESTING.md](TESTING.md)
- 設計の暫定箇所を確認する: [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md)
