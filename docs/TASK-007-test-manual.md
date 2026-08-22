# TASK-007: Prompt API Host Spike - テスト手順書

## 概要

TASK-007 では、Chrome Prompt API（Gemini Nano）の対応条件をスパイク実装で検証します。

## 実装完了事項

### 1. スパイク UI の実装

**ファイル:** `src/ui/app/PromptApiTester.tsx`

PromptApiTester コンポーネントは以下を検証：

- `LanguageModel.availability()` の状態確認
- 日本語でのモデル作成（`LanguageModel.create()`）
- 日本語プロンプト送信と結果取得
- エラーハンドリング
- 環境情報の表示

### 2. Dashboard への統合

**ファイル:** `src/ui/app/ExtensionApp.tsx`

ExtensionApp の settings セクション（一般設定）に PromptApiTester を統合。

### 3. ビルド確認

```bash
$ pnpm typecheck   # ✓ 成功
$ pnpm build       # ✓ 成功
  → build/chrome-mv3-prod/ に拡張機能が生成
```

## Chrome での実行方法

### ステップ1: 拡張機能の読み込み

1. Chrome を開く
2. `chrome://extensions` にアクセス
3. 右上の「デベロッパーモード」をONに切り替え
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `build/chrome-mv3-prod` ディレクトリを選択
6. 拡張機能が読み込まれたことを確認

### ステップ2: テスト UI の起動

1. 拡張機能のポップアップを開く（Chrome 右上のアイコン）
2. ポップアップ内の「Dashboard を開く」ボタンをクリック
3. Dashboard ページが新規タブで開く

### ステップ3: Prompt API テスト

**画面遷移:**

- Dashboard 内のヘッダーで Settings アイコン（⚙️）をクリック
- 左メニューで「一般」を選択
- 下部に「Prompt API スパイク検証」セクションが表示

**テスト実行:**

#### 1. Availability チェック

```
【UI表示】
- セクション: "1. Availability確認"
- ボタン: "Availability チェック"
- 環境情報

【テスト操作】
- "Availability チェック" ボタンをクリック

【予想される結果】
✓ Chrome 122+ かつ Gemini Nano対応環境:
  - "available" が緑で表示
  - モデルが既にダウンロード済みの場合

✓ Chrome 122+ だが Gemini Nano未ダウンロード:
  - "downloadable" が青で表示
  - モデル取得可能だが未インストール

✓ モデル取得中:
  - "downloading" が黄色で表示
  - ユーザー操作でダウンロード中

✗ 非対応環境:
  - "unavailable" が赤で表示
  - エラーメッセージが表示
```

#### 2. 日本語分類テスト

```
【前提条件】
- Availability が "available" の状態

【UI表示】
- セクション: "2. 日本語分類テスト"
- ボタン: "分類テスト実行"（availability="available" の場合のみ有効）

【テスト操作】
- "分類テスト実行" ボタンをクリック

【中間状態】
- ボタンが "モデル準備中..." に変わる

【予想される結果】
✓ テスト成功:
  - JSON形式の分類結果が表示
  例:
```

{
"category": "開発・技術",
"tags": ["Web開発", "JavaScript"],
"confidence": 0.95
}

```

✗ テスト失敗:
- エラーメッセージが赤背景で表示
例: "Classification test failed: ..."
```

## 検証チェックリスト

実機テスト実施時に以下を記録してください：

### 環境情報

- [ ] Chrome バージョン: ****\_\_\_****
- [ ] OS: ****\_\_\_****
- [ ] デバイス: ****\_\_\_****（デスクトップ/ノートパソコン/その他）
- [ ] GPU: ****\_\_\_****（あれば）

### Availability チェック

- [ ] ボタンクリック成功
- [ ] 状態表示: ****\_\_**** （available/downloadable/downloading/unavailable）
- [ ] 最終テスト時刻が表示される
- [ ] エラーメッセージ（あれば）: ****\_\_\_****

### 日本語分類テスト

- [ ] Availability = "available" を確認
- [ ] ボタンクリック可能
- [ ] モデル準備中の状態表示
- [ ] 結果表示形式（JSON）
- [ ] 日本語でのプロンプト送信成功
- [ ] 日本語での応答確認
- [ ] エラーメッセージ（あれば）: ****\_\_\_****

### 環境確認

- [ ] LanguageModel 定義: ✓ 利用可能 / ✗ 利用不可
- [ ] 実行コンテキスト: Top-level page
- [ ] Service Worker での実行: なし（✓ 確認）
- [ ] Offscreen Document での実行: なし（✓ 確認）

## トラブルシューティング

### LanguageModel is not available

**原因:**

- Chrome バージョンが対応していない（122以上必須）
- デバイスが Gemini Nano に対応していない

**対応:**

- Chrome を最新バージョンにアップデート
- 対応デバイスの確認: [公式ドキュメント](https://developer.chrome.com/docs/ai)

### Classification test failed

**原因:**

- モデルの準備が不完全
- プロンプト実行中にエラー

**対応:**

- 再度 Availability チェックを実施
- モデルが downloading 状態であれば完了を待機
- Chrome コンソールでエラーメッセージを確認

### 結果が JSON でない

**原因:**

- Prompt API の仕様変更
- モデルの応答形式不正

**対応:**

- Chrome コンソールの警告/エラーを確認
- プロンプトフォーマットの確認

## ログ/コンソール確認

ブラウザコンソール（F12 > Console）で詳細情報を確認：

```javascript
// モデル関連のログ
console.log("LanguageModel available:", window.LanguageModel)

// Availability 詳細確認
await window.LanguageModel?.availability({
  expectedInputs: ["text"],
  expectedOutputs: ["text"],
  language: "ja"
}).then(console.log)
```

## 成功判定基準

TASK-007 スパイク検証の成功条件：

1. **対応環境の確認**
   - Availability チェックで "available" または "downloadable" 表示
   - 対応 Chrome バージョン確定

2. **日本語対応の確認**
   - 日本語プロンプト送信で エラーなし
   - 日本語での応答確認

3. **構造化出力の確認**
   - JSON 形式での結果返却
   - スキーマ通りのレスポンス

4. **実行場所制限の確認**
   - ✓ Dashboard top-level page で実行
   - ✓ Service Worker では実行なし
   - ✓ Console エラーなし

5. **ドキュメント化**
   - [ISSUE-001](./ISSUES.md) に対応条件を記録
   - [BACKEND.md](./BACKEND.md) に AI Host を確定

## 実機テスト後の作業

テスト完了後、以下を実施：

1. **結果をWORKLOG.mdに記録**

   ```markdown
   | 実機確認: TASK-007 | 2026-08-22 | Chrome X.X, OS: \_\_, 日本語対応✓, 最低Chrome XX | [テスト結果] |
   ```

2. **ISSUE-001を更新**
   - 対応 Chrome バージョン
   - 対応 OS
   - モデル取得要件
   - Fallback 条件

3. **ドキュメント更新**
   - BACKEND.md - AI Host 確定
   - DESIGN.md - Prompt API 対応条件
   - TROUBLESHOOTING.md - 診断手順

4. **PromptApiTester の削除（本番化時）**
   - スパイク実装のため、本番コードからは除外予定
