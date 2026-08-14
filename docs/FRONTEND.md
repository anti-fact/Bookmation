# フロントエンド設計

## 文書の位置づけ

- 状態: **設計確定・未実装**
- 採用技術: Plasmo + React + Tailwind CSS
- 実装言語: TypeScript を設計標準とする
- 関連: [全体設計](./DESIGN.md) / [UI設計](./UI.md) / [要件](./REQUIREMENTS.md) / [バックエンド](./BACKEND.md) / [セキュリティ](./SECURITY.md)

Plasmo、React、Tailwind CSS は今回の指定により採用する。ビルド、Manifest V3、CSP、Chrome Web Store 配布条件は実装時に検証し、未検証の動作を確認済みとは扱わない。

## エントリポイント

| エントリポイント案 | 責務 |
| --- | --- |
| `popup.tsx` | 拡張機能アイコンから現在ページ保存またはホーム表示を選ぶ |
| `tabs/bookmation.tsx` | ホーム、タグ別一覧、自然言語検索、URL追加、設定を持つ拡張機能ページ |
| `background/index.ts` | commands の受付、保存ユースケース、タブの再利用、UIとのメッセージ通信 |
| `style.css` | Tailwind の読込、デザイントークン、全エントリポイントの基本スタイル |

ディレクトリ名は Plasmo の実際の初期化結果に合わせる。画面固有コンポーネントに Chrome API や IndexedDB を直接埋め込まず、Application 層の型付きポートを介して呼び出す。

## 拡張機能ポップアップ

ポップアップは保存の自動実行画面ではなく、次の2操作を選ぶ入口である。

1. `このページをブックマーク`
2. `Bookmation ホームを開く`

### 表示内容

- 現在ページのタイトル、ドメイン、ファビコン。取得できない値には代替表示を使う。
- 保存操作を第一ボタン、ホーム表示を第二ボタンとして置く。
- ポップアップを開いただけでは Bookmark を作成しない。
- 保存できない scheme では保存操作だけを無効化し、理由を表示する。
- 保存完了後は `保存しました`、`ホームで見る`、`元に戻す` を表示する。

### 状態機械

`idle -> saving -> saved` を基本とし、`unsupported`、`alreadySaved`、`failed` を別状態にする。React の boolean を複数組み合わせて矛盾状態を作らず、discriminated union で表現する。

```ts
type CaptureState =
  | { status: "idle"; tab: CapturableTab }
  | { status: "unsupported"; reason: string }
  | { status: "saving"; tab: CapturableTab }
  | { status: "saved"; bookmarkId: string }
  | { status: "alreadySaved"; bookmarkId: string }
  | { status: "failed"; errorCode: string; retryable: boolean }
```

ポップアップが閉じても保存処理は失われないよう、永続化は Background Service Worker 側のユースケースで開始する。UI は再度開いたときに requestId または Bookmark の状態を読み直す。

## commands とショートカット表示

Manifest には次の2 command を別々に宣言する。

- `save-current-page`
- `open-bookmation-home`

`save-current-page` は現在タブを保存し、`open-bookmation-home` は既存の Bookmation タブがあればフォーカスし、なければ `#/home` を開く。OS・Chrome の予約キーと競合し得るため、UI 文書では固定キーを確定しない。設定画面は `chrome.commands.getAll()` 相当の取得結果から実際の割当を表示し、Chrome のショートカット設定への案内を出す。

保存ショートカットはポップアップを開かず実行できる。成功・既存・失敗はツールバーアイコンの短時間バッジへ反映し、次回ホーム表示時にも結果を確認できるようにする。通知権限はこのフィードバックだけを理由に必須化しない。

## 拡張機能ページと route

Plasmo のタブページを単一の AppShell とし、hash route で画面を分ける。拡張機能ページ内だけで完結するため、サーバー側 route は不要である。

| route | React view | URL に保持する状態 |
| --- | --- | --- |
| `#/home` | `RecentBookmarksPage` | 並び順、表示形式、列数 |
| `#/bookmarks?tag=<tagId>` | `TaggedBookmarksPage` | tagId、並び順、表示形式、列数 |
| `#/search?target=tags` | `TagSearchPage` | 検索対象。検索文は一時状態に置く |
| `#/search?target=bookmarks` | `BookmarkSearchPage` | 検索対象、並び順、表示形式、列数。検索文は一時状態に置く |
| `#/bookmark/<bookmarkId>` | `BookmarkDetailPage` | bookmarkId、戻り先。検索文は保持しない |
| `#/add-url` | `AddUrlPage` または route modal | 戻り先だけ。入力中 URL は React 状態に置く |
| `#/settings` | `SettingsPage` | 必要な subsection だけ |

