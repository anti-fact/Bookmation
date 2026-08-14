# QUICKSTART

## 現在できること

2026-08-14時点のリポジトリには、プロダクト文書と企画PDFはあるが、実行可能な拡張機能のソース、`package.json`、依存関係ロックファイル、ビルドスクリプトはまだない。したがって、現時点ではBookmationをインストール、起動、ビルド、テストできない。

このページの現行Quickstartは、チームが設計文書を読み、作業を選ぶところまでである。下部の開発コマンドは**初期実装後の想定**であり、現在は実行できない。

## 文書から参加する最短手順

```bash
git clone https://github.com/anti-fact/Bookmation.git
cd Bookmation
git status --short --branch
```

既にcheckout済みならcloneは不要である。未コミット変更は他のメンバーの作業かもしれないため、削除・resetせず内容を確認する。

次の順で読む。

1. ルートの `AGENTS.md` — 文書への目次。詳細仕様の正本にはしない。
2. [INDEX.md](INDEX.md) — 目的別の文書索引。
3. [REQUIREMENTS.md](REQUIREMENTS.md) と [CONSTRAINTS.md](CONSTRAINTS.md) — 何を作るか、何が制約か。
4. [DESIGN.md](DESIGN.md)、[FRONTEND.md](FRONTEND.md)、[BACKEND.md](BACKEND.md)、[DB-SCHEMA.md](DB-SCHEMA.md) — 実装方針。
5. [SECURITY.md](SECURITY.md) と [UI.md](UI.md) — データ保護と画面挙動。
6. [TODO.md](TODO.md)、[ISSUES.md](ISSUES.md)、[TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) — 作業候補と既知の課題。

作業を選ぶ前に、文書だけの小規模作業か、Execution Planが必要な作業かを [PLANS.md](PLANS.md) で判定する。実施内容と検証結果は [WORKLOG.md](WORKLOG.md) に追記する。

## 初期実装前の確認

```bash
test -f package.json && echo 'runtime scaffold exists' || echo 'runtime scaffold is not created yet'
find docs -maxdepth 2 -type f -name '*.md' -print | sort
git status --short
```

期待結果は、現在は `runtime scaffold is not created yet` と表示され、文書一覧を確認できることである。`package.json` が追加された後は、この記述を実際のコマンドに合わせて更新する。

## 初期実装後に想定する開発フロー（現在は実行不可）

UIスタックは **Plasmo + React + Tailwind CSS** を採用する。TypeScriptも設計上の基準とするが、まだscaffoldはない。以下はpackage scriptsを定義した場合の**暫定的な期待形**であり、採用するNode.js版、パッケージマネージャー、正確なscript名は未確定である。`package.json`、ロックファイル、ルートREADMEを確認してから置き換える。

```bash
# 例: package managerをpnpmに決定した後
corepack enable
pnpm install --frozen-lockfile
pnpm dev

# 品質確認用scriptを定義した後
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Plasmoの標準的な出力構成を維持した場合、開発版は `build/chrome-mv3-dev` のようなディレクトリへ出力される想定である。ただし、実際の設定を正本とし、ディレクトリが存在することを確認するまでこのパスを固定仕様として扱わない。

## 初期実装後に想定するChromeへの読込み（現在は実行不可）

1. `pnpm dev` 等で開発ビルドを生成する。
2. Chromeで `chrome://extensions` を開く。
3. 「デベロッパー モード」を有効にする。
4. 「パッケージ化されていない拡張機能を読み込む」から、実在する開発ビルドのディレクトリを選ぶ。
5. 拡張機能のカードにエラーがないことを確認する。
6. 対象ページで拡張機能アイコンを押し、popupの「このページを保存」と「ホームを開く」が別操作として機能することを確認する。
7. 「このページを保存」shortcutと「ホームを開く」shortcutを個別に実行し、意図した処理だけが行われることを確認する。

Prompt APIの初回モデル取得には利用者の操作、対応環境、空き容量、ネットワークが必要になる場合がある。AIが使えない場合もブックマーク保存と手動タグ付けを止めない。切り分けは [TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照する。

## 最小スモークテスト（実装後）

- 拡張機能を再読込しても保存済みブックマークが残る。
- 同じ操作を連打しても意図しない重複登録をしない。
- Prompt APIが利用不可でも、URLとタイトルを保存して手動分類できる。
- AIがメインタグを新規作成せず、既存のユーザー定義メインタグだけを割り当てる。
- サブタグ作成数が細分化スライダーの上限内で、既存のユーザー定義サブタグを先に再利用する。
- 同名タグを別IDとして登録・表示でき、同じブックマークへ同じタグIDだけを二重付与しない。
- 自然言語のタグ検索とブックマーク検索がそれぞれ複数候補を返し、AI利用不可時も文字列検索へfallbackする。
- リスト、グリッド、弁当表示を切り替えられ、列数指定はグリッド・弁当だけに効く。
- ホームには最近追加したブックマークが表示され、右サイドメニューのタグ選択で対象一覧へ移動できる。
- URL指定保存が `http` / `https` を受け付け、メタデータ取得失敗時もURLを失わない。
- service workerを停止・再起動しても、処理中状態が壊れず再開または安全に失敗する。
- エクスポートまたはバックアップが実装されるまでは、実データを唯一の保存先として使わない。

## 次に進む場所

- 小さな作業を選ぶ: [TODO.md](TODO.md)
- 初期実装を計画する: [PLANS.md](PLANS.md)
- 実装前の問題を確認する: [ISSUES.md](ISSUES.md)
- 設計の暫定箇所を確認する: [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md)
