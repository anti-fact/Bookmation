# フロントエンド設計

- 状態: 設計決定・UI-01 primitive／Web component sheet、UI-02 App Shell／hash route／共通header、UI-03 popup／shortcut／保存状態、UI-04 Bookmark LIST／GRIDを実装済み
- 更新日: 2026-08-23
- 採用: Plasmo + React + TypeScript + Radix Primitives + Tailwind CSS
- 関連: [UI](./UI.md) / [設計](./DESIGN.md) / [要件](./REQUIREMENTS.md) / [実装ガイド](../FRONTEND_GUIDE.md) / [テスト](./TESTING.md)

画面構成、外観、部品、状態を含む実装判断は [REQUIREMENTS.md](./REQUIREMENTS.md) と [UI.md](./UI.md) をFigmaより優先する。Figmaとrepository内SVGは、仕様書に未記載の視覚詳細だけを補う参照資料とする。

## エントリポイント

| entry                | 責務                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `src/popup.tsx`      | 保存／ホームの2操作、ショートカット表示、変更案内                                             |
| `src/tabs/index.tsx` | welcome、一覧、検索、カテゴリ・タグ、設定、各overlay、AI Host                                 |
| `src/background.ts`  | install、commands、contextMenus、alarms、保存、履歴判定、DB、メッセージ。Prompt APIは呼ばない |

`chrome.runtime.onInstalled` のinstall時だけ拡張タブの `#/welcome` を開く。update時や通常起動で開かない。popupは `chrome.commands.getAll()` のallowlistだけを表示し、空の割当は `未割り当て` とする。

UI-03ではproduction popupを薄いentryとし、`PopupApp`へ`PopupPort`を注入する。Chrome adapterは2 commandの実キー取得、現在ページ保存message、`#/home`を開く操作、`chrome://extensions/shortcuts`への案内だけを担当する。画面は開いただけで保存せず、保存中／成功／重複／失敗を同じpopup内のlive regionへ残す。popup本体は3pxのink外枠と8px角丸を持ち、Chromeの白いnative popup surfaceとの間に2pxの均一な余白を置く。現行Service Workerの保存Applicationは未実装のため、実Bookmark保存と重複判定はTASK-004の接続後に完了する。

テスト用Webプレビューはproduction entryではない。本番と同じpage componentへfake Portを注入し、Chrome API、Repository、AI、Drive、camera等を置換する。UI-03 popupは `?view=popup&fixture=assigned` を入口に、割当済み／未割当、保存中／成功／重複／失敗、shortcut取得失敗を切り替える。fixture/debug UIを本番buildへ含めない。

UI-04では`BookmarkListPage`へ`BookmarkListPort`を注入し、productionではIndexedDBのactive Bookmark／Label edgeと`chrome.storage.local`の表示形式設定へ接続した。最近追加、カテゴリ条件、タグ条件を`savedAt desc`でcursor取得し、GRID／LIST、カテゴリ常時表示、タグ展開、件数、追加読込、再試行、終端、トップへ戻るを同じ画面で扱う。Webプレビューは `?view=bookmarks&fixture=grid#/home` を入口に、GRID／LIST／空／1件／多数／読込中／初回失敗／追加失敗をfake Portで再現する。

## routes と一時状態

| route                       | component                            |
| --------------------------- | ------------------------------------ |
| `#/welcome`                 | `WelcomePage`                        |
| `#/home`                    | `BookmarkListPage`（最近追加）       |
| `#/bookmarks?category=<id>` | `BookmarkListPage`（親カテゴリ条件） |
| `#/bookmarks?tag=<id>`      | `BookmarkListPage`（子タグ条件）     |
| `#/search?q=<query>`        | `SearchResultsPage`                  |
| `#/labels`                  | `FullScreenCategoryTagPage`          |
| `#/settings/general`        | `SettingsPage` 一般                  |
| `#/settings/archive`        | `SettingsPage` アーカイブ            |
| `#/settings/share`          | `SettingsPage` 共有                  |

`BookmarkEditDialog`、`CategoryTagCreateDialog`、`CategoryTagEditDialog`、`AddUrlDialog`、`AiAgentPopup` はroute上へ重ねる。キーワードqueryはhash routeへ保持し、AI会話、編集draft、候補cursorは永続化しない。

