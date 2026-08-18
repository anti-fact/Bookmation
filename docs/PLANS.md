# Execution Plan 規約

## 目的

Execution Plan（以下、Plan）は、長時間または複雑な変更を、途中参加者でも再開・検証できるようにする自己完結型の実行文書である。会話履歴、個人の記憶、未記録の口頭合意を前提にしない。

Plan は実装の進行に合わせて更新する living document である。最初に一度だけ書く仕様書ではない。小規模な作業は [TODO.md](TODO.md) で管理し、プロダクト全体の要件は [REQUIREMENTS.md](REQUIREMENTS.md)、設計判断は [DESIGN.md](DESIGN.md) に記録する。

## Plan が必要な作業

次のいずれかに該当する場合は、実装前に Plan を作る。

- 複数の機能領域、パッケージ、データ層をまたぐ。
- 半日を超える見込み、または複数人・複数日に分かれる。
- DBスキーマ変更、データ移行、権限変更、外部連携を含む。
- Prompt API、Manifest V3のservice worker、同期など、不確実性の高い技術を含む。
- カテゴリ親／タグ子へのデータ移行、Category cascade削除と影響Bookmark再分類、アーカイブ時の項目縮退、初回表示状態など既存データの意味を変える。
- Chrome履歴・通知、Google Driveアカウント選択、QR読取のように権限または利用者確認を伴う。
- 失敗時にブックマーク消失、互換性破壊、復旧困難が起こり得る。
- 調査結果によって実装方針や範囲が変わり得る。

一つのファイル内で完結し、短時間で安全に検証できる変更は [TODO.md](TODO.md) に置く。着手後に上記条件へ該当すると判明したら、TODOを分割し続けずPlanへ昇格させる。

## 保存場所と名前

Plan は `docs/plans/YYYY-MM-DD-短い名称.md` に置く。`AGENTS.md` にはPlan本文を書かず、必要なら [docs/INDEX.md](INDEX.md) から案内する。完了後も判断の履歴として残し、状態を `完了` に変更する。

## 必須原則

1. **自己完結**: 新しい担当者がリポジトリとPlanだけで目的、現状、手順、検証方法を理解できるようにする。
2. **利用者に見える成果**: 「ファイルを追加する」ではなく、「拡張機能のボタンからブックマークを保存できる」のように観察可能な結果を書く。
3. **現状と目標を分離**: 未実装、仮定、確認済みを明示し、予定を現在の事実として書かない。
4. **進捗を更新**: 作業の開始・完了・中断ごとに進捗、発見、判断を更新する。
5. **検証可能**: 実行コマンド、期待結果、手動確認、失敗判定を記載する。
6. **安全に再実行可能**: 破壊的操作を避け、必要な場合はバックアップ、dry-run、復旧手順を先に書く。
7. **リポジトリ基準**: パスとコマンドは、特記がない限りリポジトリ直下を基準にする。
8. **境界を明示**: 非目標と後続作業を書き、Planの完了条件を際限なく広げない。

## 状態

| 状態 | 意味 |
| --- | --- |
| `下書き` | 範囲・受け入れ条件を確認中で、実装未着手 |
| `進行中` | 担当者が作業中 |
| `停止中` | 外部判断や前提条件を待っている。理由と再開条件が必須 |
| `完了` | 受け入れ条件と検証を満たし、結果を記録済み |
| `置換済み` | 別Planへ統合・置換した。置換先リンクが必須 |

## 必須構成

各Planは、次のテンプレートをコピーして作る。不要に見える節も削除せず、該当しない理由を書く。

````markdown
# <利用者に届く成果を表す題名>

- 状態: 下書き | 進行中 | 停止中 | 完了 | 置換済み
- 作成日: YYYY-MM-DD
- 最終更新: YYYY-MM-DD HH:MM JST
- 担当: <名前またはチーム>
- 関連: [要件](../REQUIREMENTS.md) / [設計](../DESIGN.md) / <Issue等>

## 目的と利用者への価値

何ができるようになるか、それを利用者がどの画面・操作で確認できるかを書く。

## 現在地

現時点で存在する実装、存在しない実装、確認済みの制約を書く。重要なファイルや型の役割も、初見の人が辿れる粒度で説明する。

