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
6. [plans/2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md) — 現在の実装 Plan。
7. [TODO.md](TODO.md)、[ISSUES.md](ISSUES.md)、[TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) — 作業候補と既知の課題。

作業を選ぶ前に、文書だけの小規模作業か、Execution Planが必要な作業かを [PLANS.md](PLANS.md) で判定する。実施内容と検証結果は [WORKLOG.md](WORKLOG.md) に追記する。

## 開発コマンド

推奨 Node は 22（`.nvmrc`）。package manager は pnpm 10.15.1（`package.json` の `packageManager`）。Corepack を使う。

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

品質確認:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

本番ビルドは `build/chrome-mv3-prod`、開発ビルドは `pnpm dev` が `build/chrome-mv3-dev` へ出す。

`package.json` に `engines` は置かない。Plasmo / Parcel が popup を解決できなくなる既知の不具合がある。

## Chrome への読込み

1. `pnpm dev` で開発ビルドを生成する。
2. Chrome で `chrome://extensions` を開く。
3. 「デベロッパー モード」を有効にする。
4. 「パッケージ化されていない拡張機能を読み込む」から `build/chrome-mv3-dev` を選ぶ。
5. 拡張機能アイコンを押し、確認用 popup が出ることを確認する。保存ボタンは TASK-002 まで無い。

Prompt API の初回モデル取得には利用者の操作、対応環境、空き容量、ネットワークが必要になる場合がある。AI が使えない場合もブックマーク保存と手動タグ付けを止めない（保存自体は TASK-004）。切り分けは [TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照する。

## 最小スモークテスト（実装後）

- 拡張機能を再読込しても保存済みブックマークが残る。
- 同じ操作を連打しても意図しない重複登録をしない。
- Prompt APIが利用不可でも、URLとタイトルを保存して手動分類できる。
- AIがカテゴリを新規作成せず、既存のユーザー定義カテゴリだけを割り当てる。
- タグ作成数が細分化スライダーの上限内で、既存のユーザー定義タグを先に再利用する。
- 同名カテゴリを作成できず、同名タグは別IDで表示でき、同じブックマークへ同じLabel IDを二重付与しない。
- 両一覧の検索がカテゴリ／タグとBookmarkを返し、カテゴリ・タグを上、Bookmarkを下に表示する。AI候補は無順位で複数返す。
- リスト／グリッドだけを切り替えられ、カテゴリは常時、タグはキーボードでも展開できる。
- ホームには最近追加が表示され、全画面カテゴリ一覧の選択で対象一覧へ移動できる。
- 両一覧の追従ヘッダー、無限スクロール、件数、トップへ戻る、編集モーダル、設定スライダーが動作する。
- URL指定保存が `http` / `https` を受け付け、メタデータ取得失敗時もURLを失わない。
- service workerを停止・再起動しても、処理中状態が壊れず再開または安全に失敗する。
- JSON正本がschema検証され、BlobがJSONへ埋め込まれない。
- 訪問閾値到達時は確認前に保存せず、自動archiveは最終訪問日時なしをskipして復元できる。
- QR、Drive同期、標準Bookmark取込、context menu保存がそれぞれの権限・確認境界を守る。
- エクスポートまたはバックアップが実装されるまでは、実データを唯一の保存先として使わない。

## 次に進む場所

- 小さな作業を選ぶ: [TODO.md](TODO.md)
- 初期実装を続ける: [plans/2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md)
- 実装前の問題を確認する: [ISSUES.md](ISSUES.md)
- 設計の暫定箇所を確認する: [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md)
