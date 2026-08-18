# 制約

- 状態: 固定条件と実装境界
- 基準日: 2026-08-17

## 判断の境界

- 機能・挙動は最新の明示要件、画面構成・外観は `デザインシート.svg` を正本とする。
- 削除済みの旧企画 PDF は情報が古いため、現行要件の根拠に使わない。
- 参考サイトは着想に限り、正本を上書きしない。
- Plasmo + React + Tailwind CSS + TypeScript の実装版は `package.json` と `pnpm-lock.yaml` を正本とする。package manager は pnpm。推奨 Node は `.nvmrc` の 22。
- 利用者向け正式名称はカテゴリ／タグとし、内部総称 `Label`、enum `CATEGORY` / `TAG` をUIへ露出しない。

## 固定するプロダクト制約

1. デスクトップ版 Chrome Manifest V3 拡張を初期対象とする。
2. Bookmark は Bookmation 専用で、Chrome 標準 bookmark / folder を正本にしない。
3. カテゴリを親、タグを子とする。activeなTagは1件のactiveな親Categoryに所属する。tombstone Tagはdeleted親Categoryを参照できる。親Categoryの物理GCは、そのIDを参照する全子Tag tombstoneが消滅するまでblockする。
4. 1件のBookmarkに複数Tagを付与でき、同じLabel IDを複数Bookmarkで再利用できる。BookmarkのCategory集合はactiveなTagの親から自動導出し、直接編集させない。Tag割当transactionは親Category edgeを整合させ、最後の子Tag edgeが外れた時は不要になった派生Category edgeも外す。
5. カテゴリはユーザーだけが作成し、正規化名が同じカテゴリは論理削除中を含めて1件だけとする。
6. Tagは論理削除中を含め、親Categoryをまたいで正規化名をglobal uniqueにし、同名の別IDを許さない。AIは既存ユーザー定義タグを優先し、不足時だけ細分化度の範囲内で作る。
7. 同じ `(bookmarkId, labelId)` edge は冪等性のため1件とする。
8. ホームは最近追加を `savedAt` 降順で表示する。
9. 一覧表示は LIST / GRID だけとし、弁当、列数選択、ブックマーク表示数変更プルダウンを設けない。
10. Bookmarkのカテゴリは常時表示し、タグはクリック／キーボードで展開する。hoverは補助だけにする。
11. カテゴリ・タグ一覧は右サイドではなく全画面表示し、カテゴリリボンの配下に子タグチップをまとめる。
12. ブックマーク一覧とカテゴリ・タグ一覧は同じ統合検索を使う。keyword結果は全画面検索ページへ切り替えて表示し、AI自然言語検索は入力元画面上のポップアップ内で入力と応答を完結させる。
13. keyword／AIのどちらもカテゴリ、タグ、Bookmarkを検索し、カテゴリ・タグを上、Bookmarkを下に置く。AI候補は各グループ内で複数の無順位集合として表示し、score、順位、先頭への自動遷移を使わない。
14. 一覧は cursor による無限スクロールで追加し、両一覧にトップへ戻る操作を置く。
15. 各Bookmarkにedit操作を置き、name、URL、Tagだけをモーダルで扱う。Categoryは選択中Tagの親から自動導出して読取表示し、直接入力を置かない。Bookmark deleteでは確認画面を挟まない。
16. popup は保存／ホームの2操作、実キーまたは未割当、Chrome管理画面への変更案内を表示する。
17. AI 細分化度は設定画面の0〜4スライダーだけで変更し、過去データを自動再分類しない。1件あたりのAI新規Tag上限は順に0／1／2／4／6件とし、0でも既存カテゴリ／タグへの自動付与を継続する。
18. AI が使えなくても保存、編集、keyword検索、手動整理を継続できる。
19. 頻繁に訪問する未保存サイトは、自動Bookmarkリマインダーが有効で、選択期間内の訪問日数が設定閾値へ到達した時だけ知らせ、利用者が `はい` を選んだ場合だけ専用Bookmarkへ保存する。同日複数訪問は1日とし、`いいえ` はそのcanonical URLの集計基準を応答時刻へresetする。`次回以降表示しない` を選んだURLは候補から除外し、無断保存しない。
20. 訪問集計期間は1週間／1ヶ月／1年のプルダウンとし、当日を含む直近7／30／365暦日へ対応させる。訪問日数の既定値は設けず、期間変更時も数値入力を空にして1〜7／1〜30／1〜365へ制限する。アーカイブ閾値は既定30日の単位付き数値入力とし、AI細分化度だけをスライダーにする。
21. 自動アーカイブは既定OFFのtoggleを持ち、history権限が許可された時だけONへcommitできる。拒否／取消時はOFFを維持し、後発取消でもOFFへ戻す。ON時は最終訪問日時と設定日数で判定し、文字列 `archiveState` を更新して物理削除せず復元可能にする。履歴なしは項目別エラーとしてarchiveせず、アーカイブ後の利用者データはページ名、URL、カテゴリ、タグだけに縮小する。
22. 設定画面のアーカイブ欄にはアーカイブ済みBookmarkをリスト表示し、検索とチェックボックスで選んだ項目を復元できるようにする。
23. ユーザー間共有はQR／CSV export、同一Googleアカウントの端末間同期は `appDataFolder`、所有権または共有権限を確認できる別アカウントとの共有は通常Drive fileを使い、用途とOAuth scopeを混同しない。Driveでは利用者が対象アカウントを選び、通常fileのpermissions／capabilitiesを確認する。
24. QR／CSV共有はカテゴリ別、タグ別、個別Bookmarkから検索とチェックボックスで対象を選び、同じ固定集合から両形式を生成する。QR容量超過時は分割・切捨てをせず、エラーからCSV exportへ誘導する。QR読取インポートは提供するがCSV importは要求しない。
25. Chrome標準Bookmarkのインポートは明示操作でBookmationへコピーし、各Bookmarkの直上Folderだけを1件のTagへ対応させる。祖先／full pathをLabel化せず、取込時のAI分類を行わない。同名active Tagは再利用し、新規Tagの親Categoryは利用者がpreviewで選択／作成する。標準BookmarkとFolderを変更・削除しない。
26. ページ／リンクの右クリック保存は、端末固有の設定toggle `contextMenuBookmarkEnabled`（既定ON）で有効化する。ONではBookmation所有の固定menu IDだけを重複なく登録し、OFFでは解除する。保存直前にも設定を再確認し、既存のURL検証・重複検出・保存ユースケースを再利用する。
27. 拡張機能UIは本番componentを共有するテスト／モック用の通常Webページでも表示できるようにする。プレビュー専用の画面コピーを作らない。
28. Webプレビューはfake Adapterと版管理fixtureだけを使い、実Chrome profile、実閲覧履歴、実OAuth tokenを暗黙に参照しない。
29. 人間の受入確認より先に、AIエージェントがビルド済み拡張機能をPlaywrightで確認し、report、screenshot、trace、skipを含む証拠を残す。
30. WebプレビューとAIエージェント確認は人間の最終受入を代替しない。人間は同じcommit／buildを確認し、承認または差戻しを記録する。
31. `runtime.onInstalled` の `reason=INSTALL` だけを初回ウェルカム表示の起点にし、`UPDATE` や開発時reloadでは再表示しない。開始完了後は最近追加したBookmark一覧を通常ホームにする。
32. カテゴリ・タグ一覧の新規作成は種類をプルダウンで選んでモーダルを開き、閉じるまで連続作成できる。Tag作成にはactiveな既存Categoryの選択を必須とし、入力中に一致度の高い候補を最大8件表示する。Category／Tagとも正規化後の同名作成を拒否し、既存候補を選択する元画面へ戻るか別名を入力するよう案内する。
33. Bookmark編集ではTagだけを分類入力とし、説明横の新規作成から同一モーダル内のTag作成サイドビューへ切り替える。Tag作成にはCategory新規作成ボタンを置き、同じモーダルのCategory作成サイドビューへ進む。各遷移で入力draftを保持し、Category作成後はTag作成へ戻って新規Categoryを自動選択する。
34. カテゴリ・タグ一覧の管理ボタンで管理モードへ切り替える。管理中はカテゴリリボン／タグチップの選択で編集モーダルを開き、鉛筆はhover／focus時だけ補助表示する。Category編集にはactiveな使用中Tagの実名一覧と件数、および関連Bookmarkのunique件数を表示する。Tag編集ではactiveな既存Categoryを入力し、最大8候補から選択するか、同じモーダルのCategory作成サイドビューで新規作成する。draftを保持し、作成後は新規Categoryを自動選択する。
35. BookmarkとTagは確認画面なしで論理削除する。Category削除だけは、全子Tagと関連edgeが連鎖削除され、Bookmarkが再分類されること、および影響するTag件数とBookmark unique件数を警告して確認する。承認後はCategory、全子Tag、関連edgeを1 transactionでsoft-deleteし、Bookmark本体を残して影響Bookmarkの分類Jobを `PENDING` にする。AI分類失敗は `NEEDS_REVIEW` と手動分類へ送り、削除後のUndo toast、token、期限、復元入口は設けない。
36. 統合検索、カテゴリ入力、タグ入力のautocompleteは入力中のkeyword一致度で既存候補を最大8件表示し、8件超を一度に展開しない。
37. Category／Tag名称正規化v1はprojectにvendoredしたUnicode 15.1.0のNFKCデータ、`White_Space` property、`Default_Ignorable_Code_Point` property、`CaseFolding.txt` のstatus C＋F mappingだけを使う。rawの`Cs`／Default Ignorable拒否、NFKC、TAB／LFを含む空白のtrim／単一ASCII空白化、残存`Cc`／`Cs`／Default Ignorable拒否、locale非依存case fold、最終再検証の順で決定的に適用し、空になった名前を保存しない。runtime ICUや端末Unicode版へ依存せず、生成assetのhashは実装時に生成・固定する。検索queryのtoken正規化とは別契約にする。
38. Category／Tagの論理削除tombstoneは一意名を予約し、同名の別ID作成を防ぐ。名前を再利用できるのは物理回収後だけである。
39. P1 Drive競合はimmutableな `syncSnapshots` と明示的なresolution planで扱う。競合がopenの間は参照snapshotをGCせず、解決後も30日保持する。Label IDまたはBookmark-Label edgeを暗黙にremapしない。
40. Tagの親Category変更は管理モードの利用者操作だけに限定する。Tagと選択先Categoryの期待revision、およびsubmit開始時に1回発行して同一retryで再利用する `tag-update:<UUID>` requestIdを検証し、Tagの親、全参照BookmarkのCategory closure・revision・検索派生データ、同期Outbox、mutation receiptを1 transactionで更新する。Category削除requestは別の `category-delete:` namespaceとする。途中失敗は全件rollbackし、同じrequest再送は同じ `UpdateTagResult` へ収束させ、別payloadでのrequestId再利用を拒否する。AI再分類Jobは作らず、Tag名のglobal unique規則は変更しない。
41. 初回オンボーディングにカテゴリテンプレート機能を設ける。catalogを表示しただけ、install、update、reloadだけではCategory recordを作らず、利用者が明示的に適用した項目だけを通常の `origin=USER` Categoryとして名称一意性と冪等性を検証して作成する。具体的なcatalogと導線はISSUE-022の決定前に固定しない。

