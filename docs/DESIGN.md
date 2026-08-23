# 設計方針

- 状態: 設計決定・開発基盤のみ実装済み
- 更新日: 2026-08-23
- 関連: [要件](./REQUIREMENTS.md) / [UI](./UI.md) / [フロントエンド](./FRONTEND.md) / [実装ガイド](../FRONTEND_GUIDE.md) / [バックエンド](./BACKEND.md) / [テスト](./TESTING.md)

## 設計原則

1. Chrome標準Bookmarkとは別に、拡張機能専用のJSON互換ドキュメントをローカル正本にする。
2. カテゴリを親、タグを子とする固定2階層とし、activeなタグはactiveな親カテゴリを持つ。
3. カテゴリ名とタグ名は、それぞれの名前空間で正規化後に全体一意とする。タグは親カテゴリが異なっても同名を許さない。
4. AI細分化度0〜4は、既存Tagを再利用する意味範囲と、新規作成できる概念の重要度を制御する。固定件数上限には変換しない。
5. AIは1回の分類でCategoryを厳密に1件選び、候補単位で正常な全Tagをその配下へ適用する。値0でも中心主題を既存Tagで表せない時は必要最小限の `CORE` を新規作成できる。
6. Bookmarkを先に永続化し、AI失敗で保存を巻き戻さない。
7. UIの配置、外観、部品、状態、機能、挙動は [REQUIREMENTS.md](./REQUIREMENTS.md) と対象領域の仕様書を正本にする。Figmaとrepository内SVGは、仕様書に未記載の視覚詳細を補う参照資料とし、仕様書と競合する場合は採用しない。
8. Prompt APIはService Workerで実行せず、対応を実証したトップレベル拡張ページでだけ実行する。TASK-007の実機スパイクではDashboardをAI Hostとして、`availability`、`create`、`prompt`、日本語入出力、JSON Schemaによる構造化出力、モデル取得後の分類を確認した。この実証はAPI能力の確認であり、旧件数上限promptの出力をpolicy version 2の分類品質の証拠にはしない。Side Panelは未検証であり、Offscreen Document対応を仮定しない。最低Chrome版、配布要件、モデル取得時間・容量、非対応時のfallbackは [ISSUE-001](./ISSUES.md) の残課題とする。
9. 同じReact componentをfake AdapterでWeb表示し、AIエージェントの実拡張Playwright確認後に人間が受け入れる。

## 構成

| 構成要素                            | 責務                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Plasmo popup                        | 現在ページ保存、ホーム表示、ショートカット表示、変更案内                                                   |
| Plasmo dashboard                    | welcome、Bookmark一覧、検索、カテゴリ・タグ、設定、overlay、AI Host                                        |
| React + Radix Primitives + Tailwind | デザインシートを再現する画面、behavior、状態、アクセシビリティ                                             |
| MV3 Service Worker                  | install、commands、contextMenus、alarms、保存、履歴判定、Repository、job、AI結果再検証                     |
| IndexedDB                           | Bookmark、Category、Tag、関連、archive、job、AI分類設定正本、reminder suppression、import、sync outboxのJSON文書と画像Blob |
| `chrome.storage.local`              | LIST / GRID、訪問期間／日数、archive日数、reminder有効等の小設定とAI設定のUI mirror                       |
| Chrome Prompt API                   | ローカル分類、自然言語検索、製品機能案内。対応時だけ利用                                                   |
| Google Drive adapter                | 同一アカウントのappData同期、通常Drive fileによる権限付きアカウント間共有、競合管理                        |
| Share export / QR adapter           | 選択BookmarkのQR／CSV生成、QR容量検査、QR読取、検証、import                                                |
| Web UI preview                      | 本番componentと決定的fixtureを通常Webページで表示                                                          |
| Playwright E2E                      | ビルド済み拡張を隔離Chromium profileで操作し証拠を保存                                                     |

## 主要画面

