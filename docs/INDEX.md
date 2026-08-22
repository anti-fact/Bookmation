# Bookmation ドキュメント索引

Bookmation は、閲覧中のページまたは指定URLを専用ストアへ保存し、カテゴリ／タグと検索で見つけ直す Chrome 拡張機能である。UIスタックは Plasmo（React）+ Radix Primitives + Tailwind CSS とする。実装手順は [FRONTEND_GUIDE.md](../FRONTEND_GUIDE.md)、開発コマンドは [QUICKSTART.md](QUICKSTART.md)、テスト受入順序は [TESTING.md](TESTING.md)、最初の縦切りは [2026-08-16 の Execution Plan](plans/2026-08-16-dev-scaffold.md) を参照する。

## 最初に読む文書

1. [REQUIREMENTS.md](REQUIREMENTS.md) — 何を作るか、優先度、受け入れ条件
2. [CONSTRAINTS.md](CONSTRAINTS.md) — 変更してよい点と守る制約
3. [DESIGN.md](DESIGN.md) — 全体構成と主要な設計判断
4. [QUICKSTART.md](QUICKSTART.md) — 現在できる最短の参加手順
5. [TESTING.md](TESTING.md) — Webプレビュー、AIエージェントのPlaywright確認、人間受入

## プロダクトと実装

| 文書 | 役割 |
| --- | --- |
| [FRONTEND.md](FRONTEND.md) | Chrome 拡張機能、画面、状態管理、アクセシビリティ |
| [FRONTEND_GUIDE.md](../FRONTEND_GUIDE.md) | 更新済みFigma SVGからRadix／Plasmo／Tailwind UIを実装する具体的な順序 |
| [BACKEND.md](BACKEND.md) | P0ローカル処理と、確定済みP1の履歴・共有・同期・取込境界 |
| [DB-SCHEMA.md](DB-SCHEMA.md) | IndexedDB上の版付きJSON document、索引、移行、同期 |
| [UI.md](UI.md) | 初回ホーム、popup、LIST / GRID、親カテゴリ／子タグ一覧、フルページ検索、編集・作成・設定・AI入力ポップアップ、共有、無限スクロール |
| [SECURITY.md](SECURITY.md) | 権限、個人データ、AI、共有・同期の安全要件 |
| [TESTING.md](TESTING.md) | 最新画面・設定・共有状態のWeb fixture、実拡張機能E2E、証拠、人間の最終受入 |
| [AI_GUIDE.md](AI_GUIDE.md) | AI 実装ガイド。依頼どおり現在は空である |

## 計画と運用

| 文書 | 役割 |
| --- | --- |
| [BACKEND_TASKS.md](../BACKEND_TASKS.md) | バックエンド担当向けの依存フロー、実装順、成果物、完了条件 |
| [PLANS.md](PLANS.md) | 長時間・複雑タスク用 Execution Plan の規約 |
| [2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md) | 開発基盤と最初の保存縦切り Plan |
| [2026-08-22-task-003-local-data-layer.md](plans/2026-08-22-task-003-local-data-layer.md) | TASK-003 / BE-02 ローカルデータ層（IndexedDB・Repository）Plan |
| [2026-08-22-task-004-save-ui-requirements.md](plans/2026-08-22-task-004-save-ui-requirements.md) | TASK-004 / BE-03・BE-04 保存 UI・commands・URL 指定保存 要件定義 |
| [2026-08-22-be-06-classification-job.md](plans/2026-08-22-be-06-classification-job.md) | BE-06 永続 AI 分類 Job（claim / lease / 再送制御）Execution Plan |
| [2026-08-23-be-10-security-hardening.md](plans/2026-08-23-be-10-security-hardening.md) | BE-10 / TASK-010 権限・入力・Blob 安全化 Execution Plan |
| [TASKS.md](TASKS.md) | チームで分担する実装ワークパッケージ、依存関係、完了条件 |
| [TODO.md](TODO.md) | 1 PR 程度で完了できる小規模タスク |
| [ISSUES.md](ISSUES.md) | 未決定事項・プロダクト上の問題 |
| [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) | 意図して先送りする技術的負債 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 症状から原因確認と復旧へ進む手引き |
| [WORKLOG.md](WORKLOG.md) | 実施済み作業と検証結果の時系列記録 |
| [MEMORY.md](MEMORY.md) | 長期間変えない用語・判断・不変条件 |
| [REFERENCES.md](REFERENCES.md) | デザインシート、参考 UI、公式技術資料と確認範囲 |

## 文書の状態表現

- **確定要件**: 利用者の明示依頼に由来し、画面構成・外観は `figma/Bookmation.svg`、部品と状態は `figma/Bookmation_component.svg` を正本とする。
- **設計決定**: チームが実装基準として採用する案。コードが存在することを意味しない。
- **候補**: スパイクまたは合意が必要である。
- **実装済み**: コードと検証結果が存在する場合にだけ使う。

文書間で矛盾を見つけた場合は [REQUIREMENTS.md](REQUIREMENTS.md) の出典優先順位に従い、関連文書と [WORKLOG.md](WORKLOG.md) を同じ変更で更新する。