UI-02では上表の9 routeを型付きでparse／serializeし、Plasmo dashboard entryから共通App Shellへ接続した。`AppHeader`は `default`／`labels`／`settings` の3 variantを共有し、icon-only操作はaccessible name付きの`IconButton`とpointer／focusの両方で開く`Tooltip`を使う。route変更後はmain headingへscrollさせずにfocusし、ブラウザの戻る／進むではrouteごとのscroll位置を復元する。描画例外は`ErrorBoundary`のfallbackへ隔離する。

UI-04により`#/home`と`#/bookmarks?category=<id>`／`?tag=<id>`／`?category=<id>&tag=<id>`は実Bookmark一覧を描画する。複合条件はカテゴリとタグの積集合とし、toolbarから各条件を解除できる。他のroute本文は引き続きshell確認用であり、検索候補、AI dialog、カテゴリ・タグ管理、設定form等のfeature実装を含まない。通常Webプレビューはcomponent sheetを `http://127.0.0.1:4173/`、App Shellを `http://127.0.0.1:4173/?view=app-shell#/home`、Bookmark一覧fixtureを `http://127.0.0.1:4173/?view=bookmarks&fixture=grid#/home` から確認する。実拡張のPlaywright E2E scriptと人間による実Chrome受入は未完了である。

## コンポーネント境界

| component                        | 責務                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `WelcomePage`                    | 初回説明、開始、再開可能な初期設定、カテゴリテンプレートstepの進行                                       |
| `CategoryTemplateStep`           | 同梱catalogの表示、未適用preview、利用者操作によるCategory作成。具体的な選択controlはISSUE-022で確定する |
| `BookmarkListToolbar`            | 現在位置、件数、LIST / GRID。App Headerの下に通常配置し追従させない                                      |
| `BookmarkList` / `BookmarkItem`  | cursor描画、カテゴリ常時、タグdisclosure、編集                                                           |
| `SearchBox`                      | 最大8件typeahead、検索ページ遷移                                                                         |
| `SearchSuggestionList`           | カテゴリ・タグ上／Bookmark下のcombobox                                                                   |
| `SearchResultsPage`              | フルページ結果と種類別cursor                                                                             |
| `AiAgentPopup`                   | AI入力、応答、検索候補、製品ヘルプ                                                                       |
| `FullScreenCategoryTagPage`      | 親カテゴリごとの子タグ、通常／管理モード                                                                 |
| `StickyCategoryTagHeader`        | 統合検索、AI検索、新規作成dropdown、管理、閉じる                                                         |
| `CategoryRibbon` / `TagChip`     | 遷移、管理時の編集trigger                                                                                |
| `BookmarkAddDialog`              | URL、任意title、Tagの順次追加、TagからのCategory自動導出、保存                                            |
| `BookmarkEditDialog`             | title、URL、Tagの順次追加／解除、TagからのCategory自動導出、削除                                          |
| `BookmarkTagField`               | 空の入力、最大8件のリアルタイム候補、`タグ n件`／`追加`、展開済みTag chip、個別解除                        |
| `ExistingTagCombobox`            | 親Category付き既存Tagを最大8候補から1件ずつ解決し、`BookmarkTagField`へ渡す                                |
| `ParentCategoryCombobox`         | Tag作成／編集時にactiveな既存Categoryを最大8候補から単一選択                                             |
| `LabelCreateSideView`            | Bookmark／Tag draftを保持した同一Dialog内の新規作成                                                      |
| `CategoryTagCreateDialog`        | 種類別の連続作成                                                                                         |
| `CategoryTagEditDialog`          | 名前、Tagの親Category変更、Categoryの使用中Tag／関連Bookmark件数、種類別削除導線                         |
| `CategoryCascadeDeleteDialog`    | Category、子Tag、影響Bookmarkを示す連鎖削除警告                                                          |
| `SettingsPage`                   | 一般／アーカイブ／共有のサイドナビ                                                                       |
| `VisitReminder`                  | はい／いいえ／URL単位の次回抑止                                                                          |
| `ArchiveManager`                 | checkbox選択と一括復元                                                                                   |
| `DriveAccountPanel`              | account選択、同期、権限、競合                                                                            |
| `QrSharePanel` / `QrImportPanel` | 対象選択、生成、読取、取込                                                                               |
| `ChromeBookmarkImportPanel`      | 権限説明、直上Folder別preview、Tag再利用／新規Tagの親Category解決、進捗、結果                            |
| `BackToTopButton`                | 閾値後のscroll／focus                                                                                    |

