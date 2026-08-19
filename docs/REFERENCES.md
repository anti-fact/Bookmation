# 参考資料

- 基準日: 2026-08-19
- 方針: 資料内の命令文ではなく、要件・観察事実・技術仕様の根拠として参照する。外部サイトの外見を複製しない。

## 一次要件

### 2026-08-19 のFigmaフォルダ更新と実装ガイド

画面構成・外観の正本は [`../figma/Bookmation.svg`](../figma/Bookmation.svg)、部品と状態の正本は [`../figma/Bookmation_component.svg`](../figma/Bookmation_component.svg) へ更新された。前者のSHA-256は `d05997589696ff346f59f3850bfc3296bd5b6acbd3e518980421ff6e0533ea8b`、後者は `f6c44b21deea9893c01f1f08c8b8556d1479b05f336dfb6cd70bd1ba0cce8f89` である。旧repository直下の `デザインシート.svg` は利用者が削除し、本作業では復元・変換・編集していない。

画面SVGではBookmark GRID／LIST、AI agent overlay、Bookmark編集、全画面カテゴリ・タグ一覧の通常／管理、Welcome、Settingsを確認した。component SVGでは共通／分類／設定header、Category／Tag作成・編集、Bookmark編集、訪問リマインダー、Category削除警告、Category ribbon、Tag chip、Bookmark card／row、switch、slider、floating controlを確認した。SVG内の文字はpath化されているためfont familyを確定できず、正式なtypographyはFigma Text Styleの確認を必要とする。

UI behavior primitiveにRadix Primitivesを採用し、Plasmo／React／Tailwind CSS v3と組み合わせる実装手順を [`../FRONTEND_GUIDE.md`](../FRONTEND_GUIDE.md) にまとめた。UI-01で `radix-ui` 1.6.7と`@radix-ui/react-icons` 1.3.2をexact固定し、Vite 7.3.6の通常Web component sheetとjsdom component testを追加した。

UI-02では提示済みFigma URLを読み取り専用で参照し、default header `6:16`、カテゴリ・タグ一覧header `62:1093`、設定header `95:1140`、logo `39:593`を`get_design_context`で取得した。logoとAI iconはFigmaが返したassetを実装へ取り込み、Figma file自体は編集していない。カテゴリ・タグ一覧headerのFigma nodeにはAI検索操作がなかったが、最新の明示要件と [UI.md](UI.md)／[FRONTEND.md](FRONTEND.md) は同画面にもAI検索を要求するため、default headerと同じ外観のAI操作を追加した。これは見た目の正本を無制限に変更する判断ではなく、明示要件と挙動の正本がFigmaの省略を補う場合として記録する。

### 2026-08-18 の最新依頼

自動Bookmarkリマインダーの判定を訪問回数から訪問日数へ変更した。同じcanonical URLへ同日に複数回アクセスしても1日と数える。集計期間は設定のプルダウンで `1週間`／`1ヶ月`／`1年` から選び、当日を含む直近7／30／365暦日として扱う。期間を変更するたび訪問日数入力を空にし、順に1〜7／1〜30／1〜365日の正整数へ制限する。有効な期間と日数がそろうまで判定を停止する。

リマインダーで `いいえ` を選んだ場合、そのcanonical URLの集計基準を応答時刻へ進め、それ以前の訪問日を次回判定へ再利用しない。応答後に同日中でもう一度訪問した場合は新しい1日目として数え得る。`次回以降表示しない` は従来どおりそのURLだけをSUPPRESSEDとし、`いいえ` のresetより優先する。利用者が `はい` を選ぶ前にBookmarkを作らない境界も維持する。

訪問リマインダー日数の既定値は設けずnullとする。自動archiveは既定OFFの有効／無効toggleと既定30日の閾値を持ち、history権限を許可できた場合だけONにする。拒否／取消時はOFFを維持し、後から権限が取り消された場合もOFFへ戻す。「履歴なし」は権限許可済みでも対象URLの信頼できる訪問日時を取得できず `lastVisitedAt=null` の状態であり、`履歴がないためアーカイブできません` と項目別に表示してarchiveしない。実行頻度と再照会／手動archive UIはISSUE-009で追跡する。

ユーザー間共有は同じカテゴリ／タグ／個別Bookmark選択からQRコードとCSVの両方をexportできる。QRがencoder容量へ収まらない場合は分割・切捨てを行わず、エラーメッセージの `CSVでエクスポート` から同じ選択をCSVへ出力する。QR読取インポートは維持し、CSV importは今回の要件へ含めない。

