# TASK-020: オンボーディングのカテゴリ／タグ選択を端末へ保存 — 要件

- 日付: 2026-08-23
- 関連: [GitHub #81](https://github.com/anti-fact/Bookmation/issues/81) / HAK-53 / FR-031 / TASK-014 / BE-19 / ISSUE-D33 / ISSUE-022 / [UI.md](../UI.md) §インストール直後の初回ホーム / [FRONTEND.md](../FRONTEND.md) §`CategoryTemplateStep`

## 目的

初回オンボーディングの **カテゴリ（および紐づくタグ）選択画面** で、利用者が選んだ内容を **端末（`chrome.storage.local`）へ即時保存** し、タブを閉じたり Service Worker が再起動しても **同じ選択状態から再開** できるようにする。

Issue 記載の `/#onboding/category` は Figma プロトタイプ上の表記（`onboding` は `onboarding` の誤記）とみなす。本番 hash route は **`#/onboarding/category`** を正とする（既存の `#/welcome` から遷移する step）。

## 現在地（2026-08-23 時点）

| 領域 | 状態 |
|------|------|
| `src/extension/onboarding.ts` | `status` / `currentStepId` / `updatedAt` のみ。選択内容は未保存 |
| `CategoryTemplateStep` UI | 未実装（`WelcomeScreen` は `#/home` へ直行） |
| BE-19 `applyCategoryTemplates` | 明示適用と receipt 冪等は実装済み。catalog は `pending-issue-022` で空 |
| `chrome.storage.local` receipt | 適用 **完了後** の結果のみ（`bookmation_category_template_apply_receipts`） |
| hash route | `#/onboarding/*` 未登録 |
| ISSUE-022 | Open（候補名・件数・選択 UI・タグ同梱有無は未決） |

**ギャップ**: 利用者がチェックを入れただけでは Label は作らない（正しい）が、**選択 draft も端末に残らない**ため、途中終了後に選択が消える。

## 用語

| 用語 | 意味 |
|------|------|
| **catalog 項目** | 同梱 `CategoryTemplateCatalog` の template 行（現 schema は Category のみ。ISSUE-022 で Tag 同梱を追加し得る） |
| **選択 draft** | 利用者が UI でオンにした catalog 項目 ID の集合。**IndexedDB の Label はまだ増えない** |
| **適用（apply）** | 利用者が「作成」「次へ」等の **明示操作** をしたときだけ `ApplyCategoryTemplates` を呼び、USER Category（と将来 Tag）を作る |
| **onboarding 完了** | `onboardingState.status = COMPLETED`。以降は通常ホームへ。draft は破棄または参照専用に留める |

## スコープ（TASK-020）

### 1. 永続化する内容

`onboardingState` を拡張し、少なくとも次を `chrome.storage.local` に保存する。

```ts
interface OnboardingCategoryDraft {
  catalogVersion: string          // 表示中 catalog の version。不一致時は draft を無効化
  selectedCategoryTemplateIds: string[]  // 利用者がオンにした Category template ID（順序保持）
  selectedTagTemplateIds?: string[]      // ISSUE-022 で Tag template を catalog に含める場合のみ使用
  nameOverrides?: Record<string, string> // templateId → 編集後表示名（ISSUE-022 で名前編集を採用する場合）
  updatedAt: number
}
```

`onboardingState` 本体:

```ts
interface OnboardingState {
  schemaVersion: 2               // v1 から migration
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
  currentStepId: string | null   // 例: "welcome" | "category" | "tag" | ...
  categoryDraft: OnboardingCategoryDraft | null
  initializedBy: "INSTALL"
  updatedAt: number
}
```

**保存タイミング**

- Category（および Tag）checkbox／toggle の **変更直後**（debounce 最大 300ms）
- step 遷移時（`currentStepId` 更新と同一 transaction）
- 明示 apply **開始前**（apply 中は draft を消さない。成功後に別途処理）

**保存しないもの**

- catalog 本体（bundle 参照のみ）
- 適用済み receipt（既存 `bookmation_category_template_apply_receipts` を継続使用）
- Bookmark / Label 正本（IndexedDB）

### 2. UI / ルーティング

| route | 画面 | 備考 |
|-------|------|------|
| `#/welcome` | 既存 Welcome | `ここからはじめる` → `#/onboarding/category`（`#/home` 直行はやめる） |
| `#/onboarding/category` | `CategoryTemplateStep` | Issue の `/#onboding/category` に相当 |
| `#/onboarding/tag` | （ISSUE-022 で Tag step を分離する場合） | v1 は category step 内に Tag 選択を含めてもよい |

**`CategoryTemplateStep` の最小挙動（TASK-020）**

1. mount 時に `get-category-template-catalog` と onboarding snapshot を取得
2. `categoryDraft` があれば checkbox 状態を復元
3. 選択変更ごとに `update-onboarding-draft` message で draft 保存
4. **catalog 表示だけでは Label を作らない**（既存不変条件）
5. 「スキップ」または「次へ」で step 進行。スキップ時は `selected*Ids` を空配列で保存
6. 「作成して次へ」（文言は ISSUE-022 まで仮）で `apply-category-templates` を呼ぶ。成功後 `currentStepId` を更新

**再開導線**

- オンボーディング未完了（`status !== COMPLETED`）で `#/home` 等を開いたとき、バナーまたはモーダルで「初期設定を続ける」→ 保存済み `currentStepId` へ遷移
- `currentStepId === "category"` なら `#/onboarding/category` へ

### 3. バックエンド / messages

| action | 方向 | 概要 |
|--------|------|------|
| `get-onboarding-snapshot` | dashboard → SW | `onboardingState` 全体（draft 含む）を返す |
| `update-onboarding-draft` | dashboard → SW | `categoryDraft` と `currentStepId` を検証して保存 |
| `complete-onboarding-step` | dashboard → SW | step 完了。category step では apply 成功を前提に `currentStepId` 更新 |
| `get-category-template-catalog` | 既存 | 変更なし |
| `apply-category-templates` | 既存 | 変更なし（draft の `selectedCategoryTemplateIds` を payload に載せる） |

**検証ルール**

- `catalogVersion` が bundle と不一致 → `CATEGORY_TEMPLATE_CATALOG_VERSION_MISMATCH`。draft はクリアし再選択を促す
- 未知 `templateId` → 保存拒否（`CATEGORY_TEMPLATE_UNKNOWN_ID`）
- 重複 ID → 正規化時に除去
- `onboardingState` の更新は **install 初期化以外** でも行うが、`status=COMPLETED` 後に draft を書き戻さない
- update / startup / SW 再起動で `status` や draft を **巻き戻さない**（[SECURITY.md](../SECURITY.md) 既存規則）

### 4. catalog version 変更時

| 状況 | 動作 |
|------|------|
| 保存 draft の `catalogVersion` === 現在 bundle | 選択をそのまま復元 |
| 不一致（拡張 update 後） | draft を **破棄**（`categoryDraft = null`）。利用者へ「候補が更新されたため選び直してください」を表示。既に apply 済み Category は IndexedDB に残る |
| 同一 version で catalog 項目 ID が削除 | 未知 ID は復元時に無視し、残りだけ表示 |

### 5. Tag の扱い（ISSUE-022 連動）

Issue 本文は「カテゴリとタグ」両方を保存対象とする。

| パターン | TASK-020 の対応 |
|----------|-----------------|
| **A**: catalog が Category のみ | `selectedCategoryTemplateIds` のみ保存。Tag は apply 時に作らない |
| **B**: 各 Category template に子 Tag template 配列 | `selectedTagTemplateIds` を親子関係付きで保存（schema は ISSUE-022 確定後に固定） |
| **C**: Category step と Tag step を分離 | `currentStepId` で step 管理。Tag step 用に `tagDraft` を追加（TASK-020 では `categoryDraft` と同型の拡張で予約） |

**v1 実装方針（本要件の仮決定）**: パターン A で着手し、schema に `selectedTagTemplateIds` を **optional** で入れておく。ISSUE-022 で B/C が決まったら UI と validation だけ追加する。

## 非スコープ（TASK-020）

- ISSUE-022 の catalog 具体名・件数・選択 control の最終デザイン（空 catalog のまま fixture 可能）
- Tag template の apply use case（BE-19 は Category のみ）
- Drive 同期（onboarding は端末固有）
- オンボーディング完了後の template 再表示 UI
- `#/onboarding/*` 以外の全 step（AI 設定等）— 別 TASK

## ISSUE-022 へ委ねる項目（実装ブロックではない）

| 項目 | TASK-020 での扱い |
|------|-------------------|
| 候補名・件数 | hardcode しない。fixture 用に test catalog のみ |
| 初期選択（全オン／全オフ） | draft 未存在時の UI 初期値。決定まで **全オフ** |
| skip 可否 | 「スキップ」ボタンは置く。空 draft で保存 |
| 名前編集 | `nameOverrides` field を予約。UI は ISSUE-022 後 |
| 初回後の再表示場所 | 本 TASK では `COMPLETED` 後に draft 非表示 |

## 受け入れ条件

- [ ] `#/onboarding/category` で catalog を表示し、選択変更が **300ms 以内** に `chrome.storage.local` へ反映される
- [ ] タブを閉じて再度開き、`currentStepId` と checkbox 状態が復元される
- [ ] Service Worker 再起動後も draft が消えない
- [ ] 選択変更だけでは IndexedDB の Label 件数が **増えない**
- [ ] 明示 apply 後のみ Category が作成され、receipt 冪等が効く
- [ ] `catalogVersion` 不一致時に draft が安全にクリアされ、既存 Category は変更されない
- [ ] `runtime.onInstalled` の `update` では onboarding を初期化しない
- [ ] `pnpm test` / `typecheck` で onboarding draft の unit test が通る

## テスト観点

| 観点 | 方法 |
|------|------|
| draft 保存・復元 | `onboarding.ts` + message handler の Vitest（fake storage） |
| catalog version 不一致 | draft クリアと UI メッセージ |
| apply との分離 | 選択のみ → Label 0 件、apply 後 → 選択分だけ増加 |
| 再開 | Playwright: 選択 → タブ閉じ → 再開 → 状態一致 |
| Web preview | `?view=onboarding&fixture=category-draft`（TASK-013 と連携） |

## 依存関係

```
TASK-003 (IndexedDB) ─┐
TASK-014 (template UI) ├── TASK-020（本要件）
BE-19 (apply) ─────────┘
ISSUE-022（catalog 中身）— 並行。空 catalog でも draft 保存は検証可能
```

## 判断ログ

| 日付 | 決定 |
|------|------|
| 2026-08-23 | 正規 route は `#/onboarding/category`（Issue の `onboding` は誤記扱い） |
| 2026-08-23 | draft は `onboardingState.categoryDraft` に集約。Label 正本とは分離 |
| 2026-08-23 | Tag 同梱は ISSUE-022 待ち。schema は optional field で先行 |
| 2026-08-23 | catalog 不一致時は draft 破棄（既存 Label は非変更） |

## 実装マイルストーン案

| 段階 | 内容 |
|------|------|
| M1 | `OnboardingState` v2 + `get/update-onboarding-draft` + 単体テスト |
| M2 | hash route `#/onboarding/category` + `CategoryTemplateStep` 最小 UI |
| M3 | draft 復元・再開導線 + Welcome からの遷移変更 |
| M4 | Web fixture + Playwright 再開シナリオ |
