# 設計方針

- 状態: 設計決定・開発基盤のみ実装済み
- 更新日: 2026-08-17
- 関連: [要件](./REQUIREMENTS.md) / [UI](./UI.md) / [フロントエンド](./FRONTEND.md) / [バックエンド](./BACKEND.md) / [テスト](./TESTING.md)

## 設計原則

1. Chrome標準Bookmarkとは分離した、版付きJSON互換ドキュメントをローカル正本にする。
2. カテゴリを親、タグを子とする固定2階層とし、activeなタグはactiveな親カテゴリを1件だけ持つ。tombstoneタグは削除済みの親を参照でき、子tombstoneが残る親は物理回収しない。
3. カテゴリ名とタグ名は、それぞれの名前空間で正規化後に全体一意とする。タグは親カテゴリが異なっても同名を許さない。
4. AIは既存のユーザー定義タグを優先し、細分化度0〜4の上限内でタグだけを新規作成する。
5. 細分化度0でも既存カテゴリ／タグの自動選択・付与は継続する。
6. Bookmarkを先に永続化し、AI失敗で保存を巻き戻さない。
7. UIの配置と外観は更新済み `デザインシート.svg`、機能と挙動は [REQUIREMENTS.md](./REQUIREMENTS.md) を正本にする。
8. Prompt APIはService Workerで実行せず、対応を実証したトップレベル拡張ページでだけ実行する。
9. 同じReact componentをfake AdapterでWeb表示し、AIエージェントの実拡張Playwright確認後に人間が受け入れる。

## 構成

| 構成要素 | 責務 |
| --- | --- |
| Plasmo popup | 現在ページ保存、ホーム表示、ショートカット表示、変更案内 |
| Plasmo dashboard | welcome、Bookmark一覧、検索、カテゴリ・タグ、設定、overlay、AI Host |
| React + Tailwind | デザインシートを再現する画面、状態、アクセシビリティ |
| MV3 Service Worker | install、commands、contextMenus、alarms、保存、履歴判定、Repository、job、AI結果再検証 |
| IndexedDB | Bookmark、Category、Tag、関連、archive、job、reminder suppression、import、sync outboxのJSON文書と画像Blob |
| `chrome.storage.local` | LIST / GRID、数値閾値、reminder有効、AI細分化0〜4等の小設定 |
| Chrome Prompt API | ローカル分類、自然言語検索、製品機能案内。対応時だけ利用 |
| Google Drive adapter | 同一アカウントのappData同期、通常Drive fileによる権限付きアカウント間共有、競合管理 |
| QR adapter | 選択Bookmarkの生成、読取、検証、import |
| Web UI preview | 本番componentと決定的fixtureを通常Webページで表示 |
| Playwright E2E | ビルド済み拡張を隔離Chromium profileで操作し証拠を保存 |

## 主要画面

- welcome: install時だけ開く初回ホーム。
- popup: 保存／ホーム、実ショートカット、変更案内。
- bookmark list: 最近追加／分類別、LIST / GRID、件数、無限スクロール。
- search: キーワード確定後に切り替わる全画面結果。
- AI agent: 右下ポップアップ内で入力と応答を扱う自然言語検索／機能案内。
- category/tag list: 全画面、親子表示、新規作成dropdown、通常／管理モード。
- bookmark editor: 名前、URL、タグcombobox、タグからのカテゴリ自動導出、同一modal内のTag作成side view、削除。
- settings/general: 訪問回数、reminder toggle、archive日数、AI細分化0〜4。
- settings/archive: 最小archive recordの一覧、選択、復元。
- settings/share: Drive account、QR選択／生成／読取／取込。

右サイドタグメニュー、弁当表示、列数／表示数設定、自然言語検索専用ページ、Bookmark／Tagの削除確認画面は持たない。Categoryの連鎖削除だけは警告確認を必須とする。

## ドメイン不変条件

各レコードはJSON互換で `schemaVersion` を持つ。Repository境界でschema検証し、TypeScript castだけで信頼しない。日時はEpoch milliseconds、IDと状態は文字列、BlobはID参照で分離する。

### Bookmark

- 正規化・検証済みの `http` / `https` URLを持つ。
- タグを0件以上持ち、カテゴリ集合はactiveなTagの親集合から自動導出する。
- Tag追加時は親Category edgeを追加し、Tag解除時は同じ親を必要とする他のactive Tagがなければ親Category edgeも解除する。永続化時に導出結果とedgeの一致を検証する。
- Bookmation内の保存、編集、削除はChrome標準Bookmarkへ影響しない。

### Category / Tag

