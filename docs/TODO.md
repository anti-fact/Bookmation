# TODO

## 使い方

この文書は、原則として一人が一回の短い作業で完了・検証できる小規模タスクだけを扱う。チームで分担する実装ワークパッケージは [TASKS.md](TASKS.md)、複数領域をまたぐ、半日を超える、データ移行や権限変更を伴う、調査結果で方針が変わる作業は [PLANS.md](PLANS.md) に従ってExecution Planへ昇格させる。

各項目は「作業」だけでなく完了判定を持つ。着手時は担当と日付を追記し、完了したらチェックを付けて [WORKLOG.md](WORKLOG.md) に検証結果を残す。問題が見つかっただけなら [ISSUES.md](ISSUES.md)、意図的な暫定策なら [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) へ記録する。

## P0 — 実装開始前

- [x] **TODO-001: 文書間リンクを検査する**（2026-08-14）
  - 完了結果: 最新UI要件への更新後、Markdown パーサーで相対リンク177件と見出しリンク13件を再検査し、参照先漏れ0件を確認した。`AGENTS.md` も見出しとリンクだけである。
- [x] **TODO-002: `AI_GUIDE.md` が空であることを確認する**（2026-08-14）
  - 完了結果: `wc -c docs/AI_GUIDE.md` が0バイトであり、本文・テンプレートがないことを確認した。
- [x] **TODO-003: 初期実装用Execution Planの骨子を作る**（2026-08-16）
  - 完了結果: [docs/plans/2026-08-16-dev-scaffold.md](plans/2026-08-16-dev-scaffold.md) に縦切り Plan を置いた。M1（scaffold）まで完了。保存→一覧は M2 / M3。
- [x] **TODO-004: Node.jsとパッケージマネージャーの候補を記録する**（2026-08-16）
  - 完了結果: pnpm 10.15.1 + `pnpm-lock.yaml`、推奨 Node 22（`.nvmrc`）、Plasmo 0.90.5 / React 18.3.1 / Tailwind 3.4.17 / TypeScript 5.9.2 を固定した。
- [ ] **TODO-005: Prompt APIの対応条件を一次資料で再確認する**
  - 完了条件: 確認日、Chrome版、OS、言語、必要な利用者操作、`availability()` の状態を [CONSTRAINTS.md](CONSTRAINTS.md) に反映する。
- [ ] **TODO-006: AI利用不可時の文言を確定する**
  - 完了条件: 保存を継続できること、手動分類へ進む操作、再試行方法を短い日本語で [UI.md](UI.md) に追記する。

## P1 — 最初のprototype前

- [ ] **TODO-007: 分類fixtureを10件作る**
  - 完了条件: 親カテゴリ一致／不一致、カテゴリ／タグ各namespaceの同名拒否、カテゴリ名とタグ名の相互一致、親子不整合、USER／AI由来タグ競合、細分化と上限のdiscriminated snapshotを含むfixtureを用意する。親／意味不適合はNEEDS_REVIEW、`0` は新規AIタグ0件かつ既存タグ自動付与ありを確認する。
- [ ] **TODO-008: 重複URLの期待動作を決める**
  - 完了条件: URL正規化、再保存、タグ統合、利用者確認の4ケースを [REQUIREMENTS.md](REQUIREMENTS.md) または [DB-SCHEMA.md](DB-SCHEMA.md) に記録する。
- [ ] **TODO-009: 表示設定の初期値を決める**
  - 完了条件: LIST / GRIDの初期値、タグ展開状態、sticky header、back-to-top表示閾値を [UI.md](UI.md) に記録する。
- [ ] **TODO-010: 最小権限一覧をmanifest作成前にレビューする**
  - 完了条件: 各権限について利用機能、要求タイミング、権限なしの代替動作を [SECURITY.md](SECURITY.md) に記録する。
- [ ] **TODO-011: service worker中断の手動テスト手順を書く**
  - 完了条件: 保存処理中のworker停止、再起動、再送を再現し、重複や部分保存を判定できる手順をテスト文書またはPlanへ追加する。
- [ ] **TODO-012: UI参考サイトの確認日を更新する**
  - 完了条件: [REFERENCES.md](REFERENCES.md) の参照日、確認済み事実、推測を区別し、変化した箇所を [UI.md](UI.md) に反映する。
- [ ] **TODO-013: commandsの既定shortcut候補を検証する**
  - 完了条件: Chromeと主要OSで「現在ページを保存」「ホームを開く」の競合を確認し、変更方法と競合時の表示を [UI.md](UI.md) とmanifest設計へ記録する。
- [ ] **TODO-014: AI検索／機能説明fixtureと集合評価を作る**
  - 完了条件: Bookmark探索とBookmation機能説明を含む10件以上の質問、期待Label / Bookmark集合、期待する機能説明、AI不可時fallbackを用意する。ポップアップ内で入力と応答を確認でき、検索結果はカテゴリ・タグが上、Bookmarkが下で、順位に依存せず未知IDを拒否できる。
