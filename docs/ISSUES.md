# 問題・未決定事項

- 状態: Open の項目は実装前または対象フェーズ開始前に決定する。
- 基準日: 2026-08-16

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
| ISSUE-004 | Open | P0 | AI タグ細分化5段階の上限は仮値である | 代表データセットで過剰生成率・修正率・候補再利用率を測り、段階名と新規タグ上限を確定する |
| ISSUE-005 | Open | P0 | TAGは同名を許可するため、候補の見分けと手動統合の UX が必要である | ID、作成元、関連件数の表示と、明示的なTAG統合・復元を決める。CATEGORYは同名作成を拒否する |
| ISSUE-006 | Open | P0 | Plasmo（React ベース）+ Tailwind CSS は確定し、TypeScript は設計標準としたが、実装用パッケージ構成と依存バージョンが未確定である | Plasmo / React / Tailwind / TypeScript の対応版、package manager、lockfile、品質コマンドをスパイクで固定する |
| ISSUE-007 | Open | P0 | ハッカソンの締切・審査基準・デモ環境が資料にない | チームで一次情報を確認し、P0 の日程・成功指標・デモ端末を Execution Plan に記録する |
| ISSUE-008 | Open | P1 | 訪問リマインダーは確定したが、閾値の既定値、集計期間、除外、再通知間隔が未定である | 権限説明、既定値、対象除外、cooldownを決める。保存は利用者確認後だけという要件は変更しない |
| ISSUE-009 | Open | P1 | 自動アーカイブは確定したが、既定日数と履歴がない項目の再確認UIが未定である | 既定日数、実行頻度、結果通知、復元導線を決める。`lastVisitedAt=null` は自動変更しない |
| ISSUE-010 | Open | P1 | QR共有は確定したが、容量と分割方式が未定である | バージョン付きJSON payload、最大件数、分割、改ざん検知、受信確認を試験する |
| ISSUE-011 | Open | P1 | Google Drive同期は確定したが、競合UI、tombstone期間、追加暗号化が未定である | `drive.appdata`、JSON形式、差分方式、tombstone、競合UI、バックアップを決める |
| ISSUE-013 | Open | 運用 | タスク管理を Linear にする希望はあるが確定していない | チームのアカウントと運用責任を確認し、正本を一つに決める |
| ISSUE-014 | Open | P0 | 共通AI検索の候補上限・応答時間・AI非対応時の縮退が未確定である | 1入力、種類別の無順位集合、最大件数、理由、応答時間、lexical fallbackをprototypeで決める |
| ISSUE-015 | Open | P0 | URL 指定保存で取得できるメタデータと通信権限の境界が未確定である | URL 検証、タイトル入力の代替、ファビコン・サムネイル取得、host permission 不要の縮退動作を決める |
| ISSUE-016 | Open | P1 | Chrome標準BookmarkのFolderをカテゴリ／タグへどう対応するか未定である | tagなし取込、folder path保持、利用者確認付きカテゴリ化を比較し、元tree非変更と重複規則を固定する |
| ISSUE-017 | Open | P1 | QRへ収まらない共有をどう扱うか未定である | 分割QRまたは別の明示exportを決め、無言の切捨てを禁止する |

## 決定済み

| ID | 状態 | 決定 | 根拠 |
| --- | --- | --- | --- |
| ISSUE-D01 | Decided | 左フォルダツリーを採用しない | 現行UIは全画面カテゴリ一覧を正本とする |
| ISSUE-D02 | Decided | P0 はブラウザ標準ブックマークを変更しない | 拡張機能専用ブックマークという今回の要件 |
| ISSUE-D03 | Decided | AI 非対応時に外部APIへ自動送信せず、手動分類へフォールバックする | プライバシーと P0 スコープを守るため |
| ISSUE-D04 | Decided | 旧企画資料由来で保留していた訪問、archive、QR、DriveをP1確定機能へ昇格する | 2026-08-16の利用者による明示的な再承認 |
| ISSUE-D05 | Decided | 旧階層を廃止し、カテゴリ／タグを平坦な役割区分とする | 最新の利用者依頼は旧メインタグをカテゴリ、旧サブタグをタグへ改称した |
| ISSUE-D06 | Decided | カテゴリはユーザー作成のみ、タグはユーザー定義優先で必要時だけAI作成とする | 最新の利用者依頼 |
| ISSUE-D07 | Decided | カテゴリ／タグは複数割当可。カテゴリ名は一意、タグ名は重複可 | 2026-08-16の正式用語変更後も規則を維持する |
| ISSUE-D08 | Decided | UI 実装基盤は Plasmo（React ベース）+ Tailwind CSS とする | 最新の利用者依頼 |
| ISSUE-D09 | Decided | ポップアップの2ボタン、2ショートカット、URL指定保存、最近追加ホームをP0に含める | 利用者依頼 |
| ISSUE-D10 | Decided | デザインシートをUI正本とし、LIST / GRID、全画面カテゴリ一覧、sticky header、edit modal、infinite scroll、back-to-topを採用する | 2026-08-15 の依頼と添付SVG |
| ISSUE-D11 | Decided | 両一覧の検索ボックスはkeyword／AIともLabelとBookmarkを検索し、カテゴリ・タグを上、Bookmarkを下に表示する | 2026-08-16の利用者依頼 |
| ISSUE-D12 | Decided | 弁当、列数選択、右Tag sidebar、分離AI検索は廃止する | 2026-08-15 の依頼 |
| ISSUE-D13 | Decided | 頻繁に訪問する未保存サイトは閾値到達後にリマインダーを出し、保存確認後だけBookmationへ保存する | 2026-08-16の利用者依頼と無断保存を避ける安全境界 |
| ISSUE-D14 | Decided | 最終訪問日時と設定期間で休眠Bookmarkを判定し、文字列 `archiveState` で自動archive・復元する | 2026-08-16の利用者依頼 |
| ISSUE-D15 | Decided | ユーザー間共有はQR、同一ユーザー同期はGoogle Drive appDataFolderを使う | 2026-08-16の利用者依頼 |
| ISSUE-D16 | Decided | 標準Bookmarkは明示操作でBookmationへコピーし、元データを変更しない | 2026-08-16の利用者依頼 |
| ISSUE-D17 | Decided | page／linkのcontext menu保存を通常保存use caseへ合流させる | 2026-08-16の利用者依頼 |
| ISSUE-D18 | Decided | DB正本はIndexedDB上の版付きJSON互換documentとし、Blobは別Storeにする | 2026-08-16の利用者依頼 |
