# 設計方針

- 状態: 提案・未実装
- 更新日: 2026-08-15
- 関連: [要件](./REQUIREMENTS.md) / [UI](./UI.md) / [フロントエンド](./FRONTEND.md) / [バックエンド](./BACKEND.md)

## 設計原則

1. Chrome 標準ブックマークとは分離したローカル正本を持つ。
2. MAIN / SUB は親子関係のない平坦なタグとし、多対多で割り当てる。
3. MAIN はユーザー作成かつ正規化名で一意、SUB は同名の別 ID を許す。
4. AI は既存のユーザー定義タグを優先し、設定上限内で SUB だけを作る。
5. Bookmark を先に永続化し、AI 失敗で保存を巻き戻さない。
6. UI の配置と外観は `デザインシート.svg`、挙動は [REQUIREMENTS.md](./REQUIREMENTS.md) を正本にする。
7. Prompt API は Service Worker で実行せず、対応を実証したトップレベル拡張ページでだけ実行する。

## 構成

| 構成要素 | 責務 |
| --- | --- |
| Plasmo popup | 現在ページ保存、ホーム表示、実ショートカット表示、変更案内 |
| Plasmo dashboard | 最近追加／タグ別一覧、全画面タグ一覧、各モーダル、AI Host |
| React + Tailwind | デザインシートを再現する画面、状態、アクセシビリティ |
| MV3 Service Worker | commands、保存、ジョブ永続化、IndexedDB 書込み、AI 結果再検証 |
| IndexedDB | Bookmark、Tag、関連、分類ジョブ、検索派生文書、画像 Blob |
| chrome.storage.local | AI 細分化度、LIST / GRID 等の小さな設定 |
| Chrome Prompt API | ローカル分類と共通自然言語検索。対応時だけ利用 |

## 主要画面

- popup: 2操作、割当キー、`割り当てを変更`。
- bookmark list: 追従キーワード検索、AI検索、件数、LIST / GRID、無限スクロール、トップへ戻る。
- tag list: 全画面、追従タグ検索、AI検索、閉じる、無限スクロール、トップへ戻る。
- bookmark editor: 名前、URL、MAIN / SUB、削除。
- settings modal: AI 細分化度スライダー。
- AI search modal: 1入力から Bookmark / Tag の無順位候補集合を表示。

右サイドメニュー、弁当表示、列数選択、対象別 AI 検索ページは持たない。

## ドメイン不変条件

### Bookmark

- `http` / `https` の検証済み URL を持つ。
- 保存、編集、削除は Chrome 標準ブックマークへ影響しない。
- MAIN / SUB を各0件以上持てる。

### Tag

- `kind` は MAIN または SUB。
- MAIN の `origin` は USER であり、正規化名を重複させない。
- SUB は同名を許す。UI と API は表示名ではなく ID で識別する。
- 同一 `(bookmarkId, tagId)` の関連は1件へ収束する。

## 保存と分類フロー

1. popup、command、URL 入力を共通の保存ユースケースへ渡す。
2. Bookmark と PENDING 分類ジョブを同一 IndexedDB トランザクションで保存する。
3. 保存成功を先に返す。
4. dashboard の AI Host が可用性とモデル準備を確認してジョブを claim する。
5. AI は列挙済み MAIN / SUB の ID を選び、必要時だけ新規 SUB を提案する。
6. Service Worker が revision、候補 ID、件数、MAIN 一意性を再検証して適用する。
7. 失敗時は Bookmark を残し、手動編集へ案内する。

## 検索設計

検索を混同しない。

| 検索 | 入力場所 | 対象 | AI |
| --- | --- | --- | --- |
| ブックマークキーワード | bookmark list の追従ヘッダー | Bookmark の文字列と付与タグ | 不要 |
| タグキーワード | tag list の追従ヘッダー | Tag の文字列 | 不要 |
| 共通 AI 検索 | 両一覧の共通モーダル | Bookmark と Tag | 対応時のみ |

AI 検索は候補集合を Bookmark / Tag でグループ化する。関連度順、順位、スコアを UI 契約にせず、提示済み候補 ID だけを採用する。AI 利用不可時はローカル文字列候補であることを明示する。

## 一覧取得

`savedAt + id` 等の安定カーソルで取得する。IntersectionObserver の sentinel ごとに次ページを1回だけ要求し、requestId とカーソルで多重要求／重複を防ぐ。総件数は条件変更時に取得し、読込済み件数と分けて表示する。追加失敗では既読項目を保持する。

## モーダルと破壊的操作

設定、AI検索、URL追加、編集は共通 Dialog 基盤を使う。背景の inert、フォーカストラップ、Esc、フォーカス復帰を共通化する。Bookmark 削除は対象を示す確認を必須にし、保存失敗時は入力を保持する。

## ショートカット境界

`chrome.commands.getAll()` で現在の割当を表示する。利用者は Chrome の `chrome://extensions/shortcuts` で変更するため、アプリ内変更 API を設計しない。変更ボタンは管理画面への遷移または手順案内であり、成功を偽装しない。

## 未実証事項

- 対象 Chrome と Prompt API の配布・モデル準備条件
- dashboard が Prompt API のサポート対象トップレベル拡張ページか
- `chrome://extensions/shortcuts` を拡張ページから直接開けるか。不可時は手順案内へ縮退する
- 実データ件数に対する検索索引、無限スクロール、仮想化の性能値

これらは [ISSUES.md](./ISSUES.md) と [TECH-DEBT-TRACKER.md](./TECH-DEBT-TRACKER.md) で追跡する。