- [ ] **TODO-015: デザインシートのtokenを抽出する**
  - 完了条件: 色、余白、文字、角丸、sticky header、dialogの再利用tokenを記録し、SVGを直接改変しない。
- [ ] **TODO-016: JSON document schema fixtureを作る**
  - 完了条件: 各Storeの正常／未知版／過大／非JSON値fixtureとround-trip test方針を [DB-SCHEMA.md](DB-SCHEMA.md) に反映する。
- [ ] **TODO-017: 訪問・archive設定の残る運用値を評価する**
  - 完了条件: 訪問日数の既定null、期間3種と1〜7／1〜30／1〜365日の境界、期間変更時clear、同日重複排除、`いいえ` のURL別reset、旧回数設定migration、`DISMISSED` の再表示、`frequentVisitReminderEnabled`、canonical URL単位SUPPRESSED、archive toggle既定OFF／history許可時だけON／取消時OFF、archive日数既定30と範囲、履歴なしエラーをfixtureで比較する。初期期間、SUPPRESSED再許可、archive実行頻度／履歴再確認UIを [ISSUES.md](ISSUES.md) で決め、確認前保存禁止と履歴なしarchive不可を維持する。
- [ ] **TODO-018: 標準Bookmark取込fixtureを作る**
  - 完了条件: 深いfolder、空folder、重複URL、危険URL、Unicode名、途中失敗を含め、Chrome側tree不変を検証できる。
- [ ] **TODO-019: フルページ検索の入力候補fixtureを作る**
  - 完了条件: ブックマーク一覧／カテゴリ・タグ一覧の両入口、IME、0件、1件、8件、9件以上、カテゴリ名とタグ名の相互一致、古い応答を用意し、候補が最大8件で選択後に正しい対象へ移動する。
- [ ] **TODO-020: カテゴリ・タグ作成／管理fixtureを作る**
  - 完了条件: 種類プルダウン、Tag作成／編集のactive Category候補0／1／8／9件以上と必須選択、同じmodalのCategory作成side view、Tag draft保持／復帰後の自動選択、Tag親変更の参照Bookmark 0件／1件／多数・同じ旧親を残す別Tagあり／なし・Tag／親revision競合・同request再送／別payload再利用拒否・mutation receipt・全件rollback・AI再分類なし、閉じるまでの連続作成、create-only、tombstone同名競合時の別名案内、active Tag／active親、tombstone Tag／deleted親、global Tag名unique、管理モード、hover／focus鉛筆、Category編集の使用Tag実名／件数とBookmark unique件数、Bookmark／Tagの確認なしsoft-delete、Category警告の取消／確認／revision競合、cascade soft-delete、Bookmark保持とPENDING／NEEDS_REVIEW再分類、削除Undo経路なし、削除後の同名作成拒否、親Category GC拒否を再現できる。
- [ ] **TODO-021: 初回ホームとBookmark編集fixtureを作る**
  - 完了条件: `runtime.onInstalled` のINSTALL／UPDATEと再訪のホーム分岐、名前／URL／Tagだけの編集、Tag最大8候補、Category直接入力なし、Category自動導出、Tag新規作成ボタン、同じmodal内side view、入力draft保持を確認できる。
- [ ] **TODO-022: archive／共有fixtureを作る**
  - 完了条件: 最小archive document、複数選択復元、カテゴリ別／タグ別／個別QR選択、checksum真正性非保証、異親同名Tagの別名／skip／cancel再preview、Driveアカウント選択、同一accountのappDataFolder、別accountの通常Drive file、同一field／update-delete／add-delete／名前競合、immutable syncSnapshots、明示resolution plan、open中GC拒否、解決後30日保持、暗黙Label／edge remap拒否を個人情報なしで再現できる。
- [ ] **TODO-023: Label Normalizer v1 fixtureを作る**
  - 完了条件: Unicode 15.1.0のNFKC／`White_Space`／`Default_Ignorable_Code_Point`／`CaseFolding.txt` C＋F assetをprojectへ生成し、asset hash、runtime ICU非依存、normalizerVersion、tombstone予約、物理回収後の再利用をgolden／拒否fixtureで固定する。
- [ ] **TODO-024: 右クリック保存toggle fixtureを作る**
  - 完了条件: `contextMenuBookmarkEnabled` のfield欠損→ON、破損値→OFF、ON／OFF反復、page／link固定ID各1件、登録／解除失敗rollback、Service Worker再起動、OFF直前の遅延click、危険schemeを再現し、OFF中にBookmarkが増えないことを確認できる。
- [ ] **TODO-025: Category template候補比較fixtureを作る**
  - 完了条件: 個数・名前・set構成・選択方式・初期選択・skip・名前編集・再表示・locale・versionの異なる案を個人情報なしのmock catalogで比較し、明示適用前にCategoryが増えない境界を保った判断材料をISSUE-022へ記録する。

## 完了済み

完了項目は削除せず、短期間ここへ残してから [WORKLOG.md](WORKLOG.md) の記録へ集約する。TODO-003 と TODO-004 は 2026-08-16 に TASK-001 の一部として完了した。