## 状態管理

| 状態                                                                                                         | 置き場所                                                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Bookmark / Category / Tag正本                                                                                | IndexedDB repository                                                 |
| onboarding状態／Category template step、LIST / GRID、訪問期間／日数、archive日数、reminder有効 | `chrome.storage.local`。catalog versionの永続形式はISSUE-022で決める |
| AI有効、AI細分化0〜4、設定revision | IndexedDB `classificationSettings` が正本。`chrome.storage.local` はUI mirror |
| categoryId、tagId、検索query、設定section                                                                    | hash route                                                           |
| AI conversation、dialog、side view、管理モード                                                               | React画面内state                                                     |
| cursor、requestId、hasNext                                                                                   | query state                                                          |
| 一覧へ戻るscroll anchor                                                                                      | navigation state                                                     |

React stateをデータ正本にしない。保存commandにはrevisionとidempotency keyを含め、完了応答後にquery cacheを更新する。

`CategoryTemplateStep` はcatalogを表示しただけではRepositoryへ書き込まない。利用者が適用を実行した時だけ、選ばれた候補を通常のCategory作成commandへ変換する。途中終了後は `onboardingState.currentStepId` から再開し、応答消失後の再送でも同じCategoryを重複作成しない。候補名、件数、set、初期選択、skip、名前編集、初回後の再表示UIはISSUE-022が決まるまで仮実装を本番へ入れない。

## 分類階層のUI不変条件

タグは `parentCategoryId` を必須とする。Bookmark draftはTag IDだけを編集対象にし、Category ID集合は選択済みactive Tagの親集合から導出する。

- タグ選択時は親カテゴリを導出結果へ追加する。
- タグ解除時、同じ親を必要とする他の選択中Tagがなければ導出結果から親カテゴリを外す。
- Tag編集では親Category comboboxを表示し、親変更はTag編集専用commandからだけ実行する。
- タグ候補には親カテゴリ、origin、利用件数を表示し、表示名ではなくIDをReact keyと選択値にする。

## 入力中キーワード候補

`SearchBox`、Bookmark追加／編集のTag combobox、Tag作成／編集の親Category comboboxは共通の正規化と候補primitiveを使う。日本語IMEのcomposition中は追加や確定検索を行わず、150〜250msを目安にdebounceする。

1. 正規化完全一致
2. 前方一致
3. token前方一致
4. 部分一致
5. 安定tie-break（表示名、親カテゴリ名、ID）

この順で候補を作り、検索ヘッダーは全種類合計8件、Bookmark追加／編集のTag入力はTag 8件、Tag作成／編集の親Category入力はactive Category 8件まで返す。候補は `role=option`、入力は `role=combobox` とし、`aria-activedescendant`、上下キー、Enter、Escを実装する。候補が9件以上でも8件だけ描画し、検索ヘッダーの確定検索だけが全画面結果へ移る。Bookmark追加／編集のEnterは選択中候補または正規化完全一致Tagをdraftへ1件追加し、親Category入力のEnterは既存Categoryの単一選択を確定する。いずれも未解決文字列をLabelとして作成しない。

## フルページ検索

Enterまたは検索ボタンで `#/search?q=<encoded>` へ遷移する。`SearchResultsPage` は上段にカテゴリ・タグ、下段にBookmarkを固定し、各グループのcursorと状態を分離する。カテゴリ選択はカテゴリ条件一覧、タグ選択はタグ条件一覧、Bookmark選択は詳細または元ページへ移る。戻る操作で元画面のqueryとscroll位置を復元する。

## AIエージェントポップアップ

`AiAgentPopup` はデザインシートの右下panelを基準とし、入力、送信、streaming／処理中、回答、候補カード、再試行、reset、closeを同一面に置く。画面遷移せず、会話はタブを閉じれば破棄する。

入力intentは次へ限定する。