- welcome: install時だけ開く初回ホーム。カテゴリテンプレート機能のstepを含むが、具体的なcatalogとcontrolはISSUE-022で決める。
- popup: 保存／ホーム、実ショートカット、変更案内。
- bookmark list: 最近追加／分類別、LIST / GRID、件数、無限スクロール。
- search: キーワード確定後に切り替わる全画面結果。
- AI agent: 右下ポップアップ内で入力と応答を扱う自然言語検索／機能案内。
- category/tag list: 全画面、親子表示、新規作成dropdown、通常／管理モード。
- bookmark add/editor: URL、名前、空のTag入力、リアルタイム候補、Tagの順次追加／展開表示／個別解除、TagからのCategory自動導出、同一modal内のTag作成side view。editorだけは削除も持つ。
- settings/general: 訪問集計期間、既定なしの訪問日数、reminder toggle、history権限gate付きarchive toggle、既定30日のarchive日数、AI細分化0〜4。
- settings/archive: 最小archive recordの一覧、選択、復元。
- settings/share: Drive account、QR／CSV選択export、QR読取／取込。

右サイドタグメニュー、弁当表示、列数／表示数設定、自然言語検索専用ページ、Bookmark／Tagの削除確認画面は持たない。Categoryの連鎖削除だけは警告確認を必須とする。

## ドメイン不変条件

各レコードはJSON互換で `schemaVersion` を持つ。Repository境界でschema検証し、TypeScript castだけで信頼しない。日時はEpoch milliseconds、IDと状態は文字列、BlobはID参照で分離する。

### Bookmark

- 正規化・検証済みの `http` / `https` URLを持つ。
- タグを0件以上持ち、カテゴリ集合はactiveなTagの親集合から自動導出する。
- Tag追加時は親Category edgeを追加し、Tag解除時は同じ親を必要とする他のactive Tagがなければ親Category edgeも解除する。永続化時に導出結果とedgeの一致を検証する。
- Bookmark追加／編集のTag入力文字列は永続化せず、`追加` またはEnterで解決したactive Tag IDだけをdraftと保存commandへ含める。存在しないTag文字列を新規Tagやedgeへ変換しない。
- Bookmation内の保存、編集、削除はChrome標準Bookmarkへ影響しない。

### Category / Tag

- CategoryはUSER originだけを許し、論理削除中を含めた正規化名をCategory全体で重複させない。
- Tagは `parentCategoryId` を必須とし、USER / AI / 明示import・share originを許す。
- Tagの正規化名は論理削除中と親CategoryにかかわらずTag全体で重複させない。CategoryとTagは別の名前空間である。
- Tagの親CategoryはTag編集から変更できる。親変更はTag IDを維持する専用transactionとし、Bookmark編集やAI出力からは実行しない。
- Category削除は警告確認後の専用transactionとし、Category、全子Tag、関連edgeを論理削除してBookmark自体を残す。classificationSettingsがCONFIGUREDかつenabledの場合だけ影響するactive Bookmarkを再分類し、disabled／再設定待ちはJobを作らない。

## 保存とAI分類

1. popup、shortcut、URL入力、context menu、reminderを共通保存ユースケースへ渡す。DashboardのBookmark追加では、明示選択された0件以上のactive Tag IDも渡す。
2. durable migration gateが存在しないことを確認してからBookmarkとIndexedDBのAI設定正本を同一transactionで読み、CONFIGUREDかつenabledならPENDING分類jobも保存する。gate中は無変更で再試行案内、disabled／再設定待ちはJobを作らず手動Tag有無からCLASSIFIED／UNCLASSIFIEDにする。
3. 保存成功を先に返す。
4. dashboardのAI Hostがjobをclaimする。
5. AIは既存Category候補から厳密に1件を選び、その配下で既存Tagの `REUSE` またはTagの `CREATE` を提案する。Categoryは新規作成しない。
6. 細分化policy version 2に従い、低い値では既存Tagを広く再利用し、高い値ではページに明示された細かな概念まで新規作成できる。件数上限は設けない。
7. Service Workerが呼出し前と適用直前にclassificationSettings正本を先に分岐する。disabled／再設定待ちはfingerprintを作らず旧JobをCANCELED_SETTINGSへ閉じてbookmarkStateBeforeJobへ戻す。CONFIGUREDかつenabledの場合だけBookmarkと同じ決定的候補queryからcurrent base fingerprintを再計算し、候補の追加・復元・消滅を含めstaleなら旧Jobを同一transactionで取消して現在値JobをactiveInputKey付きでget-or-createする。
8. dispatchは永続attemptをPREPARED、外部call直前にDISPATCH_RESERVEDとしてから1回だけ行う。Service Workerがtoken一致、全体外形、各候補のID、親子関係、revision、importance、根拠、重複を検証する。正常候補が1件以上ならsanitizedなpendingApplyを先に保存し、その試行の全正常候補を1 transactionで適用して終了する。
9. 受信済み出力の正常候補0件だけをquality-zeroとし、3 dispatchすべてquality-zeroなら `NEEDS_REVIEW` とする。timeout／切断／truncated／応答過大／結果喪失はtechnical failureで、これを含むdispatch枯渇は `FAILED` とする。所有者なし／期限切れleaseの所有権取得transaction成功だけを `executionAttempt` で数え、同じ失効前leaseの更新、結果再送、pendingApplyのDB retryでは増やさない。3回目leaseが有効な間は完了を許し、4回目claimが必要ならpendingApply／stale／設定取消を先に処理してから新ownerなしのfinalizerでFAILEDへ閉じる。どの終端でもBookmark本体と手動Tagを残す。

