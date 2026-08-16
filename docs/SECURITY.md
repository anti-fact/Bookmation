# セキュリティ設計

## 文書の位置づけ

- 状態: **提案・未実装・未監査**
- 対象: Chrome Manifest V3拡張機能、JSONベースのローカル保存、ローカルAI、訪問履歴、QR共有、Google Drive同期、標準Bookmark取込
- 関連: [全体設計](./DESIGN.md) / [バックエンド](./BACKEND.md) / [DBスキーマ](./DB-SCHEMA.md) / [制約](./CONSTRAINTS.md) / [テスト](./TESTING.md) / [トラブル解決](./TROUBLESHOOTING.md)

本書は安全性の目標と実装時の確認項目を定める。実装、脅威分析レビュー、侵入試験、Chrome Web Store審査はまだ行っていないため、安全性が確認済みであるとは示さない。

## セキュリティ原則

1. ローカルファースト: MVPではブックマーク情報をBookmationの外部サーバーへ送らない。
2. 最小権限: 機能を実行する直前まで任意権限を要求しない。
3. 信頼境界: Webページ、AI出力、QR、インポート、同期データをすべて未信頼入力として扱う。
4. 明示操作: 共有、外部送信、大量変更、削除はユーザーが対象を選んで開始する。Bookmark／カテゴリ／タグ削除は追加確認画面を置かないため、対象ID・revisionの検証、論理削除、Undoを必須にする。
5. 可逆性: 分類、タグ統合、アーカイブは履歴または取り消し手段を持つ。
6. 保存と分類の分離: AI失敗や攻撃的入力によって、保存済みブックマークを失わない。
7. リモートコード禁止: MV3のCSPに従い、実行コードをパッケージへ固定する。
8. テスト分離: Webプレビューと自動E2Eはfixtureと隔離profileを使い、日常利用中のデータや資格情報を暗黙に参照しない。

## 保護対象

| データ | 機密性 | 主なリスク |
| --- | --- | --- |
| 保存URLとタイトル | 高 | 閲覧関心、社内URL、個人情報の露出 |
| カテゴリ／タグ | 中〜高 | 関心、案件名、健康などの推測 |
| 自然言語の検索語 | 高 | 利用者の意図、悩み、案件情報の露出 |
| サムネイルとファビコン | 中 | ページ内容や認証後画面の露出 |
| 訪問回数・最終訪問 | 高 | 行動履歴の露出 |
| AI設定・表示設定 | 低〜中 | プライバシー選択の無視 |
| Drive OAuthトークン | 最高 | 同期領域への不正アクセス |
| QR共有データ | 共有内容に依存 | 撮影・転送・誤共有 |

サムネイルは認証後ページの画面を含み得るため、既定オフまたは初回に明確な説明を行う案を技術・UXスパイクで比較する。

## 信頼境界

| 境界 | 未信頼入力 | 必須対策 |
| --- | --- | --- |
| Webページ → 拡張機能 | URL、title、meta、画像、本文 | 長さ制限、スキーム検証、HTMLとして描画しない |
| UI → Service Worker | message payload | schemaVersion、型、送信元、件数、IDの検証 |
| AI Host Document → Service Worker | Job結果、検索候補集合、機能案内結果、requestId、lease | 外形検証だけを信用せず、候補ID、対象種別、revision、TAG親、Domain規則を再検証 |
| AI → Application | 分類JSON、検索計画、候補集合、機能案内、タグ名、ID | 固定スキーマ、候補ID制限、版付きallowlist corpus、Domain再検証 |
| QR/ファイル → Import | 外部ペイロード | サイズ、バージョン、チェックサム、全フィールド検証。チェックサムを認証に使わない |
| Drive → Sync | 古い・改変・競合データ | ETag、スキーマ、syncConflicts、解決時の不変条件再検証、tombstone |
| IndexedDB → UI | 保存済み文字列 | Reactのテキスト描画、URLプロトコル検証 |

## 最小権限

### MVP初期候補

