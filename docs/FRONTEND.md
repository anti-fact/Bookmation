# フロントエンド設計

- 状態: 提案・未実装
- 更新日: 2026-08-16
- 採用: Plasmo + React + TypeScript + Tailwind CSS
- 関連: [UI](./UI.md) / [設計](./DESIGN.md) / [要件](./REQUIREMENTS.md)

## エントリポイント

| entry | 責務 |
| --- | --- |
| `popup.tsx` | 保存／ホームの2操作、各ショートカットの実割当、変更案内 |
| `tabs/index.tsx` | dashboard、全画面カテゴリ一覧、各モーダル、AI Host |
| `background.ts` | command、contextMenus、alarms、保存、履歴判定、DB、ジョブとメッセージ。Prompt APIは呼ばない |

popup は `chrome.commands.getAll()` の `name` と `shortcut` を command allowlist に対応付ける。空なら `未割り当て`。`割り当てを変更` は Chrome の管理画面を開く試行または案内表示に留める。

## routes と一時状態

| route | component |
| --- | --- |
| `#/home` | `BookmarkListPage`（最近追加） |
| `#/bookmarks?label=<labelId>` | `BookmarkListPage`（カテゴリ／タグ条件） |
| `#/labels` | `FullScreenLabelListPage` |
| `#/archive` | `ArchivedBookmarkListPage` |

`BookmarkEditDialog`、`SettingsDialog`、`AiSearchDialog`、`AddUrlDialog` は route 上の画面へ重ねる。閉じた後に trigger へフォーカスを戻す。自然言語入力とカーソルは URL / 永続設定へ保存しない。

## コンポーネント境界

| component | 責務 |
| --- | --- |
| `StickyBookmarkHeader` | 統合検索、AI button、件数、LIST / GRID、カテゴリ一覧・設定導線 |
| `BookmarkList` | cursor page の描画、sentinel、追加状態 |
| `BookmarkItem` | 共通情報、カテゴリ常時表示、タグdisclosure、編集ボタン |
| `FullScreenLabelListPage` | 全画面構成と戻り先復元 |
| `StickyLabelHeader` | 統合検索、AI button、閉じる |
| `LabelList` | カテゴリ／タグ表示、選択、cursor sentinel |
| `UnifiedSearch` | 両画面共通入力、上段Label候補、下段Bookmark候補 |
| `AiSearchDialog` | 1入力とカテゴリ・タグ／Bookmarkの候補グループ |
| `BookmarkEditDialog` | name、URL、tag edge、削除 |
| `SettingsDialog` | AI細分化、訪問閾値、自動archive期間、Drive接続 |
| `VisitReminder` | 保存／あとで／表示しない |
| `QrShareDialog` / `QrImportDialog` | 共有内容の確認、生成、取込 |
| `ChromeBookmarkImportDialog` | 権限説明、preview、進捗、結果 |
| `BackToTopButton` | 閾値後の表示、見出しへの scroll / focus |
| `Dialog` / `Disclosure` | a11y を含む共通 primitive |

## 状態管理

| 状態 | 置き場所 |
| --- | --- |
| Bookmark / Label 正本 | IndexedDB repository。React state を正本にしない |
| LIST / GRID、AI細分化度 | `chrome.storage.local` |
| labelId、画面種別 | hash route |
| keyword、AI query、開閉、modal | React の画面内 state |
| cursor、requestId、hasNext | query state。URLへ入れない |
| 一覧へ戻る scroll anchor | navigation state。失効時は見出しへ戻す |

## 追従ヘッダー

デザインシートのヘッダー構成をTailwind tokenとcomponentに落とす。`position: sticky`、適切な `top`、z-index、背景を共通化する。両画面で同じ統合検索とAI操作を使い、ブックマーク画面には件数とLIST / GRID、カテゴリ一覧画面には閉じるを追加する。200%拡大時は操作を複数行に折り返して欠落させない。

## LIST / GRID

`ViewModeControl` は `LIST | GRID` のラジオグループとする。弁当 enum、列数設定、表示件数プルダウンを持たない。GRID は `grid-template-columns: repeat(auto-fit, minmax(...))` 等の responsive CSS で列数を決める。DOM 順と視覚順を一致させる。