- `SEARCH_LIBRARY`: 保存済みカテゴリ、タグ、Bookmarkの自然言語検索。
- `PRODUCT_HELP`: 版管理された機能カタログと現在のcapability stateに基づくBookmationの説明。
- `OUT_OF_SCOPE`: 対応範囲と利用可能な入口を案内する。

検索候補はカテゴリ・タグを先、Bookmarkを後にする。番号、score、最適表現は出さない。機能説明には実装済み／未実装／権限不足／AI利用不可を区別する。AI出力からmutation commandを発行せず、設定や削除は対象画面へのlinkだけを返す。AI非対応時は静的ヘルプとキーワード検索へ縮退する。

## LIST / GRID と無限スクロール

`ViewModeControl` は `LIST | GRID` のradio groupとする。弁当、列数設定、表示件数設定を持たない。GRID列数はresponsive CSSで決め、DOM順と見た目を一致させる。

`BookmarkItem` はカテゴリを常時描画し、タグはbutton disclosureで開閉する。`IntersectionObserver` のsentinelはloading中の同cursor要求を拒否し、requestId照合、ID dedupe、失敗位置の再試行、終端解除を行う。追加後にフォーカスを移さない。

UI-04ではこの一覧境界を実装済みである。表示形式は`chrome.storage.local`へ保存し、productionの`BookmarkListPort`はIndexedDBからactive Bookmarkとactive Label edgeを読んで表示用のカテゴリ／タグへ変換する。画像Blobの解決はTASK-010に残し、解決できない画像は外部URLへ接続せず同梱Bookmationロゴへ縮退する。カテゴリ・タグ一覧への導線はApp Headerの望遠鏡だけとし、secondary toolbarには重複buttonを置かず、画面scrollへ追従させない。編集buttonから開くmodalはUI-05で接続済みとし、検索候補と結果はUI-07、AI応答はUI-08で実装する。

## ブックマーク追加／編集とサイドビュー

追加と編集は同じTag field contractを使う。draftは次を持つ。

```ts
type BookmarkFormDraft = {
  title: string
  url: string
  tagIds: string[]
}
```

追加はURL、任意title、0件以上のTagで開始し、編集は既存Bookmarkの値をdraftへ読み込む。分類fieldはTagのcomboboxだけとし、入力文字列はモーダルopen時と追加成功後に空にする。既存tagIdsは入力欄へ連結せず、入力直下の展開済み一覧へ表示する。

`BookmarkTagField` は入力直下の操作行で `タグ n件` を左、`追加` を右へ配置する。選択中候補または正規化完全一致で解決したactive Tag IDを、`追加` またはcomposition中ではないEnterで1件だけtagIdsへappendする。成功時は入力、active descendant、候補、field errorをclearして入力へfocusを戻す。同じIDは重複させない。未解決文字列ではtagIdsを変えずfield errorを表示する。

現在Tagのdisclosureは初期openとし、全画面カテゴリ・タグ一覧と同じTag chip形状で描画する。各chipはBookmark一覧の`LabelRibbonTrail`と同じhover／focusの減光と中央解除buttonを持つが、accessible nameとkeyboard操作によりhoverなしでも削除できる。解除はBookmark自体のTag edge draftだけを変更し、Tag recordを削除しない。

Tag見出し横の `＋新規作成` は同じDialog内部を `FORM` から `CREATE_TAG` へ切り替え、親dialogを重ねない。戻るとBookmark draft、dirty state、検索語、focusを復元する。新規Tag作成成功時は返却IDをTag入力の解決済み選択へ設定し、`追加`／EnterでtagIdsへ確定する。Category ID集合は保存直前にactive Tagの `parentCategoryId` から重複なく導出し、利用者の入力値として保持しない。

Tag作成side viewではTag名draftと既存active Category 1件を保持する。作成時の親Category入力は空で開始する。親Categoryは最大8候補のcomboboxで、activeな正規化完全一致または候補選択時点に単一選択し、Category用の `追加` buttonは置かない。その説明横の `＋新規作成` で同じDialogを `CREATE_CATEGORY` へ切り替える。Category作成成功後はTag draftへ戻り、新Category IDを自動選択して元のTag名、dirty state、検索語を復元する。未解決のCategory文字列はfield errorとし、自由入力から作成しない。