| Manifest項目 | 目的 | 方針 |
| --- | --- | --- |
| storage | chrome.storage.localへ設定を保存 | 初期候補 |
| activeTab | ユーザー操作時に現在タブの情報を取得 | 初期候補 |
| commands | 現在タブ保存とホーム表示の2ショートカットを宣言 | 権限ではなくManifest機能として定義 |

IndexedDB利用だけを理由に追加権限は要求しない。全サイトを対象にした恒久的host_permissionsは初期候補に含めない。

### 技術スパイク後に判断

| 権限 | 想定用途 | 判断基準 |
| --- | --- | --- |
| scripting | ページメタ情報を注入スクリプトで取得 | activeTabだけで要件を満たせない場合のみ |
| tabs | タブ情報やサムネイル取得 | 必要プロパティをactiveTabで取得できない場合のみ |
| contextMenus | ページ／リンクの右クリック保存 | P1実装で宣言し、許可contextとmenu IDを固定 |
| alarms | 訪問／アーカイブの定期判定 | P1実装で宣言し、alarm名を固定・冪等登録 |
| history | 訪問回数、最終訪問 | 訪問リマインダー有効化時、または自動アーカイブの初回開始／閾値確定時だけ目的説明後に任意要求 |
| notifications | 保存リマインダー | 訪問リマインダーを有効化した時だけ要求。アーカイブでは要求しない |
| bookmarks | Chrome標準Bookmarkのインポート | 取込開始前に要求し、元データへ書き込まない |
| identity / OAuth | Google Drive同期・共有 | 明示的なDrive接続時だけ要求。同一アカウント同期は `drive.appdata`、別アカウントとの所有権付き共有は通常Drive file用の最小scopeを別同意で要求 |
| unlimitedStorage | 大量サムネイル | 容量計測と縮小・削除策で不足すると確認した場合のみ |

権限を追加するPRでは、対象機能、代替案、ユーザー向け説明、権限拒否時の動作を記載する。

## Web入力とXSS対策

- ページタイトル、サイト名、タグ名をinnerHTMLへ渡さずテキストとして描画する。
- dangerouslySetInnerHTMLを原則禁止し、例外はレビューとサニタイズを必須にする。
- javascript:、data:など意図しないURLスキームを外部ページを開く操作に使わない。
- P0 のURL指定保存は `http:` / `https:` だけを許可し、`javascript:`、`data:`、`chrome:`、`file:`、拡張機能URLを拒否する。現在タブ保存で追加スキームが必要になった場合は、別要件として安全性を検証する。
- URL指定保存はpopupや現在タブ由来の値と同じURL検証を通し、入力URLをHTML、CSSクラス、コマンド、fetch先へ直接連結しない。
- 画像URLをそのまま長期参照せず、必要なら取得・検証・縮小したBlobを保存する。
- 外部画像の自動読込による追跡を避ける。
- URL表示は省略しても、開く前にホスト名を確認できるようにする。
- CSSクラス名や属性へ未検証文字列を連結しない。

## Label名の正規化とspoofing対策

カテゴリ／タグ名の一意性には、検索token生成とは別の `nameNormalizationVersion=1` を使う。v1はUnicode 15.1.0のNFKC data、`White_Space` / `Default_Ignorable_Code_Point` / General Category tables、`CaseFolding.txt` をprojectへvendorする。処理順はrawの `Cs` / `Default_Ignorable_Code_Point` 拒否、vendored NFKC、TAB／LFを含むvendored `White_Space` のASCII space 1文字へのcollapse／trim、残存 `Cc` / `Cs` / `Default_Ignorable_Code_Point` 拒否、`CaseFolding.txt` status C+Fによるfull mapping、最終禁止文字・空・長さ再検証とする。F mappingがあればF、なければCを使い、status S / Tは使わない。