| 細分化度 | 既存Tagの再利用 | 新規作成可能な重要度 |
| ---: | --- | --- |
| 0 | 関連する既存Tagを強く優先 | `CORE` |
| 1 | 広めでも主題を大きく失わなければ再利用 | `CORE` |
| 2 | 十分近ければ再利用 | `CORE`, `MAJOR` |
| 3 | 完全一致または非常に近ければ再利用 | `CORE`, `MAJOR`, `SUPPORTING` |
| 4 | 完全一致、同義語、正式名／略称、翻訳、表記揺れを再利用 | `CORE`, `MAJOR`, `SUPPORTING`, `DETAIL` |

プロンプト、型、検証、再試行の詳細は [AI_GUIDE.md](./AI_GUIDE.md) を正本とする。

## メディア取得

Bookmark保存時のサムネイルはページの `og:image` を第一候補とする。取得した画像はMIME、寸法、容量、content hashを検証してlocal Blobへ保存し、一覧ではそのBlobだけを参照する。取得、検証、保存のいずれかに失敗した場合は外部URLを保持・再読込せず、同梱の `assets/icon.png` をBookmationロゴ画像として表示する。画面キャプチャや認証後画面の取得は行わない。

アーカイブの利用者payloadには画像を含めず、復元時に現在の取得方針でサムネイルを再構築する。

## 検索とAIエージェント

キーワード検索とAI自然言語処理は入口と表示を分ける。

| 機能               | 入力              | 表示                         | 対象                    |
| ------------------ | ----------------- | ---------------------------- | ----------------------- |
| 入力中候補         | 両一覧の検索box   | Google検索型popover、最大8件 | Category、Tag、Bookmark |
| 確定キーワード検索 | Enter／検索button | `#/search` のfull page       | Category、Tag、Bookmark |
| AI自然言語検索     | AI popup          | popup内の回答と候補          | Category、Tag、Bookmark |
| AI機能案内         | AI popup          | popup内の説明と画面link      | Bookmation機能全般      |

入力中候補は決定的な文字列一致度順で最大8件を示す。確定結果とAI検索候補は `カテゴリ・タグ` を上、Bookmarkを下にする。AI検索はscoreや順位番号をUI契約にしない。

AI機能案内は版管理された製品ヘルプとcapability stateを根拠とし、未実装・権限不足・AI非対応を区別する。AIからmutationを直接実行せず、必要な画面への案内に留める。AI非対応時はローカルkeyword検索と静的ヘルプを維持する。

## 作成・編集・削除

Bookmark追加／編集は名前、URL、Tagの最大8件リアルタイム候補だけを扱い、Category入力を持たない。Tag入力は空欄から始め、`追加` またはEnterで既存候補または明示的に新規作成したTagを1件ずつdraftへ加える。入力直下に `タグ n件` を左、`追加` を右へ置き、現在Tagを初期展開したTag chipで示す。各TagはBookmark一覧のカテゴリ・タグシェブロンと同じ解除interactionで個別に外せる。未解決文字列はfield errorとし、暗黙作成しない。Tag fieldから同じmodal内のTag作成side viewへ移り、作成後は新Tagを入力の解決済み選択へ戻す。選択中active Tagの親集合からCategory edgeを自動導出する。