削除は確認画面を開かず、専用の論理削除command成功後にdialogを閉じる。削除後の取り消しUI、token、利用者向け復元commandは実装しない。通信失敗やrevision conflictでは論理削除せず、dialogと入力を保持してエラーを表示する。

UI-05では`BookmarkDialog`と`BookmarkTagField`を追加し、追加／編集を同じfield contractへ統合した。productionの`BookmarkFormPort`はChrome message経由で既存Applicationへ接続し、Tag／Category候補、作成、Bookmark保存／更新／論理削除を扱う。作成request IDは同じdraftの再試行で再利用し、Applicationから返る安全なDomain error codeをfieldまたはdialog内のエラーへ変換する。Web fixtureでは追加、編集、同一Dialog内side view、削除後の一覧再読込をproduction componentのまま確認できる。

## カテゴリ・タグ一覧と管理モード

表示状態は `VIEW | MANAGE` とする。VIEWではCategoryRibbon／TagChip選択が絞込み遷移、MANAGEでは編集dialog起動になる。管理ボタンは `aria-pressed` を持ち、MANAGE中はデザインシートどおり反転表示する。鉛筆は `@media (hover: hover)` とfocus-visible時だけ補助表示し、操作名は常にaccessible nameへ含める。

ヘッダーの `新規作成` はmenu buttonで、`カテゴリ作成`／`タグ作成` 選択後に共通dialogを開く。カテゴリは名前、タグは名前と既存active Category 1件を必須とする。Tag作成のCategory comboboxは最大8候補とCategory作成side viewを持つ。

作成成功後もdialogは開いたまま入力を初期化し、session内作成結果を表示する。既存項目をBookmarkへ関連付けるUIは置かないが、Tag作成では必須の親として既存active Categoryを1件選択する。カテゴリ名とタグ名はそれぞれ論理削除中を含めて正規化後に全体一意とし、重複時はfield errorと既存項目の状態を示す。有効なら元の入力画面で既存項目を選び、論理削除中なら別名を入力するか物理GC完了を待つよう案内する。タグは親カテゴリが異なっても同名の別IDを作成できない。

Tag編集dialogは名前、親Category、作成元、利用件数を表示し、名前と親Categoryを編集可能にする。`ParentCategoryCombobox` は現在の親Category IDを選択済みで開始し、activeな正規化完全一致または候補選択によって入力を書き換えた時点でparentCategoryId draftを置き換える。Category用の `追加` buttonは置かない。説明横の `＋新規作成` から同じDialog内の `CREATE_CATEGORY` へ切り替える。Tagのname／parentCategoryId draft、dirty state、検索語、focusを保持し、Category作成成功後はTag編集へ戻って新Category IDを自動選択する。未解決文字列はfield errorとし、以前のCategory IDを文字列だけで上書きしない。Category編集dialogはactiveな子Tagの件数と実名チップ、関連active Bookmarkのunique件数をqueryして表示する。

Tag編集commandはexpected Tag revisionと選択した親Categoryのexpected revisionを持つ。submit開始時に `tag-update:<UUID>` requestIdを1回生成してpending stateへ保持し、応答消失を含む同一payloadのretryでは再利用する。入力変更後の再submitだけ新しいIDにする。Repositoryは新旧Category、Tag、参照する全active Bookmarkと関連edgeを1 transactionで再検証し、Tagの `parentCategoryId` を更新する。続けて各影響BookmarkのCategory edge集合を残存active Tagの親集合へ完全一致させ、Bookmark revisionと検索文書を更新する。Tag IDは維持するためAI再分類jobは作らない。Tag名はglobal uniqueなので親変更によって一意性判定を変えない。いずれかの競合や更新失敗時はtransaction全体をrollbackし、dialogとdraftを保持する。初回成功とreceipt再送は同じ `UpdateTagResult` へ収束させる。

BookmarkとTagの削除は確認なしで即時に論理削除し、削除後の取り消し機能は提供しない。Category削除は `CategoryCascadeDeleteDialog` を開き、同じdetail snapshotのCategory名、全active子Tagの件数と実名、影響active Bookmarkのunique件数、再分類の発生を警告する。明示確認後だけexpected revisionと `expectedImpactFingerprint` 付きcommandを送り、Category、全子Tag、関連edgeの論理削除と影響Bookmarkの再分類予約が同一transactionで成功してから閉じる。preview staleでは自動再送せず最新detailで警告内容を更新して再確認を求め、その他の失敗でも削除せず警告dialogとエラーを保持する。