route の解析と直列化を1つの adapter に集約し、不正な tagId、view、columns は安全な既定値へ戻す。自然言語の検索文、AI prompt、検索候補、ページカーソルは URL に保存しない。戻る操作では検索対象、選択タグ、表示形式、スクロール位置を可能な範囲で復元する。

## AppShell

デスクトップでは、上部固定ツールバー、中央コンテンツ、右追従タグメニューの3領域を持つ。Chrome の既存ブックマークやフォルダを表示する左ツリーは作らない。

| 領域 | 主なコンポーネント |
| --- | --- |
| 上部 | `HomeLink`、`AddUrlButton`、`NaturalLanguageSearch`、`SortSelect`、`ViewModeControl`、`ColumnCountSelect` |
| 中央 | ページ見出し、`ActiveConditions`、`BookmarkCollection`、空・読込・エラー状態 |
| 右 | `TagSidebar`、`TagSection`、`TagNavItem`、タグ作成・編集操作 |

ホームでは `savedAt desc` の最近追加一覧を表示する。右サイドメニューのタグを選ぶと `#/bookmarks?tag=<tagId>` へ遷移し、AppShell と表示設定を維持したまま中央だけを更新する。

右サイドメニューはデスクトップで `position: sticky` 相当とし、viewport 内で独立スクロールさせる。狭い幅では `TagDrawer` に変形し、閉じた後も選択 tagId を route に保持する。

## タグ UI と不変条件

### メインタグ

- 作成、改名、削除は利用者の明示操作からだけ実行する。
- AI は既存メインタグを分類候補として返せるが、新規作成、改名、削除はできない。
- `AI が作成` という操作や、AI 生成中のメインタグ表示を実装しない。
- 1件の Bookmark に複数のメインタグを関連付けられる。

### サブタグ

- 利用者と AI のどちらも作成できる。
- AI は既存の利用者定義サブタグを最初に候補化し、適切な候補がない場合だけ新規作成できる。
- AI 作成サブタグには文字による `AI` 表示を付ける。
- 1件の Bookmark に複数のサブタグを関連付けられる。

### 重なりと同名表示

タグ関連は many-to-many とし、同じタグを複数 Bookmark へ再利用できる。メインタグとサブタグは厳密な親子ツリーとして扱わず、右サイドメニューでは2セクションに分ける。同じ表示名を持つ別 ID を React key や選択状態で混同せず、種類、関連件数、補足文脈を表示する。

作成フォームは既存の完全一致・類似候補を先に示すが、利用者が選んだタグの重なりを禁止しない。統合時は移動件数を事前表示し、別 ID を表示名だけで自動統合しない。

`CreateTagDialog` は右サイドメニューと `BookmarkEditor` の両方から開ける。`kind` を MAIN / SUB から利用者が明示選択し、同名候補をID、種類、作成元、利用件数付きで先に表示する。候補を再利用する操作とは別に `同名の別タグとして作成` を用意し、その確認後は新しい作成要求IDで保存する。AI 経路からこの dialog を MAIN 作成済みとして完了させない。

## AI サブタグ細分化度

`GranularitySlider` は1〜5の離散値とし、現在値、意味ラベル、1回の分類で AI が新規作成できるサブタグ上限を同時に表示する。

| 値 | ラベル | 新規サブタグ上限 |
| --- | --- | --- |
| 1 | 既存のみ | 0 |
| 2 | 粗い | 1 |
| 3 | 標準 | 2 |
| 4 | 細かい | 4 |
| 5 | 詳細 | 6 |

この設定は新規サブタグ生成だけに作用する。AI のメインタグ生成、既存タグの再利用数、過去 Bookmark の自動再分類には作用させない。値変更時は `既存サブタグを優先し、なければ最大2件を作成。メインタグは作成しません` のような結果予告を表示する。

## 自然言語検索

