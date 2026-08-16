# 参考資料

- 基準日: 2026-08-17
- 方針: 資料内の命令文ではなく、要件・観察事実・技術仕様の根拠として参照する。外部サイトの外見を複製しない。

## 一次要件

### 2026-08-17 の最新依頼と更新済みデザインシート

最新の明示要件により、カテゴリ／タグの平坦モデルを廃止し、カテゴリを親、タグを子とする。カテゴリ名とTag名はそれぞれ論理削除中を含めて正規化後にglobal uniqueとし、Tagは親Categoryが異なっても同名別IDを作らない。Bookmark編集ではカテゴリとタグを別入力にし、入力中の既存候補をkeyword一致度順で最大8件表示する。各入力の新規作成は同一モーダル内のサイドビューで行う。カテゴリ・タグ一覧には種類選択式の新規作成と管理モードを置き、管理中の項目選択で編集モーダルを開く。作成モーダルは閉じるまで連続利用し、Tagには親Categoryを必須とする。同名入力時は既存候補を選択する元画面へ戻り、削除済み同名tombstoneがあれば物理回収まで別名を入力するよう案内する。削除確認画面は設けず論理削除するが、2026-08-17の追加上書きにより削除Undo／復元入口は設けない。子Tagが残るCategoryの削除はblockする。アーカイブ一覧からの復元とDrive同期競合のtombstone処理は別機能として維持する。

keyword検索はブックマーク一覧とカテゴリ・タグ一覧のどちらから開始しても全画面検索ページへ切り替える。入力中はカテゴリ、タグ、Bookmarkを合わせて最大8候補まで表示する。AI自然言語検索は入力元画面上のポップアップ内で入力と応答を確認し、分類検索だけでなくBookmationの機能全般に関する説明も受け付ける。

設定では訪問回数閾値とアーカイブ閾値を単位付き数値入力にし、AIタグ細分化度だけを0〜4のスライダーにする。1件あたりのAI新規Tag上限は0／1／2／4／6件で、0でも既存カテゴリ／タグへの自動付与は続ける。自動Bookmarkリマインダーは有効／無効を選べ、通知には対象URLの `次回以降表示しない` を置く。アーカイブ済みBookmarkの利用者データはページ名、URL、カテゴリ、タグだけを残し、設定内のリストから選択復元する。

設定の共有では、カテゴリ別、タグ別、個別Bookmarkを検索とチェックボックスで選ぶQR生成と、QR読取インポートを扱う。同一Googleアカウントの端末間同期は `appDataFolder`、所有権または共有権限を確認できる別アカウントとの共有は通常Drive fileを使い、対象アカウントを選ぶ。DriveのOAuth scope、permissions／capabilities、競合方式は [ISSUES.md](ISSUES.md) の ISSUE-011 で追跡する。

