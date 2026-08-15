# Bookmation ドキュメント索引

Bookmation は、閲覧中のページまたは指定URLを専用ストアへ保存し、メイン／サブタグと検索で見つけ直す Chrome 拡張機能である。UIスタックは Plasmo（React）+ Tailwind CSS とする。2026-08-15 時点でリポジトリにアプリ実装はなく、本ディレクトリは開発開始時の参照基準である。

## 最初に読む文書

1. [REQUIREMENTS.md](REQUIREMENTS.md) — 何を作るか、優先度、受け入れ条件
2. [CONSTRAINTS.md](CONSTRAINTS.md) — 変更してよい点と守る制約
3. [DESIGN.md](DESIGN.md) — 全体構成と主要な設計判断
4. [QUICKSTART.md](QUICKSTART.md) — 現在できる最短の参加手順

## プロダクトと実装

| 文書 | 役割 |
| --- | --- |
| [FRONTEND.md](FRONTEND.md) | Chrome 拡張機能、画面、状態管理、アクセシビリティ |
| [BACKEND.md](BACKEND.md) | MVP のローカル処理と将来の同期境界 |
| [DB-SCHEMA.md](DB-SCHEMA.md) | IndexedDB を前提とした概念データモデル |
| [UI.md](UI.md) | popup、LIST / GRID、全画面タグ一覧、編集・設定・AI検索モーダル、無限スクロール |
| [SECURITY.md](SECURITY.md) | 権限、個人データ、AI、共有・同期の安全要件 |
| [AI_GUIDE.md](AI_GUIDE.md) | AI 実装ガイド。依頼どおり現在は空である |

## 計画と運用

| 文書 | 役割 |
| --- | --- |
| [PLANS.md](PLANS.md) | 長時間・複雑タスク用 Execution Plan の規約 |
| [TASKS.md](TASKS.md) | チームで分担する実装ワークパッケージ、依存関係、完了条件 |
| [TODO.md](TODO.md) | 1 PR 程度で完了できる小規模タスク |
| [ISSUES.md](ISSUES.md) | 未決定事項・プロダクト上の問題 |
| [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) | 意図して先送りする技術的負債 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 症状から原因確認と復旧へ進む手引き |
| [WORKLOG.md](WORKLOG.md) | 実施済み作業と検証結果の時系列記録 |
| [MEMORY.md](MEMORY.md) | 長期間変えない用語・判断・不変条件 |
| [REFERENCES.md](REFERENCES.md) | デザインシート、参考 UI、公式技術資料と確認範囲 |

## 文書の状態表現

- **確定要件**: 利用者の明示依頼に由来し、画面構成・外観は `デザインシート.svg` を正本とする。
- **設計決定**: チームが実装基準として採用する案。コードが存在することを意味しない。
- **候補**: スパイクまたは合意が必要である。
- **実装済み**: コードと検証結果が存在する場合にだけ使う。

文書間で矛盾を見つけた場合は [REQUIREMENTS.md](REQUIREMENTS.md) の出典優先順位に従い、関連文書と [WORKLOG.md](WORKLOG.md) を同じ変更で更新する。