`NaturalLanguageSearch` は対象を `タグ` と `ブックマーク` から選ぶラジオグループ、検索 input、候補 popup で構成する。1つの曖昧な検索結果へ混ぜず、対象ごとの view model と route を持つ。

### タグ検索

候補は次の表示モデルに正規化する。

```ts
type TagCandidateView = {
  tagId: string
  name: string
  kind: "MAIN" | "SUB"
  bookmarkCount: number
  reason: string
  source: "USER" | "AI"
}
```

- 自然言語に合う候補を複数返す。最上位1件へ自動決定しない。
- 候補選択で `#/bookmarks?tag=<tagId>` へ進む。
- 同名候補は tagId、種類、件数、補足文脈で区別する。

### ブックマーク検索

```ts
type BookmarkCandidateView = {
  bookmarkId: string
  title: string
  domain: string
  savedAt: string
  tagCount: number
  mainTags: TagChipView[]
  subTags: TagChipView[]
  reason: string
}
```

- タイトル、URL、保存日時、タグ、利用可能なメタデータから複数候補を返す。
- 閉じた候補行はタグ件数だけを示し、候補内の disclosure で全 MAIN / SUB を表示する。
- 候補の主操作は Bookmation 内の詳細表示とし、外部ページは別の明示操作にする。
- `すべての候補を見る` で検索結果ページへ移動する。

### 検索状態

```ts
type SearchState<T> =
  | { status: "idle" }
  | { status: "composing" }
  | { status: "debouncing"; query: string }
  | { status: "preparingModel"; query: string; progress?: number }
  | { status: "searching"; query: string }
  | { status: "ready"; query: string; candidates: T[] }
  | { status: "empty"; query: string }
  | { status: "textFallback"; query: string; candidates: T[] }
  | { status: "failed"; query: string; retryable: boolean }
```

IME composition 中は検索を発火しない。検索 requestId と query fingerprint を照合し、遅れて届いた古い応答で新しい候補を上書きしない。AI が利用できない場合は文字列検索へ縮退し、自然言語検索結果でないことを画面に明示する。

## URL 指定保存

`AddUrlForm` は URL input、メタデータ preview、タグ候補、保存結果を段階表示する。

1. `http:` / `https:` の形式と長さを同期検証する。
2. メタデータ取得を開始し、取得中も入力値を失わない。
3. preview を確認して保存する。取得失敗時は URL をタイトル代替にして保存できる。
4. Bookmark と分類 job を先に永続化し、既存メインタグ候補とサブタグ分類を後続処理にする。
5. 重複 URL 候補があれば、既存項目を開く、既存項目へタグを追加する、別項目として保存する、を選ばせる。

ダイアログとして表示する場合は背景を inert にし、フォーカスを閉じる操作へ復元する。保存中の二重送信を防ぎ、失敗が永続化前か後続メタデータ取得だけかを区別する。

## 一覧表示

### 表示モード

`ViewModeControl` は `リスト / グリッド / 弁当` のラジオグループとして実装する。

| モード | React 表現 | 列数設定 |
| --- | --- | --- |
| リスト | 横長の1件1行 | 非表示 |
| グリッド | 同一基本サイズのカードを CSS Grid に配置 | `自動 / 2 / 3 / 4 / 5 / 6` |
| 弁当 | 決定的な大小 span を持つ CSS Grid | `自動 / 2 / 3 / 4 / 5 / 6` を基準列数として利用 |

`gridColumns` と `bentoColumns` は別設定として保持する。画面幅に収まらないときは実列数だけ減らし、設定値を破壊しない。弁当表示の大カードはピン留めまたは固定パターンで決め、AI の確信度や検索 score を重要度として流用しない。

### BookmarkCard

表示モードに関係なく、同じ Bookmark 行動と意味を提供する。

- タイトル、ドメイン、ファビコン、利用可能なサムネイル
- 保存日時、分類状態
- `タグを表示（N件）` の disclosure。閉じた状態ではタグ名を表示しない
- 詳細、元ページ、編集、再分類、アーカイブ、削除

disclosure を開くと、付与された全メインタグと全サブタグを種類別に描画する。閉じた状態は `タグ N件`、0件は `タグなし` とし、どちらかの種類だけを常時表示しない。メインタグを1件に限定せず、タグ ID を key とする。`aria-expanded` と `aria-controls` を設定し、展開後もボタンへフォーカスを残す。