## 設定画面

設定はmodalではなく `SettingsPage` とし、左サイドナビの一般／アーカイブ／共有をrouteで切り替える。

### 一般設定

- 訪問の集計期間: `select`。`1週間`／`1ヶ月`／`1年` を `LAST_7_DAYS`／`LAST_30_DAYS`／`LAST_365_DAYS` として扱う。
- 訪問日数: `input type=number`、整数、`min=1`、単位 `日`。既定値を設けず初回は空欄にする。期間未選択時はdisabledにし、期間変更時もdraft値を必ず空にして `max` を7／30／365へ切り替える。有効な期間と値の組を保存するまで判定状態を `REMINDER_CONFIG_REQUIRED` とする。
- リマインダー: switch。オン操作で権限説明とrequestを行い、拒否時はoffへ戻す。
- 右クリックメニューから保存: switch。`contextMenuBookmarkEnabled` の実効値を表示し、既定ONとする。変更中は再操作を抑止し、Application use caseの成功後だけ確定表示にする。登録／解除に失敗した場合は以前の実効値へ戻し、inline errorとlive regionで通知する。
- 自動アーカイブ: switch、既定OFF。ONのpointer／keyboard gesture内で説明後に `chrome.permissions.contains()`、必要なら `chrome.permissions.request({ permissions: ["history"] })` を呼ぶ。許可結果と設定保存が両方成功した時だけONにし、拒否／取消／例外ではOFFとinline errorを保つ。`permissions.onRemoved` と画面復帰時の再検査で権限取消を検出した場合もOFFへ戻す。
- アーカイブ日数: `input type=number`、整数、`min=1`、単位 `日`、既定値30。toggleがOFFでもdraftと保存値を保持する。
- AI細分化: `input type=range`、`min=0`、`max=4`、`step=1`。目盛、現在値、効果説明を表示する。

Frontendは整数0〜4だけを保存し、Tag件数上限へ変換しない。値ごとの説明は [UI.md](./UI.md) と一致させ、0は関連する既存Tagを強く再利用しつつ必要な `CORE` の新規作成を許し、4は明示された `DETAIL` まで新規作成へ傾くことを示す。候補単位で正常なTagは件数で切り捨てず全て採用する。

### アーカイブ管理

`ArchiveManager` は最小archive recordをlist表示し、checkboxの個別／全選択、選択件数、復元、部分失敗を扱う。復元後は一覧から成功項目だけ除き、失敗項目と理由を残す。background評価で `ARCHIVE_HISTORY_NOT_FOUND` になったBookmarkは別のエラー一覧にページ名／URLと `履歴がないためアーカイブできません` を表示し、アーカイブ済み一覧へ混ぜない。再確認controlはISSUE-009で決まるまで実装しない。

### 共有

`DriveAccountPanel` はGoogle account選択、接続状態、同期状態、競合を表示する。同一account同期は `appDataFolder`、別account共有は通常Drive fileとし、後者では対象fileのownership、permission、`capabilities` を確認する。`ShareExportPanel` はカテゴリ／タグ／Bookmarkのfilterと検索、checkboxを同じ選択setへ展開してID dedupeし、固定snapshotに対するQRとCSVの2つのexport actionを常時表示する。QR事前検査またはencoderが `QR_CAPACITY_EXCEEDED` を返した場合は部分QRを表示せず、選択を保持したerror panelのprimary actionを `CSVでエクスポート` にする。CSVはローカルでBlob化し、成功時だけobject URLをdownloadして直後にrevokeする。QR読取はcamera permissionを利用時に要求し、画像file fallback、preview、重複解決、import結果を持つ。CSV importは提供しない。

### Chrome標準Bookmark取込

