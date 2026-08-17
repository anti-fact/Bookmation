# 問題・未決定事項

- 状態: Open の項目は実装前または対象フェーズ開始前に決定する。
- 基準日: 2026-08-17

## 運用規約

- `Open`: 判断材料または担当が不足している。
- `Spike`: 小さな検証コードや実機確認が必要である。
- `Decided`: 結論と根拠を関連文書へ反映済みである。
- 実装中に意図して先送りした品質問題は [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) へ移す。
- 1 PR 程度で判断不要な作業は [TODO.md](TODO.md) へ置く。

## 一覧

| ID | 状態 | フェーズ | 問題 | 決めること / 完了条件 |
| --- | --- | --- | --- | --- |
| ISSUE-001 | Spike | P0 | Gemini Nano / Prompt API の対応条件が端末と Chrome に依存し、Web Worker では実行できない | Dashboard または Side Panel 等の対応ドキュメントで、日本語分類、ユーザー操作、最低 Chrome 版、モデル取得 UX、構造化出力、Workerとのメッセージングを確認する |
| ISSUE-002 | Open | P0 | サムネイルの取得はプライバシー、CSP、容量、失敗率に影響する | `og:image` 参照、ローカル取得、画面キャプチャ、代替面のどれを既定にするか決める |
| ISSUE-007 | Open | P0 | ハッカソンの締切・審査基準・デモ環境が資料にない | チームで一次情報を確認し、P0 の日程・成功指標・デモ端末を Execution Plan に記録する |
| ISSUE-008 | Open | P1 | 自動Bookmarkリマインダーの有効化と対象URLの `次回以降表示しない` は確定したが、数値閾値の既定値、集計期間、再通知間隔が未定である | 権限説明、既定値・上限、対象除外、cooldown、除外URLの管理／再許可UIを決める。保存は利用者確認後だけという要件は変更しない |
| ISSUE-009 | Open | P1 | 自動アーカイブは確定したが、数値閾値の既定日数、実行頻度、履歴がない項目の扱いが未定である | 既定値・上限、実行頻度、結果通知を決める。設定内のリスト選択復元と、`lastVisitedAt=null` を自動変更しない境界は維持する |
| ISSUE-010 | Open | P1 | QR共有／読取インポートは確定したが、容量、分割方式、送信者真正性の要否が未定である | カテゴリ別・タグ別・個別選択を版付きJSON payloadへ落とし込み、最大件数、分割、checksumによる破損／切詰め検出、受信確認を試験する。真正性が必要ならchecksumとは別に署名またはMAC方式を決める |
| ISSUE-011 | Open | P1 | Google Driveは同一アカウント同期と別アカウント共有で保存領域が異なる | 同一アカウントは `appDataFolder`、所有権／共有権限を確認できる別アカウントは通常Drive fileとする境界を守る。immutable syncSnapshots、明示resolution plan、open中GC禁止、解決後30日保持、暗黙Label／edge remap禁止を変更せず、アカウント選択、OAuth scope、permissions／capabilities、競合UI、バックアップの残件を決める |
| ISSUE-013 | Open | 運用 | タスク管理を Linear にする希望はあるが確定していない | チームのアカウントと運用責任を確認し、正本を一つに決める |
| ISSUE-014 | Open | P0 | AIポップアップの検索候補上限、製品機能説明の正本、応答時間、AI非対応時の縮退が未確定である | 同じDialog内の入力／応答、種類別の無順位集合、最大件数、説明の参照データ、応答時間、lexical fallbackをprototypeで決める |
| ISSUE-015 | Open | P0 | URL 指定保存で取得できるメタデータと通信権限の境界が未確定である | URL 検証、タイトル入力の代替、ファビコン・サムネイル取得、host permission 不要の縮退動作を決める |
| ISSUE-016 | Open | P1 | Chrome標準BookmarkのFolderを親カテゴリ／子タグへどう対応するか未定である | tagなし取込、folder path保持、利用者確認付き階層化を比較し、元tree非変更と重複規則を固定する |
| ISSUE-017 | Open | P1 | QRへ収まらない共有をどう扱うか未定である | 分割QRまたは別の明示exportを決め、無言の切捨てを禁止する |
| ISSUE-018 | Open | P0 | UI Webプレビューのrunner、Playwright／Chromium版、CI artifact保持条件が未確定である | Storybookまたは同等preview appを比較し、`ui:preview` / `ui:build` / `test:e2e` / `test:e2e:ui`、visual baseline、report／trace保持期間をTASK-013で固定する。通常Webページ、AIエージェント先行、人間最終受入という要件は変更しない |
| ISSUE-020 | Open | P0 | keyword autocompleteは最大8件で確定したが、一致度と種類混在時の配分が未定である | 正規化、前方一致／部分一致、カテゴリ・タグ・Bookmarkの配分、同点規則、IME中の挙動を固定し、キーボード操作を試験する |
| ISSUE-022 | Open | P0 | 初回カテゴリテンプレート機能は採用確定だが、具体的なcatalogと導線が未確定である | 候補名と件数、1組／複数set、選択方式、初期選択、skip可否、名前編集、初回後の再表示場所、言語・地域、catalog version、再適用、既存／tombstone同名競合時の表示を決める。利用者の明示適用前にCategory recordを作らず、適用時は通常のUSER Category作成規則を通す境界は維持する |

