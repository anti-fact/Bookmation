# TODO

## 使い方

この文書は、原則として一人が一回の短い作業で完了・検証できる小規模タスクだけを扱う。チームで分担する実装ワークパッケージは [TASKS.md](TASKS.md)、複数領域をまたぐ、半日を超える、データ移行や権限変更を伴う、調査結果で方針が変わる作業は [PLANS.md](PLANS.md) に従ってExecution Planへ昇格させる。

各項目は「作業」だけでなく完了判定を持つ。着手時は担当と日付を追記し、完了したらチェックを付けて [WORKLOG.md](WORKLOG.md) に検証結果を残す。問題が見つかっただけなら [ISSUES.md](ISSUES.md)、意図的な暫定策なら [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) へ記録する。

## P0 — 実装開始前

- [x] **TODO-001: 文書間リンクを検査する**（2026-08-14）
  - 完了結果: 最新UI要件への更新後、Markdown パーサーで相対リンク177件と見出しリンク13件を再検査し、参照先漏れ0件を確認した。`AGENTS.md` も見出しとリンクだけである。
- [x] **TODO-002: `AI_GUIDE.md` が空であることを確認する**（2026-08-14）
  - 完了結果: `wc -c docs/AI_GUIDE.md` が0バイトであり、本文・テンプレートがないことを確認した。
- [ ] **TODO-003: 初期実装用Execution Planの骨子を作る**
  - 完了条件: `docs/plans/` に自己完結型Planを作り、保存→分類→一覧確認までの最初の縦切りを受け入れ条件にする。
- [ ] **TODO-004: Node.jsとパッケージマネージャーの候補を記録する**
  - 完了条件: 採用版、ロックファイル、更新方法を比較し、承認が必要な判断としてPlanへ載せる。決定前に実行環境があるように書かない。
- [ ] **TODO-005: Prompt APIの対応条件を一次資料で再確認する**
  - 完了条件: 確認日、Chrome版、OS、言語、必要な利用者操作、`availability()` の状態を [CONSTRAINTS.md](CONSTRAINTS.md) に反映する。
- [ ] **TODO-006: AI利用不可時の文言を確定する**
  - 完了条件: 保存を継続できること、手動分類へ進む操作、再試行方法を短い日本語で [UI.md](UI.md) に追記する。

## P1 — 最初のprototype前

- [ ] **TODO-007: 分類fixtureを10件作る**
  - 完了条件: 既存MAIN一致/不一致、MAIN同名拒否、USER SUB一致/不一致、同名SUB別ID、細分化0〜4の新規SUB上限を含むfixtureを用意する。
- [ ] **TODO-008: 重複URLの期待動作を決める**
  - 完了条件: URL正規化、再保存、タグ統合、利用者確認の4ケースを [REQUIREMENTS.md](REQUIREMENTS.md) または [DB-SCHEMA.md](DB-SCHEMA.md) に記録する。
- [ ] **TODO-009: 表示設定の初期値を決める**
  - 完了条件: LIST / GRIDの初期値、SUB展開状態、sticky header、back-to-top表示閾値を [UI.md](UI.md) に記録する。
- [ ] **TODO-010: 最小権限一覧をmanifest作成前にレビューする**
  - 完了条件: 各権限について利用機能、要求タイミング、権限なしの代替動作を [SECURITY.md](SECURITY.md) に記録する。
- [ ] **TODO-011: service worker中断の手動テスト手順を書く**
  - 完了条件: 保存処理中のworker停止、再起動、再送を再現し、重複や部分保存を判定できる手順をテスト文書またはPlanへ追加する。
- [ ] **TODO-012: UI参考サイトの確認日を更新する**
  - 完了条件: [REFERENCES.md](REFERENCES.md) の参照日、確認済み事実、推測を区別し、変化した箇所を [UI.md](UI.md) に反映する。
- [ ] **TODO-013: commandsの既定shortcut候補を検証する**
  - 完了条件: Chromeと主要OSで「現在ページを保存」「ホームを開く」の競合を確認し、変更方法と競合時の表示を [UI.md](UI.md) とmanifest設計へ記録する。
- [ ] **TODO-014: 共通AI検索fixtureと集合評価を作る**
  - 完了条件: 10件以上の質問、期待Bookmark / Tag集合、AI不可時fallbackを用意し、順位に依存せず候補を複数返し未知IDを拒否できる。
- [ ] **TODO-015: デザインシートのtokenを抽出する**
  - 完了条件: 色、余白、文字、角丸、sticky header、dialogの再利用tokenを記録し、SVGを直接改変しない。

## 完了済み

完了項目は削除せず、短期間ここへ残してから [WORKLOG.md](WORKLOG.md) の記録へ集約する。TODO-001とTODO-002は文書検査として完了したが、2026-08-14時点でアプリ実装として完了した項目はない。