カテゴリ・タグ一覧の `新規作成` dropdownは種類を選び、連続作成dialogを開く。作成後も閉じず、利用者が閉じるまで新規レコードを追加できる。この画面から既存項目をBookmarkへ関連付けない。Tag作成は既存active Categoryの最大8件comboboxを必須とし、Category新規作成は同じmodal内のside viewで行う。Category作成中もTag draftを保持し、成功後はTag作成へ戻って新Categoryを自動選択する。

Tag編集は名前と親Categoryを変更できる。親Category入力は現在のactive Categoryを選択済みで開始し、activeな既存Categoryとの正規化完全一致または最大8候補からの選択時点でdraftを置き換える。Category用の追加操作は置かず、存在しない文字列はfield errorにして暗黙作成しない。必要なら同じmodal内のCategory作成side viewへ移る。Tag draftを保持し、Category作成成功後はTag編集へ戻って新Categoryを自動選択する。保存commandはexpected Tag revision、選択親のexpected revision、submit開始時に1回だけ作る `tag-update:<UUID>` requestIdを持ち、同一retryでIDを再利用する。新旧Category、Tag、全参照active Bookmark／edgeを同一transactionで再検証する。Tagの親更新後、各影響BookmarkのCategory edge集合を残存active Tagの親集合へ完全一致させ、Bookmark revisionと検索文書を更新する。Tag IDを維持するためAI再分類は不要であり、Tag名のglobal unique判定も親変更では変化しない。初回成功とreceipt再送は同じ `UpdateTagResult` を返す。

一覧は通常／管理モードを持つ。管理モードのCategoryRibbon／TagChip選択で編集dialogを開く。Category編集にはactiveな子Tagの件数と実名一覧、関連active Bookmarkのunique件数を表示する。Bookmark／Tagは確認なしで即時に論理削除する。Categoryだけは連鎖削除とAI有効時の再分類を警告してから、Category、全子Tag、関連edgeを同一transactionで論理削除してBookmark本体を残す。disabled／再設定待ちは分類Jobを作らない。削除後の取り消し機能は提供しない。

## 初回ホーム

install eventだけで `#/welcome` を開き、短い説明と開始操作を示す。初期設定の完了状態を保存し、更新時に再表示しない。インストールイベントの重複やタブ作成失敗を冪等に扱う。

オンボーディングには版付きのカテゴリテンプレートcatalogを提示できる境界を設ける。catalogはアプリ同梱の参照データであり、閲覧だけではLabelを作らない。利用者の適用操作を通常のCategory作成use caseへ渡し、`origin=USER`、名称一意性、作成requestの冪等性を維持する。AIはcatalog生成や適用を行わず、update／reloadで既存Categoryを追加・改名・削除しない。候補内容、選択UX、再表示とversion移行はISSUE-022で確定してから実装する。

## 訪問リマインダーと自動アーカイブ

一般設定は訪問集計期間を `1週間`／`1ヶ月`／`1年` のselect、訪問日数とアーカイブ日数を数値入力、AI細分化だけをsliderにする。新規installのAIは有効、細分化度2（BALANCED）を初期値とする。訪問日数は既定値なし、アーカイブ日数は既定30日とする。期間変更時は訪問日数入力を空にし、直近7／30／365暦日に対応する上限7／30／365を適用する。有効な組が保存されるまで訪問判定を停止する。reminder、自動archive、右クリック保存は独立したtoggleとし、右クリック保存は初期値ON、OFFではBookmation所有menuを登録しない。自動archiveは初期値OFFで、ONの利用者gesture内に履歴権限の目的説明、実権限確認、必要な権限要求を置き、許可成功後だけ設定をONへcommitする。拒否または後発取消ではOFFへ収束し、archive処理を起動しない。

履歴の各 `visitTime` を端末ローカル暦日へ変換し、同じcanonical URLの同日訪問を1日にまとめる。選択した直近7／30／365暦日とURL別 `countingResetAt` の遅い方より後で訪問日数が閾値へ達した場合だけ候補を表示する。利用者が `はい` を選んだ場合だけ保存し、`いいえ` は応答時刻へ集計基準を進める。`次回から表示しない` はcanonical URL単位のsuppressionを保存し、global toggleを変更しない。