### 追加読込

カーソル方式を使い、自動追加読込と `さらに読み込む` ボタンを併設する。読込済み項目を失わず、追加件数を live region で通知する。可変高になるタグ展開と弁当表示では、仮想化導入前にフォーカス・スクロール復元を実測する。

## React 状態管理

| 種類 | 例 | 保存先 |
| --- | --- | --- |
| ドメイン状態 | Bookmark、Tag、BookmarkTag、分類 job | IndexedDB。Repository を唯一の正とする |
| 永続設定 | view、gridColumns、bentoColumns、細分化度、検索初期対象 | `chrome.storage.local` |
| route 状態 | 画面、tagId、検索対象、並び順 | hash route と query |
| 検索一時状態 | 自然言語の検索文、候補、requestId | React state。既定では永続化しない |
| 一時 UI 状態 | 開いている disclosure、dialog、入力中 URL、hover | React local state |
| サーバー相当の取得状態 | 一覧、候補、job 状態 | query cache。永続データの正にしない |

更新成功後は影響する query key だけを無効化する。表示名を ID の代わりに key や filter として使わない。Service Worker が停止・再起動しても、起動時の再取得で回復できるようにする。

## Service Worker との通信

- メッセージは `requestId`、`type`、`payload`、`schemaVersion` を持つ discriminated union にする。
- 応答は `ok` と `data`、または `errorCode` と `retryable` を返す。
- 保存、URL追加、自然言語検索、タグ候補、分類結果に別の message type を割り当てる。
- UI は応答順を信頼せず、requestId と query fingerprint を確認する。
- HTML、任意コード、Prompt API session をメッセージや React 永続状態へ入れない。
- Background は main tag の AI 新規作成を拒否し、UI 側の誤表示だけに規則を依存させない。

## AI Host Document

Chrome Prompt API の LanguageModel を Web Worker から利用しない。実機で対応を確認したトップレベル拡張機能ページだけを AI Host 候補とする。

- Bookmation ページ表示時に利用不可、モデル未取得、準備中、利用可能を区別する。
- ユーザー操作が必要なら説明付きボタンからモデル準備を開始する。
- 保存分類では、既存メインタグ ID と既存サブタグを候補として受け取り、main は既存 ID だけ、sub は再利用優先・上限付き新規候補として返す。
- 自然言語検索では候補 ID、順位、短い理由を返し、UI が最上位1件へ自動遷移しない。
- 外形スキーマを検証して Background へ返し、Domain 側で再検証する。
- AI Host を閉じても Bookmark は保存済みのまま、job は再試行可能な状態にする。

## コンポーネント構成

| コンポーネント | 責務 |
| --- | --- |
| `PopupApp` | 現在ページ情報、2操作、保存状態 |
| `AppShell` | 上部、中央、右サイドメニュー、responsive layout |
| `NaturalLanguageSearch` | 対象切替、IME、安全な候補 popup |
| `TagCandidateList` | 複数タグ候補、種類、件数、一致理由 |
| `BookmarkCandidateList` | 複数 Bookmark 候補、タグ、一致理由 |
| `TagSidebar` | MAIN / SUB の2セクション、選択、件数、管理 |
| `CreateTagDialog` | MAIN / SUB の利用者作成、既存候補の再利用、同名別 ID の確認作成 |
| `ViewModeControl` | リスト・グリッド・弁当の切替 |
| `ColumnCountSelect` | グリッド・弁当の基準列数 |
| `BookmarkCollection` | page query、追加読込、空・エラー状態 |
| `BookmarkCard` | 3表示で共通の意味と操作 |
| `BookmarkTagsDisclosure` | 付与された全 MAIN / SUB タグの開閉表示 |
| `AddUrlForm` | URL検証、preview、保存、重複候補 |
| `GranularitySlider` | AI 新規サブタグ上限と結果予告 |
| `ClassificationStatus` | 待機、分類中、要確認、失敗、main未設定 |
| `AiHostController` | 対応ページでのモデル準備、分類、検索 job |
| `ConfirmDialog` | 削除、統合、再分類、重複 URL の確認 |

コンポーネントは Tailwind class を組み立てても、作成者制約、関連数、上限などの Domain 規則を持たない。規則は Application / Domain 層に置く。

