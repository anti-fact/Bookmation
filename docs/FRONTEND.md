# フロントエンド設計

- 状態: 提案・未実装
- 更新日: 2026-08-15
- 採用: Plasmo + React + TypeScript + Tailwind CSS
- 関連: [UI](./UI.md) / [設計](./DESIGN.md) / [要件](./REQUIREMENTS.md)

## エントリポイント

| entry | 責務 |
| --- | --- |
| `popup.tsx` | 保存／ホームの2操作、各ショートカットの実割当、変更案内 |
| `tabs/index.tsx` | dashboard、全画面タグ一覧、各モーダル、AI Host |
| `background.ts` | command受信、保存、DB、ジョブとメッセージ。Prompt APIは呼ばない |

popup は `chrome.commands.getAll()` の `name` と `shortcut` を command allowlist に対応付ける。空なら `未割り当て`。`割り当てを変更` は Chrome の管理画面を開く試行または案内表示に留める。

## routes と一時状態

| route | component |
| --- | --- |
| `#/home` | `BookmarkListPage`（最近追加） |
| `#/bookmarks?tag=<tagId>` | `BookmarkListPage`（タグ条件） |
| `#/tags` | `FullScreenTagListPage` |

`BookmarkEditDialog`、`SettingsDialog`、`AiSearchDialog`、`AddUrlDialog` は route 上の画面へ重ねる。閉じた後に trigger へフォーカスを戻す。自然言語入力とカーソルは URL / 永続設定へ保存しない。

## コンポーネント境界

| component | 責務 |
| --- | --- |
| `StickyBookmarkHeader` | bookmark keyword、AI button、件数、LIST / GRID、タグ一覧・設定導線 |
| `BookmarkList` | cursor page の描画、sentinel、追加状態 |
| `BookmarkItem` | 共通情報、MAIN 常時表示、SUB disclosure、編集ボタン |
| `FullScreenTagListPage` | 全画面構成と戻り先復元 |
| `StickyTagHeader` | tag keyword、AI button、閉じる |
| `TagList` | MAIN / SUB 表示、タグ選択、cursor sentinel |
| `AiSearchDialog` | 1入力と Bookmark / Tag の候補グループ |
| `BookmarkEditDialog` | name、URL、tag edge、削除 |
| `SettingsDialog` | AI granularity slider |
| `BackToTopButton` | 閾値後の表示、見出しへの scroll / focus |
| `Dialog` / `Disclosure` | a11y を含む共通 primitive |

## 状態管理

| 状態 | 置き場所 |
| --- | --- |
| Bookmark / Tag 正本 | IndexedDB repository。React state を正本にしない |
| LIST / GRID、AI細分化度 | `chrome.storage.local` |
| tagId、画面種別 | hash route |
| keyword、AI query、開閉、modal | React の画面内 state |
| cursor、requestId、hasNext | query state。URLへ入れない |
| 一覧へ戻る scroll anchor | navigation state。失効時は見出しへ戻す |

## 追従ヘッダー

デザインシートのヘッダー構成を Tailwind token と component に落とす。`position: sticky`、適切な `top`、z-index、背景を共通化する。ブックマーク画面では keyword、AI、件数、LIST / GRID を、タグ画面では keyword、AI、閉じるを表示する。200% 拡大時は操作を複数行に折り返して欠落させない。

## LIST / GRID

`ViewModeControl` は `LIST | GRID` のラジオグループとする。弁当 enum と列数設定を持たない。GRID は `grid-template-columns: repeat(auto-fit, minmax(...))` 等の responsive CSS で列数を決める。DOM 順と視覚順を一致させる。

`BookmarkItem` は MAIN tag chip を常時描画する。SUB は button disclosure で開閉し、`aria-expanded` / `aria-controls` を設定する。hover preview を追加する場合も `@media (hover: hover)` に限定し、フォーカス／クリック経路を維持する。

## 編集モーダル

フォームは `title`、`url`、`mainTagIds[]`、`subTagIds[]` を draft に持つ。URL は送信時に再検証する。MAIN 新規作成時は正規化名一致を検出して field error と既存選択を示し、SUB は同名別 ID の明示作成を許す。削除は二段階確認後に専用 command を送る。

保存中の二重送信を止め、revision conflict なら入力を失わず最新値との差分を示す。

## 共通 AI 検索

`AiSearchDialog` は入口に依存せず同じフォームを使う。結果型は次のように順位を持たない。

~~~ts
type AiSearchResults = {
  bookmarks: BookmarkCandidate[]
  tags: TagCandidate[]
  source: "AI" | "LEXICAL_FALLBACK"
}
~~~

配列順を関連度の意味に使わず、UI は候補番号や score を出さない。表示は entity type ごとの決定的な中立順にする。古い queryId の結果、候補外 ID、古い revision を破棄する。日本語 IME の composition 中は送信しない。

## キーワード検索

`BookmarkKeywordForm` は Bookmark だけ、`TagKeywordForm` は Tag だけを対象にする。入力を debounce し、条件変更時に cursor と取得済みページをリセットする。AI 非対応時も動作する。検索結果件数は live region で通知する。

## 無限スクロール

`IntersectionObserver` の sentinel と次カーソルを使う。

- `loading` 中は同じカーソルを再要求しない。
- レスポンスは `requestId` と開始カーソルが一致する場合だけ追加する。
- ID で dedupe し、終端では observer を解除する。
- エラー時は読込済み要素を残し、sentinel 位置に再試行を置く。
- 追加後にフォーカスを移動せず、件数だけ通知する。

ブックマーク画面は総件数と読込済み件数を表示する。タグ画面にも同じ paging primitive を使う。

## トップへ戻る

両一覧で共通 component を使う。一定の scrollY 以降だけ表示し、押下後は先頭見出しへ `tabIndex=-1` でフォーカスする。reduced motion を尊重する。

## AI Host とメッセージ

Prompt API はトップレベル dashboard 内の専用 adapter でのみ実行する。Service Worker は classification job の永続化、候補集合生成、AI 出力の再検証・適用を担う。

メッセージは discriminated union、schemaVersion、requestId、entityRevision を持ち、送信元と action allowlist を検証する。AI検索は一時処理で永続 job にしない。

## テスト観点

- popup: 2 command のキー表示、未割当、管理画面案内、保存不可 URL。
- list: sticky header、件数、keyword、LIST / GRID、MAIN 常時、SUB disclosure、全項目 edit。
- tags: full-screen、sticky header、keyword、close、戻り状態。
- dialogs: focus trap、Esc、復帰、編集 validation、削除確認、slider説明。
- AI search: 1フォーム、2グループ、無順位、複数候補、IME、fallback、古い応答拒否。
- paging: 多重 observer、重複 ID、終端、失敗再試行、back-to-top。
- responsive: 200% zoom、keyboard、screen reader、reduced motion。
