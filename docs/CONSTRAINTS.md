# 制約

- 状態: 固定条件と実装境界
- 基準日: 2026-08-16

## 判断の境界

- 機能・挙動は最新の明示要件、画面構成・外観は `デザインシート.svg` を正本とする。
- 削除済みの旧企画 PDF は情報が古いため、現行要件の根拠に使わない。
- 参考サイトは着想に限り、正本を上書きしない。
- Plasmo + React + Tailwind CSS + TypeScript の実装版は `package.json` と `pnpm-lock.yaml` を正本とする。package manager は pnpm。推奨 Node は `.nvmrc` の 22。
- 利用者向け正式名称はカテゴリ／タグとし、内部総称 `Label`、enum `CATEGORY` / `TAG` をUIへ露出しない。

## 固定するプロダクト制約

1. デスクトップ版 Chrome Manifest V3 拡張を初期対象とする。
2. Bookmark は Bookmation 専用で、Chrome 標準 bookmark / folder を正本にしない。
3. カテゴリ／タグは平坦な役割で、親子階層を設けない。
4. 1件にカテゴリ／タグを各複数付与でき、同じLabel IDを複数Bookmarkで再利用できる。
5. カテゴリはユーザーだけが作成し、正規化名が同じ有効カテゴリは1件だけとする。
6. タグは同名の別IDを許す。AIは既存ユーザー定義タグを優先し、不足時だけ設定上限内で作る。
7. 同じ `(bookmarkId, labelId)` edge は冪等性のため1件とする。
8. ホームは最近追加を `savedAt` 降順で表示する。
9. 一覧表示は LIST / GRID だけとし、弁当、列数選択、ブックマーク表示数変更プルダウンを設けない。
10. Bookmarkのカテゴリは常時表示し、タグはクリック／キーボードで展開する。hoverは補助だけにする。
11. カテゴリ一覧は右サイドではなく全画面表示する。
12. ブックマーク一覧とカテゴリ一覧は同じ統合検索を使い、keyword／AIのどちらもカテゴリ、タグ、Bookmarkを検索する。
13. 検索結果はカテゴリ・タグを上、Bookmarkを下に置く。AI候補は各グループ内で複数の無順位集合として表示し、score、順位、先頭への自動遷移を使わない。
14. 一覧は cursor による無限スクロールで追加し、両一覧にトップへ戻る操作を置く。
15. 各Bookmarkにedit操作を置き、name、URL、カテゴリ／タグ、確認付きdeleteをモーダルで扱う。
16. popup は保存／ホームの2操作、実キーまたは未割当、Chrome管理画面への変更案内を表示する。
17. AI 細分化度は設定モーダルで変更し、過去データを自動再分類しない。
18. AI が使えなくても保存、編集、keyword検索、手動整理を継続できる。
19. 頻繁に訪問する未保存サイトは、設定閾値への到達後にリマインダーを出し、利用者が `保存` を選んだ場合だけ専用Bookmarkへ保存する。無断保存しない。
20. 自動アーカイブは最終訪問日時と設定日数で判定し、`archiveState` を文字列 `ACTIVE` / `ARCHIVED` で変更する。物理削除せず復元可能にする。
21. ユーザー間共有はQR、同一ユーザーの端末間同期は明示接続したGoogle Driveのアプリ専用領域を使い、用途を混同しない。
22. Chrome標準Bookmarkのインポートは明示操作でBookmationへコピーし、標準BookmarkとFolderを変更・削除しない。
23. ページ／リンクの右クリック保存は既存のURL検証・重複検出・保存ユースケースを再利用する。

## AI と実行環境

- P0 は Chrome Prompt API 候補を使う端末内 AI とし、外部 LLM へ自動 fallback しない。
- LanguageModel は Web Worker から利用できないため、MV3 Service Worker で availability、session、prompt を実行しない。
- 対応を実証したトップレベル拡張ページだけを AI Host にする。Offscreen Document 対応を仮定しない。
- AI 出力は候補 ID、kind、origin、revision、件数、文字列を再検証する。
- AIはカテゴリを作成・改名・削除できない。
- 日本語対応、必要 Chrome、モデル準備、ユーザー activation は実装スパイクで確認する。

## データと権限

- 正本はIndexedDB上の版付きJSON互換ドキュメント、少量設定は `chrome.storage.local` のJSON互換値とする。SQL/RDBを前提にしない。
- JSON文書には `schemaVersion` を持たせ、`undefined`、関数、循環参照、非有限数、BigIntを保存しない。画像BlobはID参照にして別Storeへ分離する。
- P0 の初期権限候補は `storage` と `activeTab`。`commands` は2操作を manifest 宣言する。
- P1では `contextMenus` と定期判定用 `alarms` を宣言し、`history`、`notifications`、`bookmarks`、`identity` / Drive OAuthは機能の開始時に目的を説明して必要な範囲だけ要求する。P0へ無条件追加しない。
- 履歴は判定に必要な集約値だけを保持し、履歴の追加・削除を行わない。Drive OAuthトークンはIndexedDBや同期payloadへ保存しない。
- URL は P0 で `http:` / `https:` だけを許す。
- popup は `chrome.commands.getAll()` でキーを読む。変更は `chrome://extensions/shortcuts` で利用者が行い、拡張機能内の書換APIを仮定しない。
- AI query、Prompt、本文は既定で永続化しない。

## UI・アクセシビリティ

- デザインシートのデスクトップ UI を基準にし、200% 拡大や狭い幅でも機能を欠落させない。
- sticky header が本文やフォーカス対象を隠さないよう scroll margin を設ける。
- Dialog は背景 inert、focus trap、Esc、trigger への focus 復帰を備える。
- hover だけに情報や操作を置かない。
- 無限スクロールの追加件数、終端、失敗を支援技術へ通知し、既読内容を失わない。
- back-to-top は見出しへ focus を戻し、reduced motion を尊重する。
- AI 由来、選択、エラーを色だけで示さない。

## 現時点で固定しないもの

- responsive grid の breakpoint とカード最小幅
- 無限スクロールの page size、preload距離、仮想化閾値
- AI検索の種類別最大候補数と評価 dataset
- サムネイル取得方式と容量上限
- 訪問判定の集計期間、通知の再表示間隔、各設定の既定値
- 最終訪問日時が存在しないBookmarkの再確認UI
- QRの1件あたり上限、分割方式、任意暗号化
- Google Drive同期の競合UI、tombstone保持期間、追加暗号化
- Chrome標準Bookmark FolderのTagへの対応と重複時UI

未決事項は [ISSUES.md](ISSUES.md) で追跡する。