## 対象範囲

- 対象: ...
- 対象外: ...

## 前提・用語

このPlan内で必要な用語、前提環境、外部APIの状態を書く。変化しやすい情報には確認日と一次資料を付ける。

## 実装方針

データの流れ、責務境界、重要なインターフェースを文章で説明する。判断済み事項と仮説を区別する。

設定を扱うPlanでは、訪問期間 `LAST_7_DAYS`／`LAST_30_DAYS`／`LAST_365_DAYS`、既定nullの日数、期間変更時の日数clear、1〜7／1〜30／1〜365の境界、同日重複排除、`いいえ` のcanonical URL別 `countingResetAt`、旧回数設定を日数へ暗黙移行しないmigration、`frequentVisitReminderEnabled`、URL単位SUPPRESSED、既定falseでhistory権限gate付きの `autoArchiveEnabled`、既定30日のarchive設定、権限取消時OFF、履歴なし項目エラー、AI細分化 `0`〜`4` と上限 `0 / 1 / 2 / 4 / 6` のdiscriminated snapshotを列挙する。カテゴリ／タグを扱うPlanでは、project-vendored Unicode 15.1.0に固定したLabel Normalizer v1、tombstone中の名前予約、active Tag／active親、子Tag tombstoneが残る親の物理回収拒否、Tag作成／編集時のactive Category最大8候補とCategory作成side view／draft復帰、BookmarkのCategory自動導出、Category編集の使用Tag実名／件数とBookmark unique件数を記載する。Tag親変更はTag／選択親expected revisionとsubmit開始時に1回発行する `tag-update:` requestIdを検証し、全参照BookmarkのCategory closure・revision・検索派生データ、同期Outbox、mutation receiptを原子的に更新する。同request再送を同じ `UpdateTagResult` へ収束させ、別payload再利用を拒否し、AI再分類を行わない。Category連鎖削除は別の `category-delete:` namespaceを使う。Bookmark／Tagは確認なしsoft-delete、Categoryだけは警告確認後にCategory／全子Tag／edgeをcascade soft-deleteし、Bookmarkを保持してPENDING再分類、失敗時NEEDS_REVIEW／手動分類へ送る。削除Undoの操作／token／期限／復元経路は作らない。検索を扱うPlanでは、フルページkeyword検索と、入力・応答をポップアップ内で完結するAIアシスタントを別状態として扱う。

右クリック保存を扱うPlanでは、端末固有の `contextMenuBookmarkEnabled`、field欠損時ON／破損値OFFのmigration、固定page／link ID、install／startup／storage変更時のreconcile、ON／OFF反復、失敗rollback、OFF直前の遅延click拒否を列挙する。Drive同期対象には含めない。

初回Category templateを扱うPlanでは、最初にISSUE-022を解決し、version付きlocal catalog、利用者の明示適用、通常のUSER Category作成との合流、Normalizer／一意名／tombstone競合、request冪等性、onboarding途中再開、update／reload時の非再適用、catalog更新時の既存Category非変更を列挙する。具体的catalogが未決のままproduction seedを作らない。

QR／CSVを扱うPlanは同じ固定Bookmark集合を使い、QRの実encoder容量超過時は分割・切捨てをせずCSV actionへ誘導する。CSVは固定header、escaping、数式注入neutralization、秘密情報除外を検証する。QR checksumは破損／切詰め検出に限定し、真正性を保証しないことを明記する。異なる親の同名Tag競合は別名／skip／cancel後の再previewとする。Driveを扱うPlanは同一field更新、update-delete、add-delete、名前競合を自動LWWせず `syncConflicts` へ送り、immutableな `syncSnapshots` と明示的なresolution planを使う。OPEN中のsnapshotは回収せず、解決後も30日保持し、Label IDやedgeを暗黙に付け替えない。

## マイルストーン

### M1: <独立して確認できる成果>

- 成果: ...
- 変更箇所: ...
- 実行: `...`
- 期待結果: ...
- 手動確認: ...

### M2: ...

## 進捗

- [ ] YYYY-MM-DD HH:MM JST — <未着手の具体作業>
- [x] YYYY-MM-DD HH:MM JST — <完了した作業と証拠>

## 発見事項