## 決定済み

| ID | 状態 | 決定 | 根拠 |
| --- | --- | --- | --- |
| ISSUE-D01 | Decided | 左フォルダツリーを採用しない | 現行UIは全画面カテゴリ・タグ一覧を正本とする |
| ISSUE-D02 | Decided | P0 はブラウザ標準ブックマークを変更しない | 拡張機能専用ブックマークという今回の要件 |
| ISSUE-D03 | Decided | AI 非対応時に外部APIへ自動送信せず、手動分類へフォールバックする | プライバシーと P0 スコープを守るため |
| ISSUE-D04 | Decided | 旧企画資料由来で保留していた訪問、archive、QR、DriveをP1確定機能へ昇格する | 2026-08-16の利用者による明示的な再承認 |
| ISSUE-D05 | Decided | カテゴリを親、タグを子とする | 2026-08-17の利用者による明示要件。平坦モデルを置き換える |
| ISSUE-D06 | Decided | カテゴリはユーザー作成のみ、タグはユーザー定義優先で必要時だけAI作成とする | 最新の利用者依頼 |
| ISSUE-D07 | Decided | カテゴリ名とTag名はそれぞれ論理削除中を含めて正規化後にglobal uniqueとし、Tagは親カテゴリが異なっても同名別IDを許可しない。既存Labelは複数Bookmarkで再利用できる | 2026-08-17の最新上書き。作成時は既存候補を選択し、削除済み同名tombstoneがあれば物理回収まで別名を案内する |
| ISSUE-D08 | Decided | UI 実装基盤は Plasmo（React ベース）+ Tailwind CSS とする | 最新の利用者依頼 |
| ISSUE-D09 | Decided | ポップアップの2ボタン、2ショートカット、URL指定保存、最近追加ホームをP0に含める | 利用者依頼 |
| ISSUE-D10 | Decided | 更新済みデザインシートをUI配置正本とし、LIST / GRID、全画面カテゴリ・タグ一覧、初回ウェルカム、設定の一般／アーカイブ／共有、sticky header、edit modal、infinite scroll、back-to-topを採用する | 2026-08-17の依頼と更新済みSVG |
| ISSUE-D11 | Decided | 両一覧のkeyword検索は全画面検索へ切り替え、カテゴリ・タグを上、Bookmarkを下に表示する。入力中は最大8候補とする | 2026-08-17の利用者依頼 |
| ISSUE-D12 | Decided | AI自然言語検索は専用全画面ページを作らず入力元画面のポップアップ内で入力／応答し、検索と製品機能説明を扱う | 2026-08-17の利用者依頼 |
| ISSUE-D13 | Decided | 頻繁に訪問する未保存サイトは設定でリマインダーを有効にした場合だけ通知し、保存確認後だけBookmationへ保存する。対象URLは `次回以降表示しない` で除外できる | 2026-08-17の利用者依頼と無断保存を避ける安全境界 |
| ISSUE-D14 | Decided | 最終訪問日時と数値入力した期間で休眠Bookmarkを判定し、アーカイブ後はページ名、URL、カテゴリ、タグだけを利用者データとして残し、設定内リストから選択復元する | 2026-08-17の利用者依頼 |
| ISSUE-D15 | Decided | ユーザー間共有は選択式QR生成／読取インポート、同一Googleアカウントの端末間同期は `appDataFolder`、所有権／共有権限を確認できる別アカウントとの共有は通常Drive fileとする | 2026-08-17の利用者依頼とDriveの共有境界。詳細はISSUE-011で閉じる |
| ISSUE-D16 | Decided | 標準Bookmarkは明示操作でBookmationへコピーし、元データを変更しない | 2026-08-16の利用者依頼 |
| ISSUE-D17 | Decided | page／linkのcontext menu保存を通常保存use caseへ合流させ、一般設定の端末固有toggleで登録／解除する | 2026-08-16の保存要件と2026-08-17の設定toggle要件 |
| ISSUE-D18 | Decided | DB正本はIndexedDB上の版付きJSON互換documentとし、Blobは別Storeにする | 2026-08-16の利用者依頼 |
| ISSUE-D19 | Decided | 本番UIを通常Webページでモック表示し、AIエージェントがPlaywrightで実拡張を確認した後、人間が最終受入する | 2026-08-16の利用者による明示要件。詳細はTESTING.mdを正本とする |
| ISSUE-D20 | Decided | 訪問回数閾値とアーカイブ閾値は数値入力、AI細分化度だけは0〜4のスライダーとする。0でも既存カテゴリ／タグの自動付与は続ける | 2026-08-17の利用者依頼 |
| ISSUE-D21 | Decided | `runtime.onInstalled` の `reason=INSTALL` だけで初回ウェルカム画面を表示し、開始後の通常ホームを最近追加一覧にする | 2026-08-17の利用者依頼と更新済みSVG。更新／開発時reloadを初回扱いしない |
| ISSUE-D22 | Decided | Bookmark編集では名前、URL、Tagだけを編集し、CategoryはTagの親から自動導出する。Tagの新規作成は同一モーダル内サイドビューで提供する | 2026-08-17の最新利用者依頼。CategoryをBookmarkから直接編集しない |
| ISSUE-D23 | Decided | カテゴリ・タグ一覧の新規作成プルダウン、閉じるまでの連続作成、管理モード、項目選択編集、hover／focus時の鉛筆表示を採用する | 2026-08-17の利用者依頼と更新済みSVG |
| ISSUE-D24 | Decided | BookmarkとTagの削除では確認画面を表示しない。Category削除だけは全子Tagの連鎖削除と影響Bookmark再分類を警告して確認する | 2026-08-17の最新利用者依頼。いずれも論理削除でUndoは提供しない |
| ISSUE-D25 | Decided | AI細分化度0／1／2／3／4の1件あたり新規Tag上限を0／1／2／4／6件とし、0でも既存カテゴリ／タグの自動付与を続ける | 2026-08-17の0〜4要件を実装可能な上限へ具体化した |
| ISSUE-D26 | Decided | Category削除は確認後、Category、全子Tag、関連edgeを原子的にcascade soft-deleteし、Bookmark本体を残して影響Bookmarkを再分類する | 2026-08-17の最新利用者依頼。AI失敗はNEEDS_REVIEWと手動分類へ送る |
| ISSUE-D27 | Decided | Label名称正規化v1はproject-vendored Unicode 15.1.0のNFKC／`White_Space`／`Default_Ignorable_Code_Point`／`CaseFolding.txt` C＋F assetだけを使い、runtime ICUへ依存しない。生成assetのhashは実装時に固定する | 端末・入力経路によって「同名」判定が変わらないようにする。検索queryのtoken正規化とは分離し、version更新時は再索引前に競合を隔離する |
| ISSUE-D28 | Decided | 自動archiveの設定は日数の数値入力だけとし、独立した有効／無効toggleは現行UIへ追加しない。AI細分化だけをsliderにし、自動Bookmarkリマインダーと右クリック保存は独立したtoggleとする | 2026-08-17の最新設定要件と更新済みデザインシート |
| ISSUE-D29 | Decided | active Tagだけにactive親Categoryを必須とする。tombstone Tagはdeleted親を参照でき、親Categoryの物理GCは全子Tag tombstoneが消滅するまでblockする | soft-delete中の親子参照とtombstoneの同期安全性を保つため |
| ISSUE-D30 | Decided | P1 Drive競合はimmutable syncSnapshotsと明示resolution planで扱う。open中は参照snapshotをGCせず、解決後30日保持し、Label ID／edgeを暗黙にremapしない | 競合解決の監査性と巻戻し余地を保ち、同名禁止・親子edgeを暗黙処理で破壊しないため |
| ISSUE-D31 | Decided | Bookmark、Category、Tagの削除Undoは提供しない。削除後のUndo toast／token／期限／復元入口を作らず、論理削除tombstoneと物理回収条件を維持する。Bookmark／Tagは確認なし、Categoryだけはcascade影響警告を確認する | 2026-08-17の利用者による最新上書き。アーカイブからの復元とDrive同期競合のtombstone処理は削除Undoではないため維持する |
| ISSUE-D32 | Decided | `contextMenuBookmarkEnabled` は端末固有で既定ONとする。ONではpage／link固定IDを冪等登録し、OFFではBookmation所有IDを解除して遅延clickも拒否する | 2026-08-17の利用者による設定toggle追加。既存の右クリック保存を維持し、Drive同期や権限取消とは分離する |
| ISSUE-D33 | Decided | 初回オンボーディングにカテゴリテンプレート機能を設ける。具体的な候補と操作方式はISSUE-022で決める | 2026-08-17の利用者による機能採用。Categoryは利用者の明示操作で作成する既存不変条件を維持する |
| ISSUE-019 | Decided | 管理モードのTag編集から親Categoryを変更できる。activeな既存Categoryを最大8候補から選ぶか同一モーダルのサイドビューで作成し、Tag／親expected revisionとsubmit開始時に1回発行する `tag-update:` requestIdを検証して全参照BookmarkのCategory closure・revision・検索派生データを原子的に更新する。同request再送は同じ `UpdateTagResult` へ収束する | 更新済みデザインシートと2026-08-17の最新利用者指示。親変更ではAI再分類を行わず、Tag名のglobal uniqueを維持する。Category削除は別の `category-delete:` namespaceとする |
| ISSUE-006 | Decided | pnpm 10.15.1、Plasmo 0.90.5、React 18.3.1、Tailwind 3.4.17、TypeScript 5.9.2。推奨 Node 22。品質コマンドは `dev` / `build` / `lint` / `typecheck` / `test` | TASK-001 の scaffold と lockfile。`engines` は Plasmo/Parcel の解決バグを避けるため置かない |