## AI と実行環境

- P0 は Chrome Prompt API 候補を使う端末内 AI とし、外部 LLM へ自動 fallback しない。
- LanguageModel は Web Worker から利用できないため、MV3 Service Worker で availability、session、prompt を実行しない。
- 対応を実証したトップレベル拡張ページだけを AI Host にする。Offscreen Document 対応を仮定しない。
- AI 出力は候補 ID、kind、origin、revision、件数、文字列を再検証する。
- AIはカテゴリを作成・改名・削除できない。
- AI自然言語ポップアップはBookmark／カテゴリ／タグの探索に加えてBookmationの機能全般の説明を受け付けるが、説明から破壊的操作や設定変更を自動実行しない。
- 日本語対応、必要 Chrome、モデル準備、ユーザー activation は実装スパイクで確認する。

## データと権限

- 正本はIndexedDB上の版付きJSON互換ドキュメント、少量設定は `chrome.storage.local` のJSON互換値とする。SQL/RDBを前提にしない。
- JSON文書には `schemaVersion` を持たせ、`undefined`、関数、循環参照、非有限数、BigIntを保存しない。画像BlobはID参照にして別Storeへ分離する。
- P0 の初期権限候補は `storage` と `activeTab`。`commands` は2操作を manifest 宣言する。
- P1では `contextMenus` と定期判定用 `alarms` を宣言し、`history`、`notifications`、`bookmarks`、`identity` / Drive OAuthは機能の開始時に目的を説明して必要な範囲だけ要求する。リマインダー開始時は履歴・通知、自動archive toggleのON操作時は履歴だけを要求する。自動archiveはhistory許可前にONへ保存せず、後から権限が消えた場合もOFFへ戻す。P0へ無条件追加しない。
- 履歴は判定に必要な集約値だけを保持し、履歴の追加・削除を行わない。Drive OAuthトークンはIndexedDBや同期payloadへ保存しない。
- アーカイブ済みBookmarkはページ名、URL、カテゴリのID／表示名、タグのID／表示名／親カテゴリID以外のサムネイル、説明、検索用本文、訪問集約値を保持しない。復元に不可欠なBookmark ID、状態、schema version等は分離した最小メタデータとして扱う。
- URL は P0 で `http:` / `https:` だけを許す。
- popup は `chrome.commands.getAll()` でキーを読む。変更は `chrome://extensions/shortcuts` で利用者が行い、拡張機能内の書換APIを仮定しない。
- AI query、Prompt、本文は既定で永続化しない。

