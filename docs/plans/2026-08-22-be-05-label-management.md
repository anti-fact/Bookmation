# BE-05 編集・親子 Label・一覧 Query

## 実装範囲

- Bookmark は `title`、`rawUrl`、`tagIds` だけを期待 revision 付きで更新する。Category edge は active Tag の親から同一トランザクション内で再導出する。
- Bookmark と Tag は確認フラグや Undo token を設けず soft-delete する。同じ削除前 revision による再送は tombstone を再更新しない。
- Category/Tag の作成、Tag の親変更、Category cascade delete は既存の IDB transaction と request ID 契約を Service Worker message application から呼び出す。
- active Label の候補（最大 8 件）と、最近追加／Label 条件 Bookmark 一覧を cursor で返す。

## Message actions

- `create-category`, `create-tag`, `update-tag`
- `update-bookmark`, `delete-bookmark`, `delete-tag`
- `get-category-edit-detail`, `delete-category-cascade`
- `list-label-candidates`, `list-bookmarks`

## 検証

- `pnpm typecheck`
- `pnpm test:idb`（21 tests）
- `pnpm build`
- 対象ファイルの ESLint

## 後続タスク

Dashboard の編集モーダル、Category side view と draft 保持、削除確認 UI、無限スクロール UI は TASK-005/006 で接続する。手動 archive / restore は別の archive 状態遷移として未実装であり、soft-delete の代替にはしない。