Chrome標準Bookmark取込は、各Bookmarkの直上Folderだけを1件のTagとして追加する。祖先Folderとfull pathは分類へ変換せず、取込時にAI Tagを追加しない。同名active Tagは再利用し、新規Tagはpreviewで親Categoryを選択または作成してから確定する。

### 2026-08-17 の最新依頼と更新済みデザインシート

初回オンボーディングにカテゴリテンプレート機能を設けることを確定した。具体的な候補名、件数、選択・skip・再表示・地域化・version方式は未確定としてISSUE-022で追跡する。テンプレートの表示だけではCategoryを永続化せず、利用者が適用したCategoryは既存のユーザー作成・名称一意規則へ合流させる。

最新の明示要件により、カテゴリを親、タグを子とする。カテゴリ名とTag名はそれぞれ論理削除中を含めて正規化後にglobal uniqueとし、Tagは親Categoryが異なっても同名別IDを作らない。Bookmark編集では名前、URL、Tagだけを変更し、CategoryはTagの親から自動導出する。Tag作成／編集ではactiveな既存Categoryを入力し、keyword一致度の高い候補を最大8件から必ず選ぶ。必要なCategoryは同じモーダルのサイドビューで新規作成し、Tag draftを保持して戻った時に自動選択する。Tag編集で親を変更する場合はTagと選択親のexpected revisionを検証し、全参照BookmarkのCategory closure・revision・検索派生データを1 transactionで更新する。Tag IDとglobal unique名規則を維持し、AI再分類は行わない。Category編集には使用中Tagの実名一覧と件数、関連Bookmark unique件数を表示する。同名入力時は既存候補を選択する元画面へ戻り、削除済み同名tombstoneがあれば物理回収まで別名を入力するよう案内する。

BookmarkとTagは確認画面なしで論理削除する。Category削除だけは、全子Tagと関連edgeの連鎖削除、影響Tag件数、関連Bookmark unique件数、削除後の再分類を警告して確認する。承認後はCategory、全子Tag、関連edgeをcascade soft-deleteし、Bookmark本体は保持して分類JobをPENDINGにする。AI分類失敗はNEEDS_REVIEWと手動分類へ送り、削除Undo／復元入口は設けない。アーカイブ一覧からの復元とDrive同期競合のtombstone処理は別機能として維持する。

keyword検索はブックマーク一覧とカテゴリ・タグ一覧のどちらから開始しても全画面検索ページへ切り替える。入力中はカテゴリ、タグ、Bookmarkを合わせて最大8候補まで表示する。AI自然言語検索は入力元画面上のポップアップ内で入力と応答を確認し、分類検索だけでなくBookmationの機能全般に関する説明も受け付ける。

この時点では訪問回数閾値とアーカイブ閾値を単位付き数値入力にし、AIタグ細分化度だけを0〜4のスライダーにするとしていた。訪問回数の部分は2026-08-18の訪問日数＋期間選択要件で置き換えられた。1件あたりのAI新規Tag上限は0／1／2／4／6件で、0でも既存カテゴリ／タグへの自動付与は続ける。自動Bookmarkリマインダーは有効／無効を選べ、通知には対象URLの `次回以降表示しない` を置く。右クリック保存も一般設定の端末固有toggleで有効／無効にし、既定ON、OFFではBookmationのpage／link menuを解除する。アーカイブ済みBookmarkの利用者データはページ名、URL、カテゴリ、タグだけを残し、設定内のリストから選択復元する。

設定の共有では、カテゴリ別、タグ別、個別Bookmarkを検索とチェックボックスで選ぶQR生成と、QR読取インポートを扱う。同一Googleアカウントの端末間同期は `appDataFolder`、所有権または共有権限を確認できる別アカウントとの共有は通常Drive fileを使い、対象アカウントを選ぶ。DriveのOAuth scope、permissions／capabilities、競合方式は [ISSUES.md](ISSUES.md) の ISSUE-011 で追跡する。

当時はrepository直下の `デザインシート.svg` を画面配置・外観の正本とし、SHA-256 `44b39333bd9d91d3f617508703273bfed0c766802ecce935226a8c62c0bcd751` を記録した。この版と配置は2026-08-19の `figma/` 配下2ファイルで置き換えられた。

### 2026-08-16 の依頼

この時点の依頼により、旧メインタグを「カテゴリ」、旧サブタグを「タグ」へ改称した。カテゴリは名称一意・ユーザー作成のみ、タグは同名可・既存ユーザー定義優先・不足時だけAI作成とした。カテゴリ／タグの平坦性、タグ同名可、検索画面方式は2026-08-17の最新要件で置き換えられた。DBはIndexedDB上の版付きJSON互換ドキュメントを正本形式とする。