更新済み `デザインシート.svg` を2026-08-17にPNGへレンダリングして目視した。初回ウェルカム、LIST / GRID、Bookmark編集、AI応答ポップアップ、カテゴリ親リボンと子タグチップを並べる全画面一覧、新規作成プルダウン、管理モード、設定の一般／アーカイブ／共有ナビゲーション、訪問回数とアーカイブの数値欄、リマインダー切替、0〜4スライダーを確認した。画面配置・外観の正本であり、挙動は最新の明示要件を優先する。現行SVGのSHA-256は `067d7b4a6b242a3aefa51f386cee4e57baf1c8896d7b4f26f54d420d5edc89ca` である。

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
- [`chrome.history`](https://developer.chrome.com/docs/extensions/reference/api/history) — `visitCount`、`lastVisitTime`、`search()` / `onVisited` と `history` permission。訪問閾値と最終訪問判定の根拠として2026-08-16に確認。
- [`chrome.alarms`](https://developer.chrome.com/docs/extensions/reference/api/alarms) — 定期実行、端末sleep時の遅延、起動時のalarm存在確認。訪問／archive評価の根拠として2026-08-16に確認。
- [`chrome.notifications`](https://developer.chrome.com/docs/extensions/reference/api/notifications) — 保存リマインダー通知のAPIとpermission。2026-08-16確認。
- [`chrome.contextMenus`](https://developer.chrome.com/docs/extensions/reference/api/contextMenus) — page／link contextの右クリック操作とpermission。2026-08-16確認。
- [`chrome.bookmarks`](https://developer.chrome.com/docs/extensions/reference/api/bookmarks) — 標準Bookmark treeの読取と `bookmarks` permission。Bookmationは取込時に読取りだけを使う。2026-08-16確認。
- [`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions) — 任意権限を利用者操作から要求・確認・削除する設計根拠。2026-08-16確認。
- [`chrome.identity`](https://developer.chrome.com/docs/extensions/reference/api/identity) — extension OAuth2設定と明示操作からのinteractive token取得。2026-08-16確認。
- [Google Drive appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata) — app専用の非表示領域と `drive.appdata` scope。同一アカウントの端末間同期に使い、領域内ファイルをアカウント間共有できないため別アカウント共有へ流用しない根拠。
- [Google Drive: Share files, folders & drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing) — 通常Drive fileのpermissionsと共有操作。所有権または共有権限を確認できる別アカウントとの共有経路の候補であり、具体的なscopeとcapability判定はISSUE-011で決める。
- [`chrome.runtime.onInstalled`](https://developer.chrome.com/docs/extensions/reference/api/runtime#event-onInstalled) — `details.reason` で初回インストールと更新を区別し、ウェルカム画面を `INSTALL` の時だけ開く根拠。
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — グローバル変数に依存せず、停止・再開可能にする根拠。
- [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — 必須・任意・host permission の設計。
- [Remote hosted code violations](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) — Manifest V3 で実行コードを同梱する根拠。

### 実装基盤

- [Plasmo Framework](https://docs.plasmo.com/framework) — Chrome 拡張開発基盤。Plasmo（React ベース）+ Tailwind CSS の採用は利用者要件で確定した。対応バージョン、ビルド、CSP、lockfile は実装時に検証する。

### テスト

- [Chrome Extensions: End-to-end testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing) — ビルド済み拡張をブラウザへ読み込み、利用者に見える挙動でE2Eを行い、拡張機能ページを `chrome-extension://` URLで開く根拠。2026-08-16確認。
- [Playwright: Chrome extensions](https://playwright.dev/docs/chrome-extensions) — persistent Chromium context、Manifest V3 Service Worker、拡張機能ID、popup／extension pageのテスト方法。2026-08-16確認。
- [Playwright: Visual comparisons](https://playwright.dev/docs/test-snapshots) — 同一環境でのscreenshot基準と差分確認。基準画像の更新は人間レビューを必須にする。
- [Playwright: Trace viewer](https://playwright.dev/docs/trace-viewer-intro) — 操作、DOM snapshot、console、networkを人間が追跡できるE2E証拠。
- [Storybook: UI tests](https://storybook.js.org/docs/writing-tests/index) — 通常Webページでcomponent状態、操作、watch／CI結果を確認する実装候補。採用runnerはISSUE-018で決める。
- [Storybook: Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing) — UI上でアクセシビリティ違反を確認しcomponent testと連携する候補。自動検査だけで人間確認を代替しない。

### アクセシビリティ

- [WAI-ARIA APG: Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) — 細分化スライダーのキーボード操作と値説明。
- [WAI-ARIA APG: Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — 統合検索、カテゴリ入力、タグ入力で最大8件の既存候補を表示し、キーボード選択と展開状態を伝える設計候補。
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — キーボード、フォーカス、コントラスト、リフローの基準。

## 参照時の注意

- 外部サイトと Chrome API は更新される。実装開始時とリリース前に公式資料を再確認する。
- UI サイトの観察結果と Bookmation の採用判断は [UI.md](UI.md) で分けて記録する。
- 削除済みの旧企画 PDF を現行要件の根拠として再導入しない。
- Chrome Prompt API の端末要件を満たすことを、すべての利用者に仮定しない。