作成、改名、Import、QR、Drive同期で同じ関数とfixtureを使う。最低限 `  Ｐｙｔｈｏｎ　入門 ` → `python 入門`、`A\t\nB` → `a b`、`Straße` → `strasse` を確認し、`ab\u200Bcd`、`ab\u202Ecd`、`a\u0000b`、`a\u200Db`、`text\uFE0F` を拒否する。runtime ICU、`String.prototype.normalize()`、runtime Unicode property escape、locale-sensitive lowercaseを正本にせず、実行環境差で結果を変えない。vendored bundleのSHA-256は実assetから実装時に生成してbuild定数とschemaMetaへ固定し、文書やfixtureへ仮hashを置かない。version／hash不一致時はLabel writeをfail closedにする。正規化後にCATEGORY内またはTAG内で衝突した入力を、見た目の違いを理由に別IDとして保存しない。

## プロンプトインジェクション対策

Webページ由来のタイトル、URL、meta、将来の本文、保存済みBookmark／カテゴリ／タグの文字列、およびユーザーが入力する自然言語検索・機能質問には「以前の指示を無視せよ」などの命令が含まれ得る。ローカルモデルであっても、誤分類、不正な候補選択、虚偽の機能説明、不正なアプリ操作の危険は残る。

### 防御

1. ページ由来データを命令ではなく引用されたデータとして区切る。
2. システム側の固定指示と出力JSONスキーマをアプリ側で管理する。
3. AIへ渡す既存Labelと検索対象をID・TAG親付き候補リストに限定する。表示名だけで既存IDや親カテゴリを推測しない。
4. AIはカテゴリの作成・改名・削除、BookmarkやLabelの削除、共有、権限要求、外部アクセスを実行できない。
5. 出力をJSONスキーマで検証し、候補外ID、過剰件数、長い名称、制御文字を拒否する。AIアシスタントのintentは `SEARCH_LIBRARY` / `PRODUCT_HELP` / `OUT_OF_SCOPE` 以外を受け付けない。
6. Label.kind、Label.origin、TAG.parentCategoryId、カテゴリ作成元、Bookmark revision、同一edge、件数上限をDomainで再検証する。分類JobのpolicyVersion 1は `0→0`、`1→1`、`2→2`、`3→4`、`4→6` のgranularity／maxNewTags組だけを許し、任意の数値組合せを拒否する。
7. AI生成タグに生成元を記録し、編集・統合・取り消しを可能にする。
8. 低信頼度や候補外選択は自動適用せずneeds_reviewへ送る。CATEGORY内の正規化名重複、親カテゴリをまたぐTAG内の正規化名重複、親なし／削除済み親のTAGはDomainで拒否する。TAG一意名照合はoriginと論理削除状態を問わず行い、候補提示ではUSERを優先する一方、同名TAGの親または意味が不適合なら別IDを作らずneeds_reviewへ送る。
9. AIが返したURL、Markdown、HTML、コードを実行またはリンク化しない。
10. ページ本文の送信をMVP既定で行わず、必要性を別途検証する。
11. 機能案内はビルドに同梱した版付き・allowlist済みCapability Catalogだけを根拠にし、保存済み文字列を命令や製品仕様として扱わない。未実装状態もCatalogへ明記する。
12. AIの回答から設定変更、削除、共有、権限要求、Chrome API、外部URLを直接実行しない。検索候補を開く場合もユーザーの選択と通常のID検証を通す。

### テスト入力

- 命令を含むtitle
- JSONを壊す引用符や制御文字
- 10万文字など極端に長いmeta
- 既存Tagに似せたUnicode文字
- NFKC後に衝突する全角名、case-fold後に衝突する `Straße`、Unicode空白列、General Category `Cc` / `Cs`、ゼロ幅空白、方向制御、ZWJ、variation selector等の `Default_Ignorable_Code_Point`
- javascript: URL
- 候補にないlabelIdまたはbookmarkId
- AIによるカテゴリ新規作成要求
- 親なし、存在しない親、削除済み親を持つタグ
- 上限を超える新規タグ
- policyVersion 1にないgranularity／maxNewTagsの組合せ
- 検索候補集合への重複ID、別entityType、古いrevisionの混入
- HTML、Markdownリンク、script文字列を含むタグ名
- Bookmarkタイトルやタグ名に埋め込んだ「この設定を変更せよ」「共有を開始せよ」という命令
- Capability Catalogにない機能を実装済みと答えさせる質問