- YYYY-MM-DD — 発見: ...
  - 証拠: コマンド出力、テスト名、ファイル位置など
  - 影響: ...

## 判断ログ

- YYYY-MM-DD — 判断: ...
  - 理由: ...
  - 検討した代替案: ...
  - 再検討条件: ...

## 検証と受け入れ条件

- [ ] 自動検証: `<command>` が成功する。
- [ ] Webプレビュー: production componentとfixtureで対象画面・状態を通常Webページから確認する。
- [ ] AIエージェントE2E: ビルド済み拡張機能をPlaywrightで確認し、report、screenshot、trace、skipを記録する。
- [ ] 手動検証: <操作> の結果、<観察可能な結果> になる。
- [ ] 人間受入: AIエージェント確認後、同じcommit／buildを人間が承認または差戻しする。
- [ ] 状態fixture: 初回／再訪、Category templateの未適用／適用／同名競合／再送／途中再開、0件／8件／9件以上候補、Tag作成／編集のCategory候補／side view／draft、Tag親変更の参照Bookmark 0件／1件／多数、expected revision競合、同request再送／別payload再利用拒否、全件rollback、AI再分類なし、BookmarkのCategory自動導出、Category使用状況、Normalizer v1、設定境界値、右クリックtoggleの欠損移行／ON／OFF／登録失敗／worker再起動／遅延click、AI snapshot、権限拒否、Bookmark／Tagの確認なし削除、Category警告付きcascade削除、PENDING／NEEDS_REVIEW再分類、tombstone中の同名作成拒否、削除Undo経路なし、archiveの既定30／toggle権限gate／履歴なしエラー／復元、QR容量超過CSV fallback／Drive競合を必要に応じて含める。
- [ ] エラー経路: <条件> でも保存済みデータを失わず、<案内> を表示する。
- [ ] 文書: 関連文書と実装が一致する。

UIまたは利用者導線を変更するPlanは [TESTING.md](TESTING.md) の順序を省略しない。段階が対象外または実行不能なら、理由と未実証範囲を明記し、完了扱いにしない。

## 再実行・復旧

各手順が再実行可能か、途中失敗時にどこから再開するか、データを戻す方法を書く。復元不能な操作がある場合は実行前の確認点を書く。

## 結果と残課題

完了時に、達成した成果、検証結果、対象外として残した事項、作成した技術的負債を記録する。
````

## マイルストーンの書き方

マイルストーンは「実装層」ではなく、単独で動作確認できる縦の成果にする。例えば「UIを全部作る」「DBを全部作る」ではなく、次のように切る。

1. 手動入力したURLを専用ストアへ保存し、再読込後も一覧に残る。
2. 保存時にPrompt APIの可用性を判定し、利用不可でも手動タグ付けへ進める。
3. ユーザーだけが定義する一意名の親カテゴリと、既存ユーザー定義を優先してAIが必要時だけ作る一意名の子タグを、版付きJSON documentとして保存する。カテゴリ名とタグ名は別namespace、タグ名は親をまたいでglobal uniqueである。Tag作成／編集の親Category候補を最大8件から選べ、親変更時は全参照BookmarkのCategoryが原子的に再導出され、AI再分類が動かないことを確認する。
4. AI細分化 `0`〜`4` が新規タグ上限 `0 / 1 / 2 / 4 / 6` に対応し、`0` でも既存タグの自動付与は続くこと、AI入力ポップアップ内で検索結果とBookmationの機能説明を確認できることを実証する。

各マイルストーンには、成功時だけでなく失敗時の期待動作も含める。

## 更新のタイミング

- 着手時: 状態を `進行中` にし、最初の進捗項目へ時刻を付ける。
- 作業中: 想定外の事実は「発見事項」、方針変更は「判断ログ」へ即時記録する。
- 中断時: `停止中` にし、停止理由、既に試したこと、再開条件を書く。
- 完了時: 実際に実行した検証と結果を記録し、「結果と残課題」を埋める。
- 範囲変更時: 対象・対象外、受け入れ条件、マイルストーンを同時に更新する。

Planから生じた小さな後続作業は [TODO.md](TODO.md)、未解決の不具合や判断待ちは [ISSUES.md](ISSUES.md)、意図的な暫定実装は [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md) に移す。