さらに、訪問回数閾値到達後の保存リマインダー、最終訪問日時と設定期間による自動archive、文字列archive flag、QRユーザー間共有、Google Drive同一ユーザー同期、Chrome標準Bookmark取込、page／linkのcontext menu保存をP1確定要件とした。

テスト／モック用に本番の拡張機能UIを通常Webページとして表示し、人間の受入確認より先にAIエージェントがPlaywrightでビルド済み実拡張機能を確認することを確定した。人間はその証拠と同じcommit／buildを最終確認する。詳細は [TESTING.md](TESTING.md) を正本とする。

### 2026-08-15 の依頼とデザインシート

当時の依頼により、LIST / GRIDのみ、カテゴリ常時表示・タグ展開、全画面分類一覧、追従検索、Bookmark編集モーダル、無限スクロール、件数、トップへ戻る、popupのshortcut表示、設定の細分化sliderを確定した。分類階層、重複規則、検索画面、AIポップアップ、設定入力は2026-08-17要件で更新済みである。

`デザインシート.svg` は画面構成・外観の一次資料である。2026-08-15版ではデスクトップのgrid / list、共通header、件数、編集button、全画面分類一覧とclose、Bookmark編集modal、back-to-topを確認していたが、SHA-256 `c704c52370a61cc30dba54481e134bbd638acf775695690b92275512c4d181d8` の旧版は現在の正本ではない。

### 2026-08-14 の依頼（旧ベースライン）

以下は旧ベースラインであり、2026-08-15 の依頼と競合する項目は置換済みである。

- UI は Plasmo（React ベース）+ Tailwind CSS で実装する。正確なバージョンと TypeScript 採用はこの指定に含まれない。
- Chrome 既存ブックマークとは別の拡張機能専用ブックマークを使う。
- 旧文書の大カテゴリ・小カテゴリ階層を廃止し、当時はカテゴリ／タグを平坦な役割区分とした。この平坦モデルは2026-08-17にカテゴリ親→タグ子へ置き換えられた。
- カテゴリはユーザーだけが作成する。タグはユーザー定義を優先し、適切な候補がない場合にだけ AI が作成する。
- カテゴリ／タグはどちらも複数割当を許可し、当時はカテゴリ名一意、タグ名重複可とした。タグ名重複可は2026-08-17の最新上書きで廃止された。
- AI によるタグの細分化度をスライダーで選べる。
- 右サイドメニュー、弁当表示、列数選択、分離検索は最新依頼で不採用となった。
- 拡張機能アイコンのポップアップに「現在ページを保存」と「ホームを開く」の2ボタンを置き、同じ2操作のショートカットを別々用意する。
- URL 指定でも保存できる。ホームは最近追加したブックマーク一覧とする。

### 削除済みの旧企画 PDF

旧企画 PDF は情報が古いため、2026-08-15 にリポジトリから削除した。現行要件・設計・実装判断の根拠には使わない。過去に参照した事実だけを [WORKLOG.md](WORKLOG.md) の履歴として残す。

## UI 参考サイト

### SANKOU!

