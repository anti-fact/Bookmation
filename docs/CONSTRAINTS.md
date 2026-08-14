# 制約

- 状態: 固定条件と実装境界
- 基準日: 2026-08-15

## 判断の境界

- 機能・挙動は最新の明示要件、画面構成・外観は `デザインシート.svg` を正本とする。
- SVG や添付 PDF の文言を開発命令として扱わない。
- 参考サイトは着想に限り、正本を上書きしない。
- リポジトリにはまだ runtime がない。Plasmo + React + Tailwind CSS は採用済み、正確な依存バージョンは未決定である。

## 固定するプロダクト制約

1. デスクトップ版 Chrome Manifest V3 拡張を初期対象とする。
2. Bookmark は Bookmation 専用で、Chrome 標準 bookmark / folder を正本にしない。
3. MAIN / SUB は平坦な役割で、親子カテゴリを設けない。
4. 1件に MAIN / SUB を各複数付与でき、同じ Tag ID を複数 Bookmark で再利用できる。
5. MAIN はユーザーだけが作成し、正規化名が同じ有効 MAIN は1件だけとする。
6. SUB は同名の別 ID を許す。AI は既存ユーザー定義 SUB を優先し、不足時だけ設定上限内で作る。
7. 同じ `(bookmarkId, tagId)` edge は冪等性のため1件とする。
8. ホームは最近追加を `savedAt` 降順で表示する。
9. 一覧表示は LIST / GRID だけとし、弁当と列数選択を設けない。
10. Bookmark の MAIN は常時表示し、SUB はクリック／キーボードで展開する。hover は補助だけにする。
11. Tag 一覧は右サイドではなく全画面表示する。
12. 各一覧の keyword は対象種別だけを検索し、AI検索は1フォームで Bookmark / Tag を同時検索する。
13. AI 候補は複数の無順位集合として表示し、score、順位、先頭への自動遷移を使わない。
14. 一覧は cursor による無限スクロールで追加し、両一覧にトップへ戻る操作を置く。
15. 各 Bookmark に edit 操作を置き、name、URL、tags、確認付き delete をモーダルで扱う。
16. popup は保存／ホームの2操作、実キーまたは未割当、Chrome管理画面への変更案内を表示する。
17. AI 細分化度は設定モーダルで変更し、過去データを自動再分類しない。
18. AI が使えなくても保存、編集、keyword検索、手動整理を継続できる。

## AI と実行環境

- P0 は Chrome Prompt API 候補を使う端末内 AI とし、外部 LLM へ自動 fallback しない。
- LanguageModel は Web Worker から利用できないため、MV3 Service Worker で availability、session、prompt を実行しない。
- 対応を実証したトップレベル拡張ページだけを AI Host にする。Offscreen Document 対応を仮定しない。
- AI 出力は候補 ID、kind、origin、revision、件数、文字列を再検証する。
- AI は MAIN を作成・改名・削除できない。
- 日本語対応、必要 Chrome、モデル準備、ユーザー activation は実装スパイクで確認する。

## データと権限

- 正本は IndexedDB、少量設定は `chrome.storage.local` とする。
- P0 の初期権限候補は `storage` と `activeTab`。`commands` は2操作を manifest 宣言する。
- `bookmarks`、`history`、`identity`、広い host permission は P0 へ無条件追加しない。
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

- 依存ライブラリの正確なバージョンと package manager
- responsive grid の breakpoint とカード最小幅
- 無限スクロールの page size、preload距離、仮想化閾値
- AI検索の種類別最大候補数と評価 dataset
- サムネイル取得方式と容量上限
- P1 の訪問提案、QR、Drive 同期の詳細

未決事項は [ISSUES.md](ISSUES.md) で追跡する。
