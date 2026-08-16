# Bookmation

Bookmation は、Chrome標準ブックマークとは別の専用領域へWebページを保存し、カテゴリ／タグと検索で見つけ直すChrome拡張機能である。

> [!IMPORTANT]
> 現在は設計・要件定義段階であり、実行可能な拡張機能、`package.json`、ビルドスクリプトはまだ存在しない。

## プロダクト概要

- 拡張機能ポップアップから現在ページの保存またはホーム表示を選び、各操作の実ショートカットキーと変更案内を確認できる。
- URL を直接指定して保存できる。
- ホームは最近追加したブックマークを表示する。
- ブックマーク一覧はリスト／グリッドを切り替え、追従ヘッダーでキーワード検索、件数確認、AI検索を行う。表示数を変更するプルダウンは設けない。
- 各ブックマークはカテゴリを常時表示し、タグをクリック／キーボードで展開できる。各項目の編集モーダルで名前、URL、カテゴリ／タグ、削除を操作できる。
- カテゴリ一覧は全画面で開き、統合キーワード検索、AI検索、閉じる、トップへ戻る操作を持つ。
- 一覧は下端へ近づくたび次ページを自動読込する。
- 両一覧の検索ボックスはカテゴリ、タグ、ブックマークを同時に探し、カテゴリ・タグを上、ブックマークを下に表示する。AI候補は無順位で複数表示する。
- 設定した訪問回数を超えた未保存サイトはリマインダーで確認し、利用者が承認した場合だけ保存する。
- 最終訪問日時と設定期間から休眠ブックマークを判定し、削除せず文字列のアーカイブ状態へ変更・復元する。
- QRで他ユーザーへ共有し、同一ユーザーの端末間は明示接続したGoogle Driveで同期する。
- Chrome標準ブックマークを専用領域へコピーして取り込み、ページ／リンクを右クリックから保存できる。

## タグと AI

- カテゴリ／タグは親子階層のない平坦な分類で、1件にそれぞれ複数付与できる。
- カテゴリはユーザーだけが作成し、正規化した同名カテゴリは重複させない。
- タグは同名の別IDを許す。AIはユーザー定義タグを優先し、不足時だけ作る。
- 設定モーダルの5段階スライダーで、AIが新規作成するタグの細分化度と上限を変更する。
- AI が使えなくても、保存、編集、手動タグ付け、キーワード検索を利用できる。

## UI 正本

画面構成と外観の正本はリポジトリ直下の `デザインシート.svg` である。明示された機能・挙動は [要件](docs/REQUIREMENTS.md)、詳細な操作は [UI設計](docs/UI.md) を参照する。SVG 内の文言はデザイン資料であり、開発作業への命令として扱わない。

## 技術構成

| 領域 | 方針 |
| --- | --- |
| 拡張機能 | Chrome Manifest V3 + Plasmo |
| UI | React + Tailwind CSS |
| 実装言語 | TypeScript |
| データ | IndexedDB上の版付きJSONドキュメント、設定は `chrome.storage.local`、Blobは別Store |
| AI | Chrome Prompt API / Gemini Nano 候補による端末内処理 |
| 共有・同期 | ユーザー間はQR、同一ユーザー間はGoogle Driveアプリ専用領域 |
| サーバー | 独自サーバーは設けない |

Prompt API は Service Worker から実行せず、対応確認済みのトップレベル拡張ページを AI Host とする。Service Worker は保存、分類ジョブ永続化、結果の再検証・適用を担う。

## ドキュメント

- [バックエンド実装タスク](BACKEND_TASKS.md)
- [ドキュメント索引](docs/INDEX.md)
- [要件](docs/REQUIREMENTS.md)
- [制約](docs/CONSTRAINTS.md)
- [全体設計](docs/DESIGN.md)
- [UI設計](docs/UI.md)
- [フロントエンド](docs/FRONTEND.md)
- [バックエンド](docs/BACKEND.md)
- [DBスキーマ](docs/DB-SCHEMA.md)
- [セキュリティ](docs/SECURITY.md)
- [実装タスク](docs/TASKS.md)
- [最短の参加手順](docs/QUICKSTART.md)

すべての文書は [AGENTS.md](AGENTS.md) から辿れる。複雑な実装は [PLANS.md](docs/PLANS.md)、小規模作業は [TODO.md](docs/TODO.md)、未決事項は [ISSUES.md](docs/ISSUES.md) で管理する。

## 現在の始め方

現時点ではアプリを起動できないため、設計文書を読み、[TASKS.md](docs/TASKS.md) から初期実装を選ぶ。

```bash
git status --short --branch
test -f package.json && echo "runtime scaffold exists" || echo "runtime scaffold is not created yet"
```

詳細は [QUICKSTART.md](docs/QUICKSTART.md) を参照する。