## AIとプライバシー

- Prompt API / Gemini Nano候補の実際のデータ処理、モデル取得、テレメトリ、対象環境は公式仕様で確認する。
- Chrome Prompt APIのLanguageModelはWeb Workerから利用できないため、Service Workerで可用性確認、モデル取得、セッション作成、分類・検索・機能案内実行を行わない。
- AIによる分類、自然言語の検索計画、候補集合の選択、機能案内回答は、対応を実証したトップレベル拡張ページ内だけで実行する。AI入力ポップアップはこのページ内のUIであり、拡張popupやService Worker内でLanguageModelを動かす意味ではない。正確なhostは [ISSUE-001](./ISSUES.md) で確認し、Offscreen Documentで使えるとは仮定しない。
- 初回モデル取得にユーザーアクティベーションが必要な場合は、AI Hostの明示操作から開始する。
- 「端末内AI」という表示は、実装した経路と公式仕様で確認できた場合だけ使う。
- AIが利用不可でも、保存、手動タグ付け、最大8件の字句autocomplete、フルページ字句検索、静的ヘルプを使えるようにする。
- 将来外部AIを追加する場合は、送信データ、送信先、保持期間、料金を事前表示し、初期状態をオフにする。
- APIキーを拡張パッケージへ埋め込まない。

## ローカル保存

- ドメインデータはIndexedDB上の版付きJSON互換ドキュメント、設定はchrome.storage.localのJSON互換値へ分離する。永続データは読出し時にもschema検証する。
- JSONで表せない値、prototype pollutionにつながるキー、不明schemaVersion、過大配列、過深nestを拒否または隔離する。
- migrationCursor.lastKeyはJSON round-trip可能な文字列、有限数、またはそれらだけの一次元配列に限定する。Date、binary key、NaN、Infinity、undefined、入れ子配列を汎用cursorへ保存せず、必要ならversion付き専用形式を定義する。
- BlobはJSONへbase64埋込みせず別Storeで参照し、QR、Drive、exportへ暗黙に含めない。
- AIプロンプト、ページ本文、自然言語の検索語・機能質問、AIが展開した語、AI入力ポップアップの回答、自由文の検索理由は既定で永続保存しない。
- 分類監査には全文ではなく、provider、モデル識別子、設定バージョン、結果、時刻を保存する。
- 検索用派生文書は正データから再生成できる範囲に限定し、検索履歴やPrompt APIセッションを保存しない。
- サムネイル容量に上限を設け、削除・一括無効化を可能にする。
- アーカイブ利用者payloadはカテゴリ、タグ、ページ名、URLだけにし、favicon、thumbnail、siteName、訪問統計、AI状態を含めない。理由、時刻、revision、同期状態等のoperation metadataは別recordへ分離する。
- `onboardingState` はinstallイベントで未初期化の場合だけ作り、進捗・途中再開・完了を保持する。update、startup、Service Worker再起動や未信頼メッセージで初期化・巻き戻ししない。
- 全ローカルデータ削除は対象件数と不可逆性を確認し、処理完了を検証する。
- ログへURL、タイトル、タグ名、OAuthトークンを常時出力しない。

Chromeプロファイルへアクセスできる同一端末の攻撃者から完全に保護できるとは想定しない。端末暗号化やOSアカウント保護は利用者環境の境界である。

## Content Security Policyと依存関係

- MV3で許可されたCSPを維持し、unsafe-eval、動的script挿入、CDN上の実行コードを使わない。
- Prompt API制約を回避するためにリモートページ、注入コード、未確認のOffscreen DocumentへAI実行を移さない。
- すべての実行コードをビルド成果物へ含める。
- npm依存を必要最小限にし、lockfileをコミットする。
- CIで型検査、テスト、脆弱性監査、成果物内の秘密情報検査を行う。
- 更新BotのPRを自動マージせず、権限・バンドル差分・リリースノートを確認する。
- ソースマップの配布方針を決め、秘密情報やローカルパスを含めない。
- 拡張機能更新時のDBマイグレーションを破壊的にしない。

