## 概要

TASK-002（Plasmo 拡張 bootstrap）の実装です。

- popup / dashboard tab / MV3 Service Worker の entry を分離
- manifest に `save-current-page` と `open-bookmation-home` を宣言
- command allowlist と handler を追加（ホームを開くのみ実装、保存は TASK-004 へ）
- popup を bootstrap 確認 UI に更新
- command 契約の unit test を追加

## スコープ外（後続タスク）

- popup の保存／ホーム 2 ボタン、ショートカット表示 → TASK-004
- Bookmark 保存 use case、IndexedDB → TASK-003 / TASK-004
- dashboard の route 実装、一覧 UI → TASK-005 以降

## テスト計画

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] 手動: Chrome で拡張機能を読み込み、popup と dashboard を開ける
- [x] 手動: `chrome://extensions/shortcuts` に 2 commands が表示される
- [ ] `save-current-page` の保存動作（TASK-004 で実施）