- CategoryはUSER originだけを許し、論理削除中を含めた正規化名をCategory全体で重複させない。
- Tagは `parentCategoryId` を必須とし、USER / AI / 明示import・share originを許す。
- Tagの正規化名は論理削除中と親CategoryにかかわらずTag全体で重複させない。CategoryとTagは別の名前空間である。
- Tagの親CategoryはTag編集から変更できる。親変更はTag IDを維持する専用transactionとし、Bookmark編集やAI出力からは実行しない。
- Category削除は警告確認後の専用transactionとし、Category、全子Tag、関連edgeを論理削除して影響するactive Bookmarkを再分類する。Bookmark自体は削除しない。

## 保存とAI分類

1. popup、shortcut、URL入力、context menu、reminderを共通保存ユースケースへ渡す。
2. BookmarkとPENDING分類jobを同一transactionで保存する。
3. 保存成功を先に返す。
4. dashboardのAI Hostがjobをclaimする。
5. AIは既存Category／Tag候補IDを選ぶ。Categoryは新規作成しない。
6. 細分化度が1〜4で適切な既存Tagが不足するときだけ、上限内で子Tagを提案する。0では提案しない。
7. Service Workerが候補ID、親子関係、revision、上限を再検証して適用する。
8. 失敗時もBookmarkを残し、手動編集へ案内する。

| 細分化度 | 新規AI Tag上限 |
| --- | --- |
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 3 | 4 |
| 4 | 6 |

## 検索とAIエージェント

キーワード検索とAI自然言語処理は入口と表示を分ける。

| 機能 | 入力 | 表示 | 対象 |
| --- | --- | --- | --- |
| 入力中候補 | 両一覧の検索box | Google検索型popover、最大8件 | Category、Tag、Bookmark |
| 確定キーワード検索 | Enter／検索button | `#/search` のfull page | Category、Tag、Bookmark |
| AI自然言語検索 | AI popup | popup内の回答と候補 | Category、Tag、Bookmark |
| AI機能案内 | AI popup | popup内の説明と画面link | Bookmation機能全般 |

入力中候補は決定的な文字列一致度順で最大8件を示す。確定結果とAI検索候補は `カテゴリ・タグ` を上、Bookmarkを下にする。AI検索はscoreや順位番号をUI契約にしない。

AI機能案内は版管理された製品ヘルプとcapability stateを根拠とし、未実装・権限不足・AI非対応を区別する。AIからmutationを直接実行せず、必要な画面への案内に留める。AI非対応時はローカルkeyword検索と静的ヘルプを維持する。

## 作成・編集・削除

Bookmark編集は名前、URL、Tagの最大8件comboboxだけを扱い、Category入力を持たない。Tag fieldから同じmodal内のTag作成side viewへ移り、選択中active Tagの親集合からCategory edgeを自動導出する。

カテゴリ・タグ一覧の `新規作成` dropdownは種類を選び、連続作成dialogを開く。作成後も閉じず、利用者が閉じるまで新規レコードを追加できる。この画面から既存項目をBookmarkへ関連付けない。Tag作成は既存active Categoryの最大8件comboboxを必須とし、Category新規作成は同じmodal内のside viewで行う。Category作成中もTag draftを保持し、成功後はTag作成へ戻って新Categoryを自動選択する。

Tag編集は名前と親Categoryを変更できる。親Categoryはactiveな既存Categoryを最大8候補から選び、必要なら同じmodal内のCategory作成side viewへ移る。Tag draftを保持し、Category作成成功後はTag編集へ戻って新Categoryを自動選択する。保存commandはexpected Tag revision、選択親のexpected revision、submit開始時に1回だけ作る `tag-update:<UUID>` requestIdを持ち、同一retryでIDを再利用する。新旧Category、Tag、全参照active Bookmark／edgeを同一transactionで再検証する。Tagの親更新後、各影響BookmarkのCategory edge集合を残存active Tagの親集合へ完全一致させ、Bookmark revisionと検索文書を更新する。Tag IDを維持するためAI再分類は不要であり、Tag名のglobal unique判定も親変更では変化しない。初回成功とreceipt再送は同じ `UpdateTagResult` を返す。

一覧は通常／管理モードを持つ。管理モードのCategoryRibbon／TagChip選択で編集dialogを開く。Category編集にはactiveな子Tagの件数と実名一覧、関連active Bookmarkのunique件数を表示する。Bookmark／Tagは確認なしで即時に論理削除する。Categoryだけは連鎖削除の警告を確認してから、Category、全子Tag、関連edgeを同一transactionで論理削除し、影響Bookmarkを再分類する。削除後の取り消し機能は提供しない。

