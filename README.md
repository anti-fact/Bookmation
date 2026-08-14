# Bookmation

Bookmationは、Chrome標準ブックマークとは別の専用領域へWebページを保存し、メインタグ・サブタグと自然言語検索で見つけ直すChrome拡張機能である。

> [!IMPORTANT]
> 現在は設計・要件定義段階であり、実行可能な拡張機能、`package.json`、ビルドスクリプトはまだ存在しない。以下は実装予定のプロダクト仕様である。

## 主な機能

- 拡張機能アイコンのポップアップから「現在のページを保存」または「Bookmationホームを開く」を選べる。
- 現在ページの保存とホーム表示を、それぞれ独立したキーボードショートカットで実行できる。
- 現在開いているページだけでなく、入力した`http` / `https` URLも保存できる。
- ホームには、最近追加したブックマークを新しい順に表示する。
- 右側の追従メニューからタグを選び、そのタグを持つブックマーク一覧へ移動できる。
- 自然言語によるタグ検索とブックマーク検索を分け、どちらも順位付き候補を複数提示する。
- 一覧をリスト・グリッド・弁当の3形式で表示できる。グリッドと弁当では1行の表示数を選べる。
- 各ブックマークは通常時にタグ件数を示し、展開すると付与された全メインタグ・サブタグを表示する。

## タグとAI分類

- メインタグとサブタグは親子階層ではなく、平坦な2種類のタグとして扱う。
- 1件のブックマークにメインタグ・サブタグをそれぞれ複数付与できる。
- 同じタグを複数のブックマークで再利用でき、同じ表示名を持つ別IDのタグも作成できる。
- メインタグを新規作成・改名・削除できるのは利用者だけである。AIは既存メインタグの候補を選べるが、新規作成しない。
- サブタグは既存の利用者定義タグを優先し、適切な候補がない場合だけAIが作成する。
- AIが新規作成するサブタグの細かさと上限は、5段階のスライダーで調整する。
- AIが利用できない場合も、ブックマーク保存、手動タグ付け、文字列検索は利用できる設計とする。

## 技術構成

| 領域 | 方針 |
| --- | --- |
| 拡張機能 | Chrome Manifest V3 + Plasmo |
| UI | React + Tailwind CSS |
| 実装言語 | TypeScriptを設計標準とする |
| データ保存 | IndexedDB。表示・AI設定は`chrome.storage.local` |
| AI | Chrome Prompt API / Gemini Nanoを候補とする端末内処理 |
| バックエンド | MVPではリモートサーバーを設けない |

Chrome Prompt APIはService Workerから直接実行せず、対応を実機確認したトップレベル拡張ページをAI Hostとする。Service Workerはブックマークと分類ジョブの永続化、結果の検証・適用を担当する。

## 画面の流れ

1. ポップアップ、保存ショートカット、またはURL入力からブックマークを保存する。
2. 保存済みデータを失わない状態で、AI分類または手動タグ付けを行う。
3. 最近追加ホーム、右タグメニュー、自然言語検索のいずれかから目的の一覧へ移動する。
4. リスト・グリッド・弁当を切り替え、カードのタグを展開して内容を確認する。

## ドキュメント

- [ドキュメント索引](docs/INDEX.md)
- [要件](docs/REQUIREMENTS.md)
- [制約](docs/CONSTRAINTS.md)
- [全体設計](docs/DESIGN.md)
- [UI設計](docs/UI.md)
- [フロントエンド設計](docs/FRONTEND.md)
- [バックエンド設計](docs/BACKEND.md)
- [DBスキーマ](docs/DB-SCHEMA.md)
- [セキュリティ](docs/SECURITY.md)
- [実装タスク](docs/TASKS.md)
- [最短の参加手順](docs/QUICKSTART.md)

すべての参照文書は[AGENTS.md](AGENTS.md)からも辿れる。長時間・複雑な実装は[Execution Plan規約](docs/PLANS.md)に従い、小規模作業は[TODO](docs/TODO.md)、未決定事項は[ISSUES](docs/ISSUES.md)で管理する。

## 現在の始め方

現時点ではアプリを起動できないため、まず設計文書を確認して初期実装のExecution Planを作成する。

```bash
git status --short --branch
test -f package.json && echo "runtime scaffold exists" || echo "runtime scaffold is not created yet"
```

実装開始後の想定フローと、現在実行できないコマンドの区別は[QUICKSTART.md](docs/QUICKSTART.md)を参照する。