`ChromeBookmarkImportPanel` はBookmarkを直上Folder単位でgroup化し、各行へページ名／URL、直上Folder名、付与予定Tag、親Category、解決状態を表示する。Folder tree全体を階層選択UIとして再現せず、祖先とfull pathは出所確認用に表示する場合も保存対象へ含めない。同名active Tagは既存の親Categoryとともに再利用表示にする。新規Tag groupでは `ParentCategoryCombobox` と `LabelCreateSideView` を再利用し、active Categoryの選択またはCategory作成後の自動選択を必須にする。空／不正Folder名、tombstone同名、親Category revision競合は項目skipまたは全体cancelとして表示し、暗黙renameやplaceholderを作らない。確定後はTagを1件だけ表示し、AI分類のpending表示を追加しない。

## 訪問リマインダー

`VisitReminder` は候補URL、期間内の訪問日数、はい、いいえ、`次回から表示しない` checkboxを表示する。`いいえ` はcanonical URL用の `countingResetAt` を応答時刻へ更新し、それ以前の訪問を次回判定から除外する。checked時はリセットではなくURL用suppression commandを送り、global reminder settingを変更しない。保存を選んだ場合も共通保存commandへ渡し、成功前に保存済み表示へしない。

## AI Host とメッセージ

Prompt APIは対応を実証したトップレベル拡張ページのadapterでだけ実行する。AI Hostは [AI_GUIDE.md](./AI_GUIDE.md) の固定promptでCategory 1件と上限なしのTag候補を返す。Service Workerはattempt token、分類Job、検索候補集合、製品ヘルプversion、AI出力の全体schemaと候補単位のID／revision／親／importance／根拠を検証する。正常候補1件以上ならpendingApplyを経て全正常候補を原子的に適用して終了する。3 dispatchすべてquality-zeroならNEEDS_REVIEW、technical failure込みの枯渇ならFAILEDとする。UI再接続はmodelAttemptに数えず、所有者なし／期限切れleaseの所有権取得transaction成功だけをexecutionAttemptに数える。staleは候補queryのfingerprint再計算で検出し、旧Jobを原子的に取消す。現在設定がCONFIGUREDかつenabledの場合だけactiveInputKey付きの最新Jobをget-or-createし、disabled／再設定待ちは差替えない。

メッセージはdiscriminated union、schemaVersion、requestId、entityRevisionを持ち、送信元とaction allowlistを検証する。AI conversationは永続jobにせず、候補外IDや古いqueryIdを破棄する。

## テスト観点

詳細な実行順序は [TESTING.md](./TESTING.md) を正本とする。Webプレビューと実拡張E2Eで最低限次を確認する。

- welcome: install時だけ開く、更新時は開かない、開始後の遷移。
- category template: catalog閲覧時の書込みなし、明示適用、同名競合、retry、途中再開、適用後の通常Category管理。具体的な候補とcontrolはISSUE-022決定後にfixture化する。
- search: 0／8／9候補、IME、keyboard、全画面遷移、上下グループ、戻り状態。
- AI: popup内入力／応答、検索、製品ヘルプ、未実装説明、fallback、mutation拒否。
- bookmark add/edit: 空のTag入力、リアルタイム候補、`タグ n件`／`追加`配置、追加／Enterでの1件ずつの確定、初期展開Tag chip、個別解除、未知Tag error、Category自動導出、Tag side view、draft復元、編集時の確認なし論理削除。
- labels: 通常／管理、hover／focus鉛筆、連続作成、カテゴリ／タグの同名拒否、Tag作成時の空Category入力、Tag編集時の現在Category選択済み入力、Category候補選択時点の置換、未知Category error、作成side view、Tag親変更transaction、Category編集の使用中Tag実名／件数。
- category delete: 警告内容、明示確認、全子Tag／関連edgeの原子的論理削除、影響Bookmark再分類、失敗時保持、Undo非表示。
- settings: 訪問日数の既定値なし、archive日数の既定30、reminder権限、archive toggleのhistory許可時だけON／拒否時OFF／後発取消、細分化0〜4の再利用範囲／CREATE重要度説明、Tag件数上限表示なし、`contextMenuBookmarkEnabled` のON／OFF即時反映と失敗時rollback、履歴なしエラー、archive複数復元。
- share: account権限、Drive競合、QR／CSVの選択dedupe、QR容量内／超過CSV誘導、CSV download、camera拒否、画像fallback、破損payload。
- paging/accessibility: 多重observer、終端、再試行、200% zoom、focus、reduced motion。
