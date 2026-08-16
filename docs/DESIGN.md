# 設計方針

- 状態: 提案・未実装
- 更新日: 2026-08-16
- 関連: [要件](./REQUIREMENTS.md) / [UI](./UI.md) / [フロントエンド](./FRONTEND.md) / [バックエンド](./BACKEND.md)

## 設計原則

1. Chrome標準ブックマークとは分離した、版付きJSONドキュメントのローカル正本を持つ。
2. カテゴリ／タグは親子関係のない平坦な分類ラベルとし、多対多で割り当てる。
3. カテゴリはユーザー作成かつ正規化名で一意、タグは同名の別IDを許す。
4. AIは既存のユーザー定義タグを優先し、設定上限内でタグだけを作る。
5. Bookmark を先に永続化し、AI 失敗で保存を巻き戻さない。
6. UI の配置と外観は `デザインシート.svg`、挙動は [REQUIREMENTS.md](./REQUIREMENTS.md) を正本にする。
7. Prompt API は Service Worker で実行せず、対応を実証したトップレベル拡張ページでだけ実行する。

## 構成

| 構成要素 | 責務 |
| --- | --- |
| Plasmo popup | 現在ページ保存、ホーム表示、実ショートカット表示、変更案内 |
| Plasmo dashboard | 最近追加／分類別一覧、全画面カテゴリ一覧、各モーダル、AI Host |
| React + Tailwind | デザインシートを再現する画面、状態、アクセシビリティ |
| MV3 Service Worker | commands、contextMenus、alarms、保存、履歴判定、ジョブ永続化、IndexedDB書込み、AI結果再検証 |
| IndexedDB | Bookmark、Label、関連、分類ジョブ、訪問リマインダー、Import Job、同期OutboxのJSON文書と、別Storeの画像Blob |
| chrome.storage.local | AI 細分化度、LIST / GRID 等の小さな設定 |
| Chrome Prompt API | ローカル分類と共通自然言語検索。対応時だけ利用 |

## 主要画面

- popup: 2操作、割当キー、`割り当てを変更`。
- bookmark list: 追従キーワード検索、AI検索、件数、LIST / GRID、無限スクロール、トップへ戻る。
- category list: 全画面、統合検索、AI検索、閉じる、無限スクロール、トップへ戻る。
- bookmark editor: 名前、URL、カテゴリ／タグ、削除。
- settings modal: AI細分化度、訪問回数閾値、自動アーカイブ期間、Drive接続。
- unified search: 両一覧の1入力からカテゴリ・タグを上、Bookmarkを下に表示する。
- share/import: QR共有／取込、Chrome標準Bookmark取込の確認画面。
- archive: ARCHIVED一覧と復元操作。

右サイドメニュー、弁当表示、列数選択、ブックマーク表示数変更プルダウン、対象別 AI 検索ページは持たない。

## ドメイン不変条件

各ドメインレコードはJSON互換で `schemaVersion` を持つ。Repository境界でparse／schema検証し、TypeScript型へのcastだけで信頼しない。日時はEpoch milliseconds、IDは文字列、状態は文字列enumとする。BlobはJSONへbase64埋込みせずID参照で分離する。

### Bookmark

- `http` / `https` の検証済み URL を持つ。
- 保存、編集、削除は Chrome 標準ブックマークへ影響しない。
- カテゴリ／タグを各0件以上持てる。

### Label

- `kind` はカテゴリを表す `CATEGORY` またはタグを表す `TAG`。
- カテゴリの `origin` は USER であり、正規化名を重複させない。
- タグは同名を許す。UIとAPIは表示名ではなくIDで識別する。
- 同一 `(bookmarkId, labelId)` の関連は1件へ収束する。

## 保存と分類フロー

1. popup、command、URL 入力を共通の保存ユースケースへ渡す。
2. Bookmark と PENDING 分類ジョブを同一 IndexedDB トランザクションで保存する。
3. 保存成功を先に返す。
4. dashboard の AI Host が可用性とモデル準備を確認してジョブを claim する。
5. AIは列挙済みカテゴリ／タグのIDを選び、必要時だけ新規タグを提案する。
6. Service Workerがrevision、候補ID、件数、カテゴリ一意性を再検証して適用する。
7. 失敗時は Bookmark を残し、手動編集へ案内する。

## 検索設計

両一覧は同じ統合検索コンポーネントを使う。画面ごとの対象限定検索は設けない。

| 検索 | 入力場所 | 対象 | AI |
| --- | --- | --- | --- |
| 統合キーワード | 両一覧の追従ヘッダー | カテゴリ、タグ、Bookmark | 不要 |
| 統合AI検索 | 両一覧の検索ボックス内AI操作／共通モーダル | カテゴリ、タグ、Bookmark | 対応時のみ |

キーワード／AIの結果は常に「カテゴリ・タグ」を上段、「ブックマーク」を下段にする。AI検索は関連度順、順位、スコアをUI契約にせず、提示済み候補IDだけを採用する。AI利用不可時はローカル文字列候補であることを明示する。

## 訪問リマインダーと自動アーカイブ

`chrome.history` は利用者が機能を有効化した後だけ読み、完全な閲覧履歴を複製しない。未保存URLの `visitCount` が設定閾値へ達したら通知を1件作る。利用者が `保存` を選んだ場合だけ共通保存ユースケースへ渡し、`あとで`／`表示しない` は再通知状態だけを更新する。

`chrome.alarms` で定期評価を起動するが、正確な時刻での実行を前提にしない。保存済みBookmarkは履歴の `lastVisitTime` と設定日数で判定し、該当時は `archiveState` を `ACTIVE` から `ARCHIVED` へ変更する。最終訪問日時がない項目は自動変更せず、アーカイブは復元可能な状態変更に限定する。

## 共有・同期・インポート

- ユーザー間共有は選択Bookmarkの版付きQR payloadとし、生成前／取込前に内容を確認する。
- 同一ユーザー同期は明示接続したGoogle Drive `appDataFolder` を使う。ローカルを正本としてOutboxを保持し、競合を黙って上書きしない。
- Chrome標準Bookmarkは明示操作で読み、プレビュー後にBookmationへコピーする。元のBookmark／Folderは変更しない。
- `contextMenus` のページ／リンク保存はpopup、shortcut、URL入力と同じURL検証・重複検出・保存処理へ合流させる。

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