## 初回ホーム

install eventだけで `#/welcome` を開き、短い説明と開始操作を示す。初期設定の完了状態を保存し、更新時に再表示しない。インストールイベントの重複やタブ作成失敗を冪等に扱う。

## 訪問リマインダーと自動アーカイブ

一般設定は訪問回数とアーカイブ日数を数値入力、AI細分化だけをsliderにする。reminderと右クリック保存は独立したtoggleとし、右クリック保存は初期値ON、OFFではBookmation所有menuを登録しない。reminder toggleをオンにするときは履歴・通知権限、自動archiveを初めて開始するときは履歴権限の目的をそれぞれ説明して要求する。archive専用toggleは置かず、履歴権限がなければ閾値を保持したまま判定を停止する。

履歴から未保存URLの訪問回数が閾値へ達したら、reminderが有効な場合だけ候補を表示する。利用者が `はい` を選んだ場合だけ保存する。`次回から表示しない` はcanonical URL単位のsuppressionを保存し、global toggleを変更しない。

archive判定は最終訪問日時と設定日数を使い、取得不能なら自動変更しない。archive user payloadはページ名、URL、カテゴリ、タグだけに縮退し、画像、説明、favicon、訪問履歴、検索派生情報を破棄する。復元に必要なID、schemaVersion、archive日時等は運用metadataとして分離する。

## 共有・同期・取込

- 同一accountの端末同期は共有できない `appDataFolder` を使う。
- 所有権または共有権限のある別accountとの共有は、`appDataFolder` ではなく通常Drive fileを使い、`capabilities` とpermissionを確認する。
- 2経路をUIと保存先で区別し、未接続・offlineでもローカル編集を継続し、競合を黙って上書きしない。
- QR共有はCategory／Tag／個別Bookmarkの検索・checkbox選択をBookmark ID集合へ展開し、重複を除く。
- QR生成前と読取後に内容、件数、容量、versionを検証する。camera拒否時は画像file読取を提供する。
- Chrome標準Bookmarkは明示操作とpreview後にBookmationへcopyし、元データを変更しない。

## 一覧取得

`savedAt + id`、`normalizedName + id` 等の安定cursorで取得する。sentinelごとに次pageを1回だけ要求し、requestId、cursor、ID dedupeで多重追加を防ぐ。総件数と読込済み件数を分け、追加失敗でも既読項目を保持する。

## UI安全性とアクセシビリティ

Dialog、popup、menu、combobox、disclosureは共通primitiveを使う。focus trapまたは適切な非modal focus管理、Esc、trigger復帰、accessible name、live region、200% zoom、reduced motionを実装する。

Bookmark／Tagの削除確認は省き、対象を即時に論理削除する。Categoryだけは、全子Tagと関連edgeの連鎖削除およびBookmark再分類を警告して明示確認を得る。削除後の取り消し機能や利用者向け復元経路は提供しない。同期とデータ保全に使うtombstoneは維持し、その間は一意名を予約する。同名作成を試みた利用者には別名の入力または物理GC完了待ちを案内する。名称衝突時の自動統合やAIからのmutationは行わない。

## テスト構成

同じcomponent treeへ、本番ではChrome／IndexedDB／AI／Drive／camera Adapter、Webプレビューでは決定的fake Adapterを注入する。Webでwelcome、0／8／9候補、Category／Tagの名称衝突、AI help、細分化0、親子不整合、Tag作成／編集からのCategory side view、Tag親変更とrevision競合、連続作成、管理モード、Bookmark／Tagの即時論理削除、Category連鎖削除警告、影響Bookmark再分類、archive復元、reminder抑止、Drive／QR状態を再現する。

lint、typecheck、unit／integration、build後に、AIエージェントがpersistent Chromium contextへビルド済み拡張を読み込み、screenshot、trace、console、skip理由を保存する。その後、人間が同じcommit／buildを実Chromeで受け入れる。詳細は [TESTING.md](./TESTING.md) に従う。

## 未実証事項

- 対象ChromeとPrompt APIの配布・モデル準備条件。
- dashboardがPrompt API対応トップレベル拡張ページか。
- Driveのaccount picker、所有権、共有権限、app専用領域の使い分け。
- QR payload容量、camera permission、複数QR分割方式。
- 実データ件数でのtypeahead、full search、無限scrollの性能値。

これらは [ISSUES.md](./ISSUES.md) と [TECH-DEBT-TRACKER.md](./TECH-DEBT-TRACKER.md) で追跡する。