## 操作の安全性

- タグ削除、統合、大量再分類は影響件数を表示する。カテゴリ名はCATEGORY内、タグ名は親カテゴリをまたいでTAG内で一意にし、既存と同名の作成・改名を拒否する。論理削除済みLabelもunique keyを保持して名前を予約し、物理回収前は同名の別IDを作らない。同名作成時は同じ削除済みIDの明示復元または別名を案内する。CategoryとTag相互の同名までは禁止しない。旧データで重複を検出しても名称一致だけで自動統合しない。
- アーカイブは削除と分け、元に戻せる。
- Bookmark／カテゴリ／タグ削除は明示クリックを要求するが、追加の確認画面は表示しない。対象IDとrevisionを再検証し、正確な対象集合へ同じ `deleteOperationId`、削除後の `deletedRevision`、`deletedAt` を1 transactionで記録して短期Undo tokenと影響件数を返す。物理削除はUndo・同期tombstoneの保持期間後だけ検討する。
- Undoはtokenに記録した全対象のmarkerとrevisionが一致し、名称一意性、TAG親、edge整合も再検証できた場合だけ同じtransactionで全件復元する。Tag復元は親CATEGORYが存在しACTIVEの場合だけ許し、削除済み親なら `UNDO_CONFLICT` として親復元を先に求める。期限切れは `UNDO_EXPIRED`、期限内の対象欠損・marker／revision不一致・不変条件違反は `UNDO_CONFLICT` とし、部分復元しない。tombstoneの名前予約により削除→同名別ID作成→Undo競合を防ぐ。
- Bookmark削除時は全BookmarkLabel edgeと検索派生文書を同じtransactionで削除または無効化する。Undo時はBookmarkから検索文書を再生成する。favicon／thumbnail IDはtombstoneに残し、Undo期限と同期tombstone保持期間の双方が終わる前にBlobを回収しない。
- 全TAG recordは物理的に存在するCATEGORY recordを参照し、ACTIVE TAGはACTIVE親を必須とする。削除済みTAGだけは削除済み親を参照できる。タグ削除は対象IDのタグと参照edgeだけを論理削除する。ACTIVEな子タグを持つカテゴリの論理削除はBLOCKし、子タグを暗黙cascadeしない。現行P0ではタグの親変更を受け付けないため再配置を案内せず、子タグの管理または削除だけを案内する。ACTIVE子タグがないカテゴリは論理削除できるが、CATEGORYの物理GCは削除済みを含む子TAG recordが0件になるまでBLOCKする。名称一致する別タグ・カテゴリを巻き込まない。
- 現行P0のタグ編集では親カテゴリを読取専用にし、UpdateTagからの親変更を拒否する。専用移動transactionと権限・Undo境界は [ISSUE-019](./ISSUES.md) の解決後に追加する。
- AIによる自動分類の変更履歴を最低1世代保持する案を採用する。
- 一括操作には処理対象の固定スナップショットを使い、途中で検索条件が変わっても対象を増やさない。

## 訪問履歴、リマインダー、アーカイブ