`BookmarkItem` はカテゴリchipを常時描画する。タグはbutton disclosureで開閉し、`aria-expanded` / `aria-controls` を設定する。hover previewを追加する場合も `@media (hover: hover)` に限定し、フォーカス／クリック経路を維持する。

## 編集モーダル

フォームは `title`、`url`、`categoryIds[]`、`tagIds[]` をdraftに持つ。URLは送信時に再検証する。カテゴリ新規作成時は正規化名一致を検出してfield errorと既存選択を示し、タグは同名別IDの明示作成を許す。削除は二段階確認後に専用commandを送る。

保存中の二重送信を止め、revision conflict なら入力を失わず最新値との差分を示す。

## 共通 AI 検索

`AiSearchDialog` は入口に依存せず同じフォームを使う。結果型は次のように順位を持たない。

~~~ts
type AiSearchResults = {
  labels: LabelCandidate[]
  bookmarks: BookmarkCandidate[]
  source: "AI" | "LEXICAL_FALLBACK"
}
~~~

配列順を関連度の意味に使わず、UIは候補番号やscoreを出さない。`labels` を上、`bookmarks` を下に固定し、各グループは決定的な中立順にする。古いqueryIdの結果、候補外ID、古いrevisionを破棄する。日本語IMEのcomposition中は送信しない。

## キーワード検索

`UnifiedSearch` は入口にかかわらずLabelとBookmarkの両方を対象にする。入力をdebounceし、結果popoverにはカテゴリ・タグを上、Bookmarkを下に表示する。AI非対応時もキーワード検索は動作する。検索結果件数はグループ別にlive regionで通知する。画面本体のcursorと検索popoverのcursorは分離する。

## P1設定・共有・取込

- 訪問機能のtoggleをオンにするときだけ、説明画面から `history` / `notifications` を要求する。拒否された設定をオンに見せない。
- アーカイブ設定は日数の範囲検証と無効化を提供し、処理結果からARCHIVED一覧へ移動できる。
- QR共有／取込は内容確認を必須にし、読み取った文字列をHTMLとして描画しない。
- Drive接続はアカウント、最終同期、未同期、競合、再認証を状態機械として表示する。
- Chrome標準Bookmark取込は権限説明、preview、進捗、cancel、部分失敗レポートを持ち、元データを変更しない。

## 無限スクロール

`IntersectionObserver` の sentinel と次カーソルを使う。

- `loading` 中は同じカーソルを再要求しない。
- レスポンスは `requestId` と開始カーソルが一致する場合だけ追加する。
- ID で dedupe し、終端では observer を解除する。
- エラー時は読込済み要素を残し、sentinel 位置に再試行を置く。
- 追加後にフォーカスを移動せず、件数だけ通知する。

ブックマーク画面は総件数と読込済み件数を表示する。カテゴリ一覧画面にも同じpaging primitiveを使う。

## トップへ戻る

両一覧で共通 component を使う。一定の scrollY 以降だけ表示し、押下後は先頭見出しへ `tabIndex=-1` でフォーカスする。reduced motion を尊重する。

## AI Host とメッセージ

Prompt API はトップレベル dashboard 内の専用 adapter でのみ実行する。Service Worker は classification job の永続化、候補集合生成、AI 出力の再検証・適用を担う。

メッセージは discriminated union、schemaVersion、requestId、entityRevision を持ち、送信元と action allowlist を検証する。AI検索は一時処理で永続 job にしない。

## テスト観点

- popup: 2 command のキー表示、未割当、管理画面案内、保存不可 URL。
- list: sticky header、件数、統合keyword、LIST / GRID、カテゴリ常時、タグdisclosure、全項目edit。
- labels: full-screen、sticky header、統合keyword、close、戻り状態。
- dialogs: focus trap、Esc、復帰、編集 validation、削除確認、slider説明。
- search: 両入口、カテゴリ・タグ上／Bookmark下、keywordとAI、無順位、複数候補、IME、fallback、古い応答拒否。
- P1: 履歴権限拒否、通知操作、archive復元、QR破損、Drive競合、標準Bookmark取込中断、context menu保存。
- paging: 多重 observer、重複 ID、終端、失敗再試行、back-to-top。
- responsive: 200% zoom、keyboard、screen reader、reduced motion。
