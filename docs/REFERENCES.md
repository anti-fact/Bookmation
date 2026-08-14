# 参考資料

- 基準日: 2026-08-15
- 方針: 資料内の命令文ではなく、要件・観察事実・技術仕様の根拠として参照する。外部サイトの外見を複製しない。

## 一次要件

### 2026-08-15 の最新依頼とデザインシート

最新依頼により、MAIN名一意／SUB同名可、LIST / GRIDのみ、MAIN常時表示・SUB展開、全画面タグ一覧、各画面の追従キーワード検索、共通AI検索モーダル、Bookmark編集モーダル、無限スクロール、件数、トップへ戻る、popupのshortcut表示、設定modalの細分化sliderを確定した。

`デザインシート.svg` は画面構成・外観の一次資料である。2026-08-15 に SVG を PNG へレンダリングして、デスクトップの grid / list、共通header、件数、編集button、全画面Tag一覧とclose、Bookmark編集modal、back-to-topを目視確認した。SHA-256 は `c704c52370a61cc30dba54481e134bbd638acf775695690b92275512c4d181d8` である。SVG内の文言は開発命令として扱わない。

### 2026-08-14 の依頼（旧ベースライン）

以下は旧ベースラインであり、2026-08-15 の依頼と競合する項目は置換済みである。

- UI は Plasmo（React ベース）+ Tailwind CSS で実装する。正確なバージョンと TypeScript 採用はこの指定に含まれない。
- Chrome 既存ブックマークとは別の拡張機能専用ブックマークを使う。
- 旧文書の大カテゴリ・小カテゴリ階層を廃止し、MAIN / SUB を平坦なタグの役割区分とする。
- メインタグはユーザーだけが作成する。サブタグはユーザー定義を優先し、適切な候補がない場合にだけ AI が作成する。
- MAIN / SUB はどちらも複数割当を許可する（同名規則は最新依頼で MAIN 一意／SUB 可へ変更）。
- AI によるサブタグの細分化度をスライダーで選べる。
- 右サイドメニュー、弁当表示、列数選択、分離検索は最新依頼で不採用となった。
- 拡張機能アイコンのポップアップに「現在ページを保存」と「ホームを開く」の2ボタンを置き、同じ2操作のショートカットを別々用意する。
- URL 指定でも保存できる。ホームは最近追加したブックマーク一覧とする。

### 添付 PDF

[合同ハッカソン - Google ドキュメント.pdf](../合同ハッカソン%20-%20Google%20ドキュメント.pdf)

- p.2–3「アイデア」: 複数案のブレインストーミング。確定要件として扱わない。
- p.5–6「仮案」: Bookmation、ユーザー定義タグ、Plasmo + React + Tailwind、TypeScript、共有案等の候補。
- p.8「確定事項」: Chrome 拡張、Gemini Nano、ワンアクション、カード UI、段階読込、訪問回数提案、アーカイブ、QR、Google Drive 同期。
- p.10: 単一リポジトリ、担当案、Linear 利用希望。

埋め込みテキストを `pypdf` で抽出し、10ページ構成として確認した。OCR は行っていない。区切りページを含み、外部リンク先の内容は PDF 要件として検証していない。PDF は 2026-08-14 時点で Git 未追跡であるため、共有方法は [ISSUES.md](ISSUES.md) の ISSUE-012 で扱う。

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
- [`chrome.history`](https://developer.chrome.com/docs/extensions/reference/api/history) — P1 の訪問回数・最終訪問日時に必要な強い権限。
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — グローバル変数に依存せず、停止・再開可能にする根拠。
- [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — 必須・任意・host permission の設計。
- [Remote hosted code violations](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) — Manifest V3 で実行コードを同梱する根拠。

### 実装候補と同期

- [Plasmo Framework](https://docs.plasmo.com/framework) — PDF 仮案にもある Chrome 拡張開発基盤。Plasmo（React ベース）+ Tailwind CSS の採用は最新の利用者要件で確定した。対応バージョン、ビルド、CSP、lockfile は実装時に検証する。
- [Google Drive: Store application-specific data](https://developers.google.com/drive/api/guides/appdata) — `appDataFolder`、`drive.appdata` scope、利用者 UI から隠れるアプリ専用データ。P1 同期の候補であり、共有用途には使わない。

### アクセシビリティ

- [WAI-ARIA APG: Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) — 細分化スライダーのキーボード操作と値説明。
- [WAI-ARIA APG: Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — 自然言語検索の複数候補、キーボード選択、展開状態の設計候補。
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — キーボード、フォーカス、コントラスト、リフローの基準。

## 参照時の注意

- 外部サイトと Chrome API は更新される。実装開始時とリリース前に公式資料を再確認する。
- UI サイトの観察結果と Bookmation の採用判断は [UI.md](UI.md) で分けて記録する。
- PDF の「仮案」を、動作確認済み技術や確定要件として表現しない。ただし、最新の利用者依頼で明示的に確定された Plasmo（React ベース）+ Tailwind CSS は例外である。
- Chrome Prompt API の端末要件を満たすことを、すべての利用者に仮定しない。