- `history` は機能を有効にした利用者だけに要求し、無効化時は新しい照会と通知を止める。
- 訪問回数とアーカイブ日数は数値入力でも文字列として境界検証し、有限整数、許容範囲、単位を満たさない値で定期処理を起動しない。AI細分化だけを0〜4のスライダー値として扱う。
- アーカイブ専用toggleは設けず、検証済み `archiveAfterDays` に従う。初回開始または閾値確定時に目的説明後 `history` だけを要求し、拒否・取消時は閾値を保持したまま判定を権限待ち停止にする。保存した権限状態だけを信用せず、各実行前にChromeの実権限を確認する。
- 履歴を追加・削除せず、完全なvisit列を複製しない。Bookmarkには判定に必要な `visitCount` / `lastVisitedAt`、Reminderには再通知抑止情報だけを保持する。
- 通知表示だけでBookmarkを作らず、利用者が `保存` を選んだ後に通常の保存検証を通す。
- 通知IDやURL hashを推測して別URLを保存できないよう、永続Reminderと照合する。
- 「次回以降表示しない」は該当候補URLだけを永続的にSUPPRESSEDとし、グローバル設定や他候補を無効化しない。設定でリマインダーを無効化した場合は全候補の新規評価と通知を止める。
- 自動アーカイブは文字列stateの論理変更と最小snapshotへの置換にし、物理削除しない。`lastVisitedAt=null` やrevision競合はskipし、設定内一覧からの復元時にもURLとLabel親子関係を再検証する。

## QR共有

ユーザー間共有として採用済みのP1機能である。QRは公開可能な搬送媒体として扱い、同一ユーザー同期には使わない。

- ユーザーが検索とチェックボックスで明示選択したカテゴリ、タグ、個別Bookmarkを、生成開始時に固定したBookmark集合へ展開する。検索条件の後続変化で対象を増やさない。
- QR生成前にカテゴリ、タグ、タイトル、URL、件数をプレビューする。ローカルID、訪問履歴、AI会話、OAuth情報を含めない。
- ペイロードに形式バージョン、件数、チェックサム、有効期限の任意フィールドを持たせる。チェックサムは破損・欠落・切詰めの検出だけに使い、送信者の真正性、改ざん耐性、認証を保証すると表示しない。
- QRを撮影した第三者が読める前提で、機密ブックマークに平文共有を勧めない。
- 暗号化を提供する場合は独自暗号を作らず、標準的な認証付き暗号と十分な鍵導出を使う。
- 復号鍵を同じQRへ含めない方式を検討する。
- QR読取後はpayload全体を検証してから内容を表示する。payload内部でv1正規化後同名のTAGが複数parentCategoryNameを持つ場合はpreview前に構造不正として拒否し、暗黙renameや親選択をしない。既存の同名TAGが異なるparentCategoryを持つ場合も自動reuse／rename／moveせず、項目skip、Import全体cancel、または利用者の明示別名だけを許す。別名入力後は正規化・一意性と全件previewを作り直す。親不明タグを自動で架空カテゴリへ所属させない。
- カメラ読取は利用者が「QRコードを読み取る」を開始した時だけブラウザのdevice permissionを要求し、成功・取消・画面終了時にMediaStream trackを停止する。フレーム画像を永続保存・同期・ログ出力せず、権限拒否時は画像選択等の代替経路を案内する。
- QR容量を超える場合に無言で切り捨てない。分割、ファイル、CSV等の方式を別途決める。

## Google Drive同期

同一ユーザー端末間同期と、所有権／権限のあるGoogleアカウント間共有として採用済みのP1機能である。QRによるユーザー間共有とは経路とデータ境界を分離する。