archive判定は最終訪問日時と設定日数を使い、取得不能なら自動変更しない。archive user payloadはページ名、URL、カテゴリ、タグだけに縮退し、画像、説明、favicon、訪問履歴、検索派生情報を破棄する。復元に必要なID、schemaVersion、archive日時等は運用metadataとして分離する。

## 共有・同期・取込

- 同一accountの端末同期は共有できない `appDataFolder` を使う。
- 所有権または共有権限のある別accountとの共有は、`appDataFolder` ではなく通常Drive fileを使い、`capabilities` とpermissionを確認する。
- 2経路をUIと保存先で区別し、未接続・offlineでもローカル編集を継続し、競合を黙って上書きしない。
- QR／CSV共有はCategory／Tag／個別Bookmarkの検索・checkbox選択を同じBookmark ID集合へ展開し、重複を除く。
- QRは生成前と読取後に内容、件数、容量、versionを検証する。容量超過時は分割・切捨てをせず、同じ固定集合のCSV exportへ誘導する。camera拒否時は画像file読取を提供する。
- Chrome標準Bookmarkは明示操作とpreview後にBookmationへcopyし、元データを変更しない。分類は各Bookmarkの直上Folderだけを1件のTagへ対応させ、祖先／full pathをLabel化せず、Categoryは既存Tagの親を使うか新規Tag作成前に利用者が選択／作成する。

## 一覧取得

`savedAt + id`、`normalizedName + id` 等の安定cursorで取得する。sentinelごとに次pageを1回だけ要求し、requestId、cursor、ID dedupeで多重追加を防ぐ。総件数と読込済み件数を分け、追加失敗でも既読項目を保持する。

## UI安全性とアクセシビリティ

Dialog、popup、menu、combobox、disclosureは共通primitiveを使う。focus trapまたは適切な非modal focus管理、Esc、trigger復帰、accessible name、live region、200% zoom、reduced motionを実装する。

Bookmark／Tagの削除確認は省き、対象を即時に論理削除する。Categoryだけは、全子Tagと関連edgeの連鎖削除およびBookmark再分類を警告して明示確認を得る。削除後の取り消し機能や利用者向け復元経路は提供しない。同期とデータ保全に使うtombstoneは維持し、その間は一意名を予約する。同名作成を試みた利用者には別名の入力または物理GC完了待ちを案内する。名称衝突時の自動統合やAIからのmutationは行わない。

## テスト構成

同じcomponent treeへ、本番ではChrome／IndexedDB／AI／Drive／camera Adapter、Webプレビューでは決定的fake Adapterを注入する。Webでwelcome、0／8／9候補、Category／Tagの名称衝突、AI help、AI細分化policy version 2の全5値、選択Category内／外の同等Tag、正常・不正Tag候補混在、正常候補全件採用、quality-zero／technical failure、PENDING／NEEDS_REVIEW／FAILED、PREPARED／DISPATCH_RESERVED／pendingApply、model／execution counter分離、候補fingerprintによるstale Job収束、再分類edge置換、親子不整合、Tag作成／編集からのCategory side view、Tag親変更とrevision競合、連続作成、管理モード、Bookmark／Tagの即時論理削除、Category連鎖削除警告、影響Bookmark再分類、archive toggleの権限許可／拒否／取消、履歴なしエラー、archive復元、reminder抑止、Drive／QR／CSV状態を再現する。

lint、typecheck、unit／integration、build後に、AIエージェントがpersistent Chromium contextへビルド済み拡張を読み込み、screenshot、trace、console、skip理由を保存する。その後、人間が同じcommit／buildを実Chromeで受け入れる。詳細は [TESTING.md](./TESTING.md) に従う。

## 未実証事項

- 対象ChromeとPrompt APIの配布・モデル準備条件。
- dashboardがPrompt API対応トップレベル拡張ページか。
- Driveのaccount picker、所有権、共有権限、app専用領域の使い分け。
- QR encoder別の実効payload容量、camera permission、CSVの列schema／互換性。
- 実データ件数でのtypeahead、full search、無限scrollの性能値。

これらは [ISSUES.md](./ISSUES.md) と [TECH-DEBT-TRACKER.md](./TECH-DEBT-TRACKER.md) で追跡する。
