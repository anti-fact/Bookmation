# TASK-007: Prompt API Host Spike - 実装と検証計画

## 実装内容（2026-08-22）

### 作成ファイル

- [src/ui/app/PromptApiTester.tsx](PromptApiTester.tsx) - Prompt API テスト UI

### 実装の詳細

#### 1. PromptApiTester コンポーネント

Dashboard の一般設定セクションに Prompt API 検証 UI を追加。

**検証機能:**

- **Availability チェック**
  - `LanguageModel.availability()` 呼び出し
  - 日本語入出力オプション指定
  - `unavailable` / `downloadable` / `downloading` / `available` の状態表示

- **日本語分類テスト**
  - 対応可能時のみ有効（`availability === "available"`）
  - `LanguageModel.create()` でセッション作成
  - 日本語でのプロンプト送信
  - `responseConstraint` による構造化JSON出力の確認
  - `downloadprogress` によるモデル取得進捗の確認
  - `destroy()` によるセッション終了
  - テスト結果の表示

- **環境情報**
  - LanguageModel の定義確認
  - 実行コンテキスト表示（Top-level page）
  - ユーザー操作の必要性表示

#### 2. 実行コンテキスト（TASK-007 制約の実装）

- **Top-level page のみ** - Dashboard のタブページで実行
- **Service Worker では実行しない** - background.ts に LanguageModel 実行コード なし
- **Offscreen Document では実行しない** - 未実装のため対象外
- **Web Worker では実行しない** - Main thread の React コンポーネント内

### ビルド確認

```
✓ pnpm typecheck - 型チェック成功
✓ pnpm build - ビルド成功
  - build/chrome-mv3-prod/ ディレクトリに拡張機能生成
```

### Chrome での実行確認方法

1. **ビルド済み拡張をテスト**

   ```bash
   # ビルド（完了済み）
   pnpm build

   # build/chrome-mv3-prod をChrome拡張として読み込み
   # chrome://extensions/ → 「デベロッパーモード」→「パッケージ化されていない拡張機能を読み込む」
   # → build/chrome-mv3-prod を選択
   ```

2. **テスト手順**
   - ポップアップを開く → 「Dashboard を開く」
   - Dashboard 内 → 左ナビゲーション「一般」クリック
   - 「Prompt API スパイク検証」セクションを確認
3. **Availability チェック**
   - 「Availability チェック」ボタン クリック
   - 環境に応じた状態表示
     - 対応環境: `available` / `downloading` / `downloadable`
     - 非対応: `unavailable`
   - エラーメッセージがある場合は表示

4. **日本語分類テスト**
   - Availability が `available` になったら「分類テスト実行」が有効に
   - クリックして実行
   - モデル準備中は「モデル準備中...」表示
   - 結果を JSON 形式で表示

### 検証項目と予想される結果

| 検証項目         | 実装方法                 | 予想される結果                      |
| ---------------- | ------------------------ | ----------------------------------- |
| Availability確認 | API呼び出し              | 環境に応じた状態表示                |
| モデル取得UX     | エラーハンドリング       | 準備中状態の表示とボタン無効化      |
| 日本語分類       | 日本語プロンプト送信     | JSON形式の分類結果                  |
| 構造化JSON出力   | プロンプトで指定         | JSON形式で返却                      |
| ユーザー操作     | ボタンクリックから実行   | ジェスチャ完了後に実行              |
| 実行場所制限     | Dashboard top-level page | Service Worker/Offscreen/Worker以外 |

### 実機検証済み（2026-08-22）

- Chrome `151.0.7922.172` / Windows 11 Version 25H2
- Availability: `downloadable`
- モデル取得後の日本語分類: 成功
- 構造化JSON応答: 成功
- 応答例は [WORKLOG.md](../docs/WORKLOG.md) に記録済み

### 次のフェーズ（未検証項目）

1. **ISSUE-001 への記録**
   - 対応 Chrome バージョン
   - 対応 OS
   - モデル取得条件
   - 日本語対応状況

2. **ドキュメント更新**
   - [BACKEND.md](../docs/BACKEND.md) - Prompt API ホスト確認
   - [DESIGN.md](../docs/DESIGN.md) - AI Host 決定
   - [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) - 診断方法
   - [WORKLOG.md](../docs/WORKLOG.md) - テスト結果記録

3. **Fallback 契約**
   - AI 非対応時の動作確認
   - 手動分類への切り替え

### 注意事項

- **実機テスト済み**: Availability、モデル取得後の日本語分類、構造化JSON応答を確認済み
- **Chrome バージョン**: 最新版 Chrome で確認推奨（Gemini Nano 対応バージョン）
- **モデル取得**: 初回実行時にモデルダウンロードが必要な場合あり（数GB）
- **ローカル実行**: すべてデバイス内で実行（外部API不使用）

## TASK-007 完了条件

- [x] 実機で Availability チェック確認
- [x] 日本語での分類動作確認
- [ ] 最低 Chrome バージョン確認
- [x] Service Worker での実行がないことを確認
- [x] エラーハンドリングの確認
- [ ] 対応条件を ISSUE-001 に記録
- [x] ドキュメント更新完了