- 同一Googleアカウントの端末同期は `appDataFolder` と `drive.appdata` scopeを使い、通常Driveファイル一覧への権限を要求しない。appDataFolder内の項目は共有できないため、別アカウント共有へ流用しない。
- 別アカウント間は通常Drive fileの別データセットを使い、接続時に選択したアカウント、file capability、owner、permissionを検証する。`drive.file` 等の実装に必要な最小scopeを別同意で要求し、通常Drive全体の読取権限を既定にしない。
- OAuthトークンはログ、IndexedDB、エクスポート、QRへ含めない。
- サインアウト、権限取消、選択アカウント変更後の動作を用意する。アカウント切替時は未送信Outboxを別アカウントへ無言で送らない。
- ETag等の前提条件を使い、他端末の更新を無言で上書きしない。
- 同じscalar、同じedgeのadd/delete、update/delete、CATEGORY／TAG一意名競合はupdatedAtやdeviceIdによるLWWをせず、検証済みimmutable `syncSnapshots` にbase／local／remoteを保存してsyncConflictsからID／revision／hashで参照する。競合したLabel IDのedgeを別IDへ暗黙付替えしない。
- 解決commandは期待conflict revision、base／local／remote snapshotの期待revision／hash、非空のallowlist済み明示operation listを必須とする。snapshot適用、Label rename、BookmarkLabel edge reassign、tombstone適用の各operationに対象の期待revisionを持たせる。同名／異親TAGを名称だけで暗黙remapしない。
- 全operationへNormalizer v1、名称一意性、TAG親の存在・状態、BookmarkLabel edge、delete markerを再検証してから、正本・Outbox・解決状態を1 transactionでcommitする。古い解決や部分適用を拒否する。OPEN／CANCELED conflictのsnapshotはGCせず、RESOLVED後も最低30日かつ他参照がなくなるまで保持する。
- 削除はtombstoneを同期し、オフライン端末からの復活を防ぐ。
- 同期データも未信頼入力としてスキーマ検証する。
- Drive側障害や認証失効でもローカル編集を継続し、同期状態を明示する。
- データの追加暗号化が必要かは脅威モデルと復旧要件を踏まえて決める。