- [トップページ](https://sankoudesign.com/)
- [確認時の公開 CSS](https://sankoudesign.com/wp-content/themes/clip/css/style.css?ver=202607122229)

公開 HTML/CSS から、上部検索、意味別に分かれたカテゴリ入口、レスポンシブな同一アスペクト比のカードグリッド、デスクトップ右端の細い固定ナビゲーションを確認した。カテゴリのポップオーバー／狭幅モーダルと ARIA 属性も参考にした。表示形式・密度切替や Masonry は確認できなかった。右端要素はタグ用サイドバーではない。

### me ki ki ki

- [トップページ](https://mekikiki.com/)
- [確認時の公開 CSS](https://mekikiki.com/wp/wp-content/themes/mekikiki-theme/assets/css/style.css?1763521788)

公開 HTML/CSS から、固定ヘッダーの検索・ソート・絞り込み入口、複数グループのチェックボックス型フィルター、件数、リセット、画面幅に応じた通常グリッドを確認した。大量の分類候補を常時展開しない点を参考にした。

### Pinterest

- [Pinterest 日本版](https://jp.pinterest.com/)
- [公式ヘルプ: アイデアを検索する](https://help.pinterest.com/ja/article/search-for-ideas-on-pinterest)
- [公式ヘルプ: ボードを作成する](https://help.pinterest.com/ja/article/create-a-board)
- [公式ヘルプ: サブボードを作成する](https://help.pinterest.com/ja/article/create-a-board-section)
- [公式ヘルプ: ボードを整理する](https://help.pinterest.com/ja/article/organize-your-boards)

公式ヘルプから検索、ボード／サブボード、保存済み項目の整理を確認した。今回は未ログインかつ JavaScript を実行しない取得環境だったため、`jp.pinterest.com` 本体の正確な列数や Masonry の現行挙動は操作確認できなかった。公式ヘルプの機能説明にも端末・地域・提供状況による差があり得る。このため「Pinterest型」は画像中心の探索体験という参考表現であり、固定仕様の転記ではない。

## 公式技術資料

UI 参考サイトは静的確認が中心であり、全ブレークポイントでのクリック操作、クロスブラウザ表示、アクセシビリティ適合性は検証していない。ARIA 属性の存在確認は適合性の保証ではない。

### Chrome 拡張機能と端末内 AI

- [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) — `LanguageModel.availability()`、モデル取得、構造化出力、拡張機能からの利用、端末要件、Web Worker では利用できないという実行コンテキスト制約。2026-05-19 更新版を 2026-08-14 に確認した。
- [Chrome Extensions sample: Gemini on-device](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/ai.gemini-on-device) — 公式サンプルが Side Panel の拡張機能ドキュメントで Prompt API を呼ぶ構成の確認元。Bookmation の採用構成は別途スパイクする。
- [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started) — 対応言語、可用性状態、ユーザー操作と初回モデル取得。
- [`activeTab` permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) — 明示操作時だけ現在タブへ一時アクセスする設計根拠。
- [`chrome.storage`](https://developer.chrome.com/docs/extensions/reference/api/storage) — 拡張機能用ストレージ、領域、クォータ、アクセスレベル。
- [`chrome.commands`](https://developer.chrome.com/docs/extensions/reference/api/commands) — `getAll()` で実割当を取得でき、利用者が `chrome://extensions/shortcuts` で割り当てを変更する根拠。2026-08-15 確認。
- [`chrome.history`](https://developer.chrome.com/docs/extensions/reference/api/history) — `search()` でURL候補を取得し、`getVisits()` の `VisitItem.visitTime` からURL別の訪問暦日を集計できること、および `history` permissionを2026-08-18に再確認。`HistoryItem.visitCount` は新しい訪問日数判定には使わない。
- [`chrome.alarms`](https://developer.chrome.com/docs/extensions/reference/api/alarms) — 定期実行、端末sleep時の遅延、起動時のalarm存在確認。訪問／archive評価の根拠として2026-08-16に確認。
- [`chrome.notifications`](https://developer.chrome.com/docs/extensions/reference/api/notifications) — 保存リマインダー通知のAPIとpermission。2026-08-16確認。
- [`chrome.contextMenus`](https://developer.chrome.com/docs/extensions/reference/api/contextMenus) — page／link context、固定IDの `create()` / `remove()`、Service Workerでの `onClicked`、`contextMenus` permission。設定toggleの登録／解除契約として2026-08-17に再確認。
- [`chrome.storage`](https://developer.chrome.com/docs/extensions/reference/api/storage) — 端末固有設定の保存と `storage.onChanged` によるService Worker側の即時反映。2026-08-17確認。
- [`chrome.bookmarks`](https://developer.chrome.com/docs/extensions/reference/api/bookmarks) — 標準Bookmark treeの読取と `bookmarks` permission。Bookmationは取込時に読取りだけを使う。2026-08-16確認。
- [`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions) — optional permissionを利用者gesture内の `request()` で要求し、`contains()` で現在値を確認し、`onRemoved` で後発取消を検出できる設計根拠。自動archive toggleのhistory権限gateとして2026-08-18に再確認。
- [`chrome.identity`](https://developer.chrome.com/docs/extensions/reference/api/identity) — extension OAuth2設定と明示操作からのinteractive token取得。2026-08-16確認。
- [Google Drive appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata) — app専用の非表示領域と `drive.appdata` scope。同一アカウントの端末間同期に使い、領域内ファイルをアカウント間共有できないため別アカウント共有へ流用しない根拠。
- [Google Drive: Share files, folders & drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing) — 通常Drive fileのpermissionsと共有操作。所有権または共有権限を確認できる別アカウントとの共有経路の候補であり、具体的なscopeとcapability判定はISSUE-011で決める。
- [`chrome.runtime.onInstalled`](https://developer.chrome.com/docs/extensions/reference/api/runtime#event-onInstalled) — `details.reason` で初回インストールと更新を区別し、ウェルカム画面を `INSTALL` の時だけ開く根拠。
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — グローバル変数に依存せず、停止・再開可能にする根拠。
- [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — 必須・任意・host permission の設計。
- [Remote hosted code violations](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) — Manifest V3 で実行コードを同梱する根拠。

### 実装基盤

- [Radix Primitives: Introduction](https://www.radix-ui.com/primitives/docs/overview/introduction) — unstyledでincrementalに採用できるReact primitiveと、tree-shake可能な`radix-ui` packageの公式導入方針。2026-08-19確認。
- [Radix Primitives: Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) — primitiveが扱うARIA、keyboard、focusと、利用側が付与するlabelの責任。2026-08-19確認。
- [Radix Primitives: Styling](https://www.radix-ui.com/primitives/docs/guides/styling) — presentationだけでなくDialog Overlay等のfunctional CSSも利用側が実装し、`className`と`data-state`でstyleする根拠。2026-08-19確認。
- [Radix Primitives: Composition](https://www.radix-ui.com/primitives/docs/guides/composition) — `asChild`で合成するleaf componentがprops展開とref転送を必要とする根拠。2026-08-19確認。
- [Plasmo Framework](https://docs.plasmo.com/framework) — Chrome 拡張開発基盤、React／TypeScript、development／production build、pnpm推奨。2026-08-19再確認。
- [Plasmo Extension Pages](https://docs.plasmo.com/framework/ext-pages) — `popup.tsx`等のextension page convention。2026-08-19確認。
- [Plasmo Tab Pages](https://docs.plasmo.com/framework/tab-pages) — `src/tabs/*.tsx`を拡張機能内の通常pageとしてbundleする構成。2026-08-19確認。
- [Plasmo Background Service Worker](https://docs.plasmo.com/framework/background-service-worker) — `background.ts` entryとworkerのin-memory stateが停止時に失われる制約。2026-08-19確認。
- [Plasmo Tailwind CSS quickstart](https://docs.plasmo.com/quickstarts/with-tailwindcss) — PlasmoでのTailwind v3 + PostCSS、extension pageのCSS import。2026-08-19再確認。
- [Tailwind CSS v3: PostCSS installation](https://v3.tailwindcss.com/docs/installation/using-postcss) — v3のcontent path、PostCSS plugin、`@tailwind` directive。repository固定版3.4.17をv4手順へ混ぜない根拠として2026-08-19確認。

### テスト

- [Chrome Extensions: End-to-end testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing) — ビルド済み拡張をブラウザへ読み込み、利用者に見える挙動でE2Eを行い、拡張機能ページを `chrome-extension://` URLで開く根拠。2026-08-16確認。
- [Playwright: Chrome extensions](https://playwright.dev/docs/chrome-extensions) — persistent Chromium context、Manifest V3 Service Worker、拡張機能ID、popup／extension pageのテスト方法。2026-08-16確認。
- [Playwright: Visual comparisons](https://playwright.dev/docs/test-snapshots) — 同一環境でのscreenshot基準と差分確認。基準画像の更新は人間レビューを必須にする。
- [Playwright: Trace viewer](https://playwright.dev/docs/trace-viewer-intro) — 操作、DOM snapshot、console、networkを人間が追跡できるE2E証拠。
- [Storybook: UI tests](https://storybook.js.org/docs/writing-tests/index) — 通常Webページでcomponent状態、操作、watch／CI結果を確認する実装候補。採用runnerはISSUE-018で決める。
- [Storybook: Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) — UI上でアクセシビリティ違反を確認しcomponent testと連携する候補。自動検査だけで人間確認を代替しない。

### アクセシビリティ

- [WAI-ARIA APG: Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) — 細分化スライダーのキーボード操作と値説明。
- [WAI-ARIA APG: Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — 統合検索、Tag入力、Tag作成／編集時の親Category入力で最大8件の既存候補を表示し、キーボード選択と展開状態を伝える設計候補。
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — キーボード、フォーカス、コントラスト、リフローの基準。

## 参照時の注意

- 外部サイトと Chrome API は更新される。実装開始時とリリース前に公式資料を再確認する。
- UI サイトの観察結果と Bookmation の採用判断は [UI.md](UI.md) で分けて記録する。
- 削除済みの旧企画 PDF を現行要件の根拠として再導入しない。
- Chrome Prompt API の端末要件を満たすことを、すべての利用者に仮定しない。