## UI・アクセシビリティ

- デザインシートのデスクトップ UI を基準にし、200% 拡大や狭い幅でも機能を欠落させない。
- sticky header が本文やフォーカス対象を隠さないよう scroll margin を設ける。
- Dialog は背景 inert、focus trap、Esc、trigger への focus 復帰を備える。
- hover だけに情報や操作を置かない。
- autocompleteは編集対象の入力と関連付けたcombobox/listboxとして最大8候補を示し、矢印キー、Enter、Esc、読み上げで選択できるようにする。
- AIポップアップは入力、処理中、応答、失敗、再試行を同じDialog内で確認できるようにする。
- 無限スクロールの追加件数、終端、失敗を支援技術へ通知し、既読内容を失わない。
- back-to-top は見出しへ focus を戻し、reduced motion を尊重する。
- AI 由来、選択、エラーを色だけで示さない。

## テスト環境

- 通常WebページのUIプレビュー、Vitest、Playwright拡張機能E2E、実Chromeでの人間確認を別のテスト面として扱う。
- WebプレビューはUI、状態、レスポンシブ、アクセシビリティの確認用であり、permissions、commands、Service Worker、拡張機能originの成功根拠に使わない。
- Playwrightは一時user data directoryへビルド済み拡張機能を読み込み、日常利用中のChrome profileを使わない。
- AIエージェントがブラウザを実行できなかった場合は未実施を明示し、WebプレビューだけでE2E成功と報告しない。
- screenshot基準の更新、skipの受容、最終受入は人間が判断する。
- preview、fixture、debug操作、テスト資格情報を本番拡張成果物へ含めない。
- 詳細な順序と証拠は [TESTING.md](TESTING.md) を正本とする。

## 現時点で固定しないもの

- responsive grid の breakpoint とカード最小幅
- 無限スクロールの page size、preload距離、仮想化閾値
- AI検索応答に含める種類別最大候補数、製品説明の正本データ、評価dataset
- サムネイル取得方式と容量上限
- 訪問判定の初期期間、回答せず閉じた通知の再表示規則、SUPPRESSED URLの管理／再許可UI
- 最終訪問日時が存在しないBookmarkの再確認UI
- QR encoder別の実効容量、任意暗号化、CSVの長期互換性
- Google Driveの複数所有アカウント間方式、競合UI、tombstone保持期間、追加暗号化

未決事項は [ISSUES.md](ISSUES.md) で追跡する。