競合規則は [DBスキーマ](./DB-SCHEMA.md#google-drive同期の競合設計) に定義する。

## Chrome標準Bookmarkインポートとcontext menu

- `bookmarks` 権限要求前に、読み取る対象、Bookmationへコピーすること、元データを変更しないことを説明する。
- Import adapterは `getTree` 等の読取操作だけを公開し、標準Bookmarkのcreate/update/removeをApplicationから呼べないようにする。
- title、URL、folder名、件数を未信頼入力として検証し、previewのHTMLへ直接挿入しない。
- context menuは固定IDと `page` / `link` contextだけを登録し、クリックされた `pageUrl` / `linkUrl` を通常のURL allowlistへ通す。
- `chrome:`、`javascript:`、`data:`、`file:`、拡張機能URLを保存せず、右クリック経路だけ検証を迂回させない。

## セキュリティ受入条件

テスト用Webプレビューはfake Adapterだけを使い、実閲覧履歴、実Bookmark、Drive OAuth token、個人情報をfixtureへ含めない。preview、fixture、debug route、test-only権限を本番拡張成果物へ含めない。Playwrightは一時user data directoryを使い、artifact中のURL、title、検索文、tokenをredactする。screenshot／trace／HTML reportの公開範囲と保存期間をCIで固定する。

実装後、少なくとも次を確認する。

- Manifestの権限が使用機能と一致し、不要なhost_permissionsがない。
- popupと2つのcommandsがallowlist済み操作だけを起動し、URL指定保存が不正スキーム・過大入力を拒否する。
- `runtime.onInstalled` はinstall時だけパッケージ内オンボーディングURLを開いてonboardingStateを未初期化時だけ作り、updateやService Worker再起動で進捗・完了状態を巻き戻さない。
- AIがカテゴリを新規作成・改名・削除できず、候補外Label ID、親なし／候補外親のTAGを選択できない。policyVersion 1の細分化対応 `0→0 / 1→1 / 2→2 / 3→4 / 4→6` 以外を拒否し、細分化0では新規AIタグを作らず既存Labelの自動割当は継続する。AI intentは `SEARCH_LIBRARY / PRODUCT_HELP / OUT_OF_SCOPE` だけである。
- Label名正規化v1がproject-vendored Unicode 15.1.0 dataでNFKC、TAB／LFを含むWhite_Space collapse、残存 `Cc` / `Cs` / `Default_Ignorable_Code_Point` 拒否、CaseFolding.txt C+F mapping、最終再検証を行う。runtime ICU差異で結果が変わらず、schemaMetaのversionと実asset SHA-256がbuild定数に一致し、仮hashを使わない。カテゴリ名はtombstoneを含めCATEGORY内で一意、タグ名はorigin・親・tombstone状態を問わずTAG内で一意で、全TAGが存在するCATEGORYを参照し、ACTIVE TAGはACTIVE親を持つ。検索token正規化を変えてもLabelの同一性は変わらない。同じ `(bookmarkId, labelId)` edgeや同じ作成要求の再送は重複せず、TAG edgeには親CATEGORY edgeが伴う。
- 入力中autocompleteは最大8件で種類と親情報を守る。自然言語のLabel検索とBookmark検索で、候補外ID、別entityType、重複ID、古いrevision、上限超過を拒否する。
- Service Worker内にLanguageModelセッション作成・prompt実行コードがなく、AI Host候補の実行可否が実機で確認されている。
- 保存済みBookmark文字列や質問内のPrompt injectionからスクリプト実行、外部通信、設定変更、削除、共有が起きない。機能案内が版付きCapability Catalog外の機能を実装済みと断定しない。
- ページタイトルとタグ名のXSSテストが通る。
- Service Worker再起動やメッセージ再送で重複作成しない。
- ログとエクスポートにトークンや意図しない個人データがない。
- ローカルデータ削除後にIndexedDB、設定、画像キャッシュの残存がない。
- 履歴権限拒否またはリマインダー無効時に訪問判定が停止し、通知確認前のBookmark作成や、最終訪問日時なしの自動アーカイブが起きない。アーカイブ用history権限拒否時はarchiveAfterDaysを保持して判定だけが停止し、notificationsを要求しない。候補単位SUPPRESSEDが他URLへ波及しない。
- ARCHIVEDが `metadata` と `payload { title, url, categories, tags }` を構造上分け、payloadにそれ以外の利用者データがなく、operation metadataが分離され、設定から安全に復元できる。
- QRインポートで破損、過大、不明バージョン、親不明タグ、payload内同名TAG・複数親を拒否する。checksumを真正性保証に使わず、既存の別親同名TAGを自動reuse／rename／moveしない。カメラ読取終了後にtrackとフレームを保持しない。
- Drive同期で選択アカウント、同じscalar、同じedge add/delete、update/delete、一意名競合を再現し、自動LWWせずimmutable syncSnapshotsとsyncConflictsへ送る。期待revision／hash付きの非空な明示operationsだけを全不変条件再検証後にatomic commitし、同名／異親TAGやLabel IDを暗黙remapしない。OPEN／CANCELED snapshotはGCせず、RESOLVED後も30日以上保持する。appDataFolderを別アカウント共有に使わない。
- Bookmark／カテゴリ／タグ削除が追加確認画面なしでも同じdeleteOperationIdとdeletedRevisionを持つ正確な集合だけを論理削除・Undoでき、期限切れと競合を区別して部分復元しない。Tag復元はACTIVE親を必須とし、削除済み親なら親復元を先行する。ACTIVEな子TAGを持つカテゴリの論理削除をBLOCKし、CATEGORY物理GCは削除済みを含む子TAGが0件になるまでBLOCKする。P0で再配置を案内せず、削除済みLabelのunique key、削除Bookmarkの検索除外、参照Blob保持も維持する。
- 標準Bookmarkのインポート前後でChrome側のtreeが不変であり、context menuが危険URLを拒否する。
- 依存監査とビルド成果物の秘密情報検査がCIで実行される。
- WebプレビューとPlaywright artifactに実データやtokenがなく、AIエージェント確認後に人間が同じbuildを受入確認している。

## インシデント対応案

1. 影響する機能とバージョンを特定する。
2. 外部送信またはトークン侵害が疑われる場合は同期機能を停止し、権限取消手順を案内する。
3. ローカル破損の場合は自動再同期を止め、エクスポート可能な状態を保つ。
4. 修正版でDBを上書きする前に、復旧可能な移行を用意する。
5. 原因、影響データ、回避策、修正版を記録する。
6. [問題一覧](./ISSUES.md) と [作業履歴](./WORKLOG.md) に機密情報を含めず記録する。