## Tailwind 方針

- 色、間隔、radius、shadow、文字サイズを意味のある token としてまとめ、任意値の乱立を避ける。
- MAIN / SUB / AI の区別を色だけで表現せず、文字ラベルと形を併用する。
- `focus-visible` の ring を全 interactive element で統一する。
- popup、タブページ、dialog で共通 component style を再利用する。
- 動的 class 名を文字列結合だけで生成して production build から欠落させない。
- dark mode は要件化されるまで未完成の toggle を出さない。

## アクセシビリティ

WCAG 2.2 AA を目標にするが、実装前のため適合を主張しない。

- ポップアップの2操作は native button とし、保存ボタンへ自動フォーカスして Enter で誤保存させない。
- 検索対象は radio group、検索候補は combobox / listbox の正しい関係を持たせる。
- 表示形式は radio group、列数は label 付き select、細分化度は label と現在値を持つ slider にする。
- 右サイドメニューの選択は `aria-current`、カードのタグ開閉は `aria-expanded` と `aria-controls` で通知する。
- drawer と dialog はフォーカスを閉じ込め、閉じたときに起点へ戻す。
- 弁当配置でも DOM 順と視覚順を一致させる。
- 200% 拡大、キーボードのみ、スクリーンリーダー、日本語 IME を実機確認する。
- 通常文字と背景のコントラスト比 4.5:1 以上、主要操作のタッチ対象 44×44 CSS px 程度を目標にする。
- `prefers-reduced-motion` を尊重する。

## レスポンシブ方針

- 1200px 以上: 上部固定バー、中央一覧、右追従サイドメニュー。
- 768〜1199px: 中央を維持し、右サイドメニューを drawer 化する。
- 767px 以下: 1列を基本とし、検索候補とタグを全幅 overlay で表示する。
- 指定列数が収まらない場合は実列数を縮退する。横スクロールで指定列数を無理に維持しない。

breakpoint は初期案であり、カード最小幅、popup 幅、200% 拡大の実測後に調整する。

## エラー表示

| 状態 | 表示 | 次の操作 |
| --- | --- | --- |
| 現在ページ保存不可 | 対象 scheme と理由 | ホームを開く、URL追加 |
| Bookmark 保存失敗 | 保存されていないこと | 再試行、容量確認 |
| メタデータ取得失敗 | URLは保存可能であること | URLだけで保存、再試行 |
| AI 利用不可 | 文字列検索と手動タグ付けが使えること | 手動操作、利用条件を確認 |
| モデル準備中 | 取得可能なら進捗 | ページを開いたままにする、後で再試行 |
| 自然言語検索失敗 | 古い候補と区別したエラー | 再試行、文字列検索 |
| 分類失敗 | Bookmark は保存済み、main tag 未設定 | 再試行、手動編集 |
| サムネイル失敗 | 代替面 | サムネイルなしで継続 |
| 追加読込失敗 | 読込済み一覧を維持 | その位置で再試行 |

## フロントエンド検証

- popup: 2操作、保存不可 scheme、保存中二重操作、既存、失敗、再表示後の状態回復。
- commands: 現在ページ保存とホーム表示が独立し、既存ホームタブを再利用する。
- URL追加: 有効・無効 URL、メタデータ失敗、重複候補、保存後の取消。
- ホーム: `savedAt desc`、0件、追加読込、保存直後の反映。
- タグ: main の手動作成限定、sub の手動作成、main/sub の複数関連、同名別 ID の確認作成、右メニュー選択、閉じた状態の中立表示、全タグ disclosure。
- AI: main 新規作成拒否、user subtag 優先、細分化度上限、main 未設定での保存継続。
- 検索: タグ/Bookmark の対象切替、複数候補、IME、0件、古い応答、文字列 fallback。
- 表示: 3形式、grid/bento 別列数、responsive 縮退、条件維持、弁当 DOM 順。
- accessibility: axe 等の自動検査に加え、キーボード、screen reader、200% 拡大を手動確認する。
- lifecycle: Service Worker 停止後の再接続、AI Host を閉じたときの job 回収、AI 遅延中の保存を確認する。
- performance: 1万件程度のダミーデータ、タグ多数、画像多数、可変高カードで計測する。

これらは実装後の検証項目であり、現時点で合格済みではない。
