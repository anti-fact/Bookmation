# 問題・未決定事項

- 状態: Open の項目は実装前または対象フェーズ開始前に決定する。
- 基準日: 2026-08-15

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
| ISSUE-004 | Open | P0 | AI サブタグ細分化5段階の上限は仮値である | 代表データセットで過剰生成率・修正率・候補再利用率を測り、段階名と新規サブタグ上限を確定する |
| ISSUE-005 | Open | P0 | SUBは同名を許可するため、候補の見分けと手動統合の UX が必要である | ID、作成元、関連件数の表示と、明示的なSUB統合・復元を決める。MAINは同名作成を拒否する |
| ISSUE-006 | Open | P0 | Plasmo（React ベース）+ Tailwind CSS は確定し、TypeScript は設計標準としたが、実装用パッケージ構成と依存バージョンが未確定である | Plasmo / React / Tailwind / TypeScript の対応版、package manager、lockfile、品質コマンドをスパイクで固定する |
| ISSUE-007 | Open | P0 | ハッカソンの締切・審査基準・デモ環境が資料にない | チームで一次情報を確認し、P0 の日程・成功指標・デモ端末を Execution Plan に記録する |
| ISSUE-008 | Open | P1 | 履歴アクセスは強い権限で、訪問回数閾値も未定である | 任意権限要求、説明文、対象除外、閾値、通知頻度を決める |
| ISSUE-009 | Open | P1 | アーカイブ判定期間と「訪問」の定義が未定である | 既定日数、手動変更、復元、履歴権限拒否時の挙動を決める |
| ISSUE-010 | Open | P1 | QR の容量と共有データ形式が未定である | バージョン付き payload、最大件数、分割、改ざん検知、受信確認を試験する |
| ISSUE-011 | Open | P1 | Google Drive 同期の形式・競合・暗号化が未定である | OAuth scope、appDataFolder 形式、差分方式、tombstone、競合UI、バックアップを決める |
| ISSUE-012 | Open | 運用 | 添付 PDF は Git 未追跡で、共有方法が定まっていない | 著作権・機密性を確認し、追跡するかチーム共有URLへ置き換える |
| ISSUE-013 | Open | 運用 | タスク管理を Linear にする希望はあるが確定していない | チームのアカウントと運用責任を確認し、正本を一つに決める |
| ISSUE-014 | Open | P0 | 共通AI検索の候補上限・応答時間・AI非対応時の縮退が未確定である | 1入力、種類別の無順位集合、最大件数、理由、応答時間、lexical fallbackをprototypeで決める |
| ISSUE-015 | Open | P0 | URL 指定保存で取得できるメタデータと通信権限の境界が未確定である | URL 検証、タイトル入力の代替、ファビコン・サムネイル取得、host permission 不要の縮退動作を決める |

## 決定済み

| ID | 状態 | 決定 | 根拠 |
| --- | --- | --- | --- |
| ISSUE-D01 | Decided | PDF の左フォルダツリーを採用しない | 利用者の後続要件がPDFより新しい |
| ISSUE-D02 | Decided | P0 はブラウザ標準ブックマークを変更しない | 拡張機能専用ブックマークという今回の要件 |
| ISSUE-D03 | Decided | AI 非対応時に外部APIへ自動送信せず、手動分類へフォールバックする | プライバシーと P0 スコープを守るため |
| ISSUE-D04 | Decided | PDF の追加機能は P1 とし、P0 コアの後に実装する | PDF 内でも「コア機能」と「追加機能」が分離されている |
| ISSUE-D05 | Decided | 大カテゴリ・小カテゴリとタグの親子階層を廃止し、MAIN / SUB を平坦な役割区分とする | 最新の利用者依頼は分類をメインタグとサブタグだけで定義した |
| ISSUE-D06 | Decided | メインタグはユーザー作成のみ、サブタグはユーザー定義優先で必要時だけ AI 作成とする | 最新の利用者依頼 |
| ISSUE-D07 | Decided | MAIN / SUB は複数割当可。MAIN名は一意、SUB名は重複可 | 2026-08-15 の利用者依頼が旧重複規則を置換した |
| ISSUE-D08 | Decided | UI 実装基盤は Plasmo（React ベース）+ Tailwind CSS とする | 最新の利用者依頼 |
| ISSUE-D09 | Decided | ポップアップの2ボタン、2ショートカット、URL指定保存、最近追加ホームをP0に含める | 利用者依頼 |
| ISSUE-D10 | Decided | デザインシートをUI正本とし、LIST / GRID、全画面Tag、sticky header、edit modal、infinite scroll、back-to-topを採用する | 2026-08-15 の依頼と添付SVG |
| ISSUE-D11 | Decided | AI検索は共通1フォームからBookmark / Tagの無順位候補集合を表示する | 2026-08-15 の依頼 |
| ISSUE-D12 | Decided | 弁当、列数選択、右Tag sidebar、分離AI検索は廃止する | 2026-08-15 の依頼 |
