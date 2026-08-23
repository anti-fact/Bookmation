# popup・commands・URL 指定保存 — 要件定義（TASK-004 / BE-03・BE-04）

- 状態: 進行中
- 作成日: 2026-08-22
- 最終更新: 2026-08-23 JST
- 担当: 未定
- 関連: [REQUIREMENTS.md](../REQUIREMENTS.md) / [BACKEND.md](../BACKEND.md) / [UI.md](../UI.md) / [SECURITY.md](../SECURITY.md) / [TASKS.md](../TASKS.md) / [BACKEND_TASKS.md](../../BACKEND_TASKS.md) / [Issue #9](https://github.com/anti-fact/Bookmation/issues/9) / [ISSUE-D35／D37](../ISSUES.md)

## 目的と利用者への価値

利用者が **明示操作だけ** で、閲覧中ページまたは URL 文字列を Bookmation 専用ストアへ保存できる。保存は **AI 分類の完了を待たず** IndexedDB に残り、Service Worker 再起動後も失われない。

| 利用者操作 | 確認できる結果 |
| --- | --- |
| popup「このページをブックマーク」 | 現在タブの URL が Bookmark として保存され、PENDING 分類 Job が付く |
| ショートカット `save-current-page` | 同上（キーボードから） |
| dashboard のブックマーク追加 | 入力URLがvalidなら、明示選択した0件以上のTagとともにBookmarkが保存され、CategoryはTag親から自動導出される |
| popup / ショートカット「Bookmation ホームを開く」 | `#/home` が開き、**保存は走らない** |
| 初回 install | `#/welcome` が 1 回だけ開き、update / reload では再表示されない |

本書は **実装前の要件定義** である。マイルストーン分割とコード変更は、本要件のレビュー後に別途 Execution Plan の実装節へ落とす。

## 現在地

### 存在する

| パス | 役割 |
| --- | --- |
| `src/adapters/indexeddb/local-data-layer.ts` | TASK-003 完了。`saveBookmarkWithJob`、PENDING Job 同一 transaction |
| `src/ports/repositories.ts` | `LocalDataLayerPort` 定義 |
| `src/domain/` | URL 正規化、Domain エラー、Bookmark / Job 型 |
| `src/popup.tsx` | bootstrap のみ。保存ボタン・ショートカット表示は未実装 |
| `src/background.ts` | `commands.onCommand` allowlist のみ |
| `src/extension/command-handlers.ts` | ホーム open 実装済み。`SAVE_CURRENT_PAGE` は no-op |
| `src/extension/paths.ts` | `#/welcome` / `#/home` 定数 |
| `src/ui/app/ExtensionApp.tsx` | App Shell。`#/home` はプレースホルダー表示 |
| `package.json` manifest | `storage`, `activeTab`, 2 commands。`host_permissions` 未追加 |

### 存在しない

| パス | 備考 |
| --- | --- |
| `src/application/` | 保存 use case なし（`export {}` のみ） |
| Service Worker message router | BE-03 未着手 |
| popup → SW の保存 message | 未実装 |
| dashboard URL 入力 UI | 未実装 |
| `runtime.onInstalled` handler | 未実装 |
| URL 重複検出（normalizedUrl） | Repository は `creationRequestId` 冪等のみ。urlHash 重複返却は未実装 |
| メタデータ非同期後追い Job | ISSUE-D35 で方針決定済み、実装は本 TASK の一部 |

### 確認済み制約

- **ISSUE-D35**: URL 検証、タイトル優先順位、host_permissions、先保存→非同期メタデータ、現在タブと URL 指定の経路分離。
- **TASK-003 完了**: Bookmark + PENDING Job の transaction 保存は Repository 契約テストで検証済み。
- UI / popup / dashboard は **Repository を直接 import しない**。Application 層経由で Port を注入する（[task-003 Plan](./2026-08-22-task-003-local-data-layer.md)）。
- Prompt API は Service Worker から呼ばない（TASK-007 spike 済み）。
- context menu 保存（FR-110）は **P1**。本 TASK では use case を共通化するが、menu 登録は実装しない。

## 対象範囲

### 対象（P0 / TASK-004）

1. **共通保存 use case**（`SaveCurrentTab` / `SaveBookmarkByUrl` → 内部 `SaveBookmark` に合流）
2. **BE-03 最小**: popup / dashboard ↔ Service Worker の typed message、allowlist、requestId 冪等
3. **popup UI**: FR-003〜005（2 ボタン、ショートカット表示、割り当て変更案内）
4. **commands 接続**: `save-current-page` / `open-bookmation-home` の分離 handler
5. **dashboard Bookmark追加**: FR-006／FR-032（URL、任意title、Tagのリアルタイム候補／順次追加／解除、検証、保存）
6. **`runtime.onInstalled`**: FR-012 / ISSUE-D21（INSTALL 時だけ `#/welcome` + onboardingState 初期化）
7. **Manifest**: ISSUE-D35 に従い `host_permissions: ["https://*/*", "http://*/*"]` を追加
8. **IndexedDB 接続**: Service Worker 起動時に `LocalDataLayer` を開き、保存 handler から利用
9. **単体・契約テスト**: 3 入口、危険 scheme、重複 URL、metadata 失敗でも保存、request 再送

### 対象外（後続 TASK）

| 項目 | 担当 |
| --- | --- |
| Bookmark 一覧・カード UI（最近追加の本番 LIST/GRID） | TASK-005 |
| AI 分類実行・Job claim / apply | BE-06 / BE-08 |
| context menu 保存の menu 登録 | BE-16 / P1 |
| Welcome 本番 UI・Category template step | TASK-014 / ISSUE-022 |
| favicon/thumbnail の MIME・容量・リサイズ詳細 | ISSUE-002 / TASK-010 |
| Playwright 拡張 E2E 基盤 | TASK-013 |
| 保存成功 toast / 一覧への即時反映（React Query 等） | TASK-005 と同時でもよいが、本 TASK では **保存成功応答** まで |

## 機能要件

### FR 対応表

| ID | 要件 | TASK-004 で満たす内容 |
| --- | --- | --- |
| FR-003 | popup 2 操作、開いただけでは保存しない | 「このページをブックマーク」「Bookmation ホームを開く」。アイコン click ≠ 保存 |
| FR-004 | 2 ショートカット + popup にキー表示 | `chrome.commands.getAll()` で allowlist 2 件のみ表示。空は `未割り当て` |
| FR-005 | ショートカット変更は Chrome 管理画面へ案内 | `割り当てを変更` → `chrome://extensions/shortcuts` へのリンクまたは手順 |
| FR-006 | URL 指定保存 | dashboardの共通ヘッダーからBookmark追加modalを開き、URL、任意title、0件以上のTagを保存する。ISSUE-D35の検証・タイトル・メタデータ方針に従う |
| FR-032 | Tagの順次追加 | 空の入力からリアルタイム候補または明示的に新規作成したTagを `追加`／Enterで1件ずつ加え、現在Tagを初期展開して個別解除する。未知Tagはerrorにする |
| FR-012 | 初回 / 通常ホーム | INSTALL だけ `#/welcome` を開き onboardingState 初期化。完了後は `#/home` |
| NFR-003 | AI 非対応でも保存できる | 保存成功は Job=PENDING のまま返す。AI Host 未接続でも Bookmark は残る |

### 保存入口（3 + 2）

#### 保存入口（3）

| # | Entrypoint | トリガー | 入力 |
| --- | --- | --- | --- |
| 1 | popup | 「このページをブックマーク」click | `activeTab` の URL / title / favIconUrl |
| 2 | command | `save-current-page` | 同上（アクティブタブ） |
| 3 | dashboard | Bookmark追加フォームsubmit | ユーザーURL、任意title、明示選択した0件以上のactive Tag ID |

3 入口は **同一 Application use case**（内部で `SaveCurrentTab` / `SaveBookmarkByUrl` を分岐）へ合流する。Bookmark 作成・重複確認・Job 永続化を **重複実装しない**（[BACKEND.md](../BACKEND.md)）。

#### ナビゲーション入口（2・保存しない）

| Entrypoint | 動作 |
| --- | --- |
| popup「Bookmation ホームを開く」 | `#/home` の dashboard tab を開く |
| command `open-bookmation-home` | 同上。**保存 handler を呼ばない** |

### 共通保存 use case 要件

#### 入力検証

- URL は `http:` / `https:` のみ（[SECURITY.md](../SECURITY.md)、ISSUE-D35）。
- Domain 層 `validateAndNormalizeUrl` を **唯一の正規化経路** とする。
- 不正 scheme・構文・長さ超過は `INVALID_URL`。保存しない。
- 入力 URL を HTML / fetch 先へ未検証連結しない。

#### タイトル

| 経路 | 優先順位 |
| --- | --- |
| 現在タブ保存 | `tab.title`（空なら hostname） |
| URL 指定保存 | ユーザー入力（任意）→ fetch タイトル（後追い可）→ hostname |

- 保存時点で title が未確定でも **valid URL なら保存する**（hostname fallback）。
- dashboard / 編集 modal での title 編集は TASK-005。本 TASK では URL 指定フォームの任意 title 入力のみ。

#### 重複 URL

- normalizedUrl + urlHash で ACTIVE Bookmark を検索。
- **完全一致** があれば **新規作成せず既存 Bookmark を返す**（`duplicate: true`）。
- hash 衝突時は normalizedUrl を再比較。
- 同一 `creationRequestId` の再送は既存 Job / Bookmark へ冪等収束（TASK-003 既存）。
- **P0 UX**: popup / dashboard では「すでに保存されています」を表示。ショートカット保存時は拡張アイコン badge で短く通知。

#### 永続化

- Bookmark + ClassificationJob（`state=PENDING`, `reason=INITIAL_SAVE`）を **1 IndexedDB transaction**。
- AI 呼び出し・HTML fetch・画像 Blob 化は **transaction 外**。
- DB 失敗時は Bookmark を部分公開しない。
- 成功応答には `bookmarkId`, `revision`, `savedAt`, `duplicate: boolean`（既存返却時 true）を含める。

#### メタデータ（ISSUE-D35）

| 項目 | 現在タブ | URL 指定 |
| --- | --- | --- |
| title | `activeTab` | 先保存 → fetch 後追い |
| favicon | `tab.favIconUrl` → Blob 化（可能なら） | fetch parse → 非同期 Blob |
| thumbnail | **最小 fetch**（og:image を後追い fetch。失敗は null） | og:image 等 → 非同期 Blob |

- メタデータ失敗は **保存を止めない**。faviconBlobId / thumbnailBlobId は null のまま可。
- 一覧プレースホルダーは TASK-005。本 TASK では Blob 保存まで。

#### AI 分類 Job

- 保存成功時点で Job は **PENDING** のみ作成。
- AI Host への claim / prompt は **呼ばない**（BE-08 以降）。
- `policyFromGranularity` は settings の `aiGranularity` から取得。settings 未接続時は Domain 既定（granularity=2 等）を Document 化する。

### popup 要件（[UI.md](../UI.md)）

表示順（固定）:

1. `このページをブックマーク` — 右に shortcut キー or `未割り当て`
2. `Bookmation ホームを開く` — 同上
3. `割り当てを変更` — Chrome shortcuts 管理画面への案内

挙動:

- popup mount 時に `chrome.commands.getAll()` を呼び、**manifest 宣言の 2 command 名だけ** を表示。
- 保存ボタン click で message 送信 → 成功 / 失敗を popup 内に表示（loading 状態含む）。
- 保存中は二重 submit を抑止。
- キーボード操作と focus 順序を確保（NFR-004 の最小）。

### dashboard Bookmark追加要件

- 配置: 共通ヘッダーの追加操作からBookmark追加modalを開く。
  - URL入力（必須）
  - タイトル入力（任意）
  - Tag入力（空欄）と最大8件のリアルタイム候補
  - 入力直下に左 `タグ n件`、右 `追加`
  - 初期展開した現在Tag。全画面カテゴリ・タグ一覧のTag chip形状と、Bookmark一覧のカテゴリ・タグシェブロン相当のhover／focus減光＋中央解除buttonを使う
  - Bookmarkを確定する `保存する`
- 選択中候補またはactive Tag名との正規化完全一致を `追加`／IME変換中ではないEnterで1件ずつdraftへ追加する。成功後は入力をclearしてfocusを戻し、Tagを続けて追加できる。
- `＋新規作成` は同じmodal内のTag作成side viewへ移り、作成成功したTagを入力の解決済み選択へ戻す。`追加`／EnterでBookmark draftへ確定する。
- 現在Tagの解除はBookmarkのTag edge draftだけを外し、Tag record自体を削除しない。同じTag IDを重複追加しない。
- 存在しないTag文字列を `追加`／Enterした場合はfield errorを表示し、暗黙作成しない。
- submit で Service Worker へ `SAVE_BOOKMARK_BY_URL` message。
- 成功時: インライン成功表示（例: 「保存しました」）。一覧更新は TASK-005 まで簡易でよい。
- 失敗時: `INVALID_URL` 等をフィールド横またはフォーム上部に表示。入力値は保持。

### `runtime.onInstalled` 要件

| `details.reason` | 動作 |
| --- | --- |
| `install` | ① `onboardingState` が未存在なら初期化 ② `#/welcome` tab を 1 枚開く |
| `update` / その他 | onboardingState を **上書きしない**。welcome tab を **開かない** |

- onboardingState の schema は [DB-SCHEMA.md](../DB-SCHEMA.md) §local_settings / chrome.storage に従う。本 TASK では **最小**（`currentStepId`, `completed: boolean` 等）で開始可。
- Welcome ページの本番 UI / template step は TASK-014。本 TASK では **route が開くこと** と **状態が INSTALL だけ初期化されること** を満たす。

### Service Worker / Message 要件（BE-03 最小）

#### Message 種別（P0 最小 set）

| action | 送信元 | 概要 |
| --- | --- | --- |
| `SAVE_CURRENT_TAB` | popup, command | activeTab 取得 → 保存 |
| `SAVE_BOOKMARK_BY_URL` | dashboard | payload `{ rawUrl, title?, tagIds: string[], requestId }`。自由入力Tag文字列と`categoryIds`は禁止 |
| `GET_COMMAND_SHORTCUTS` | popup | 2 command の表示用 shortcut 文字列 |

- 各 request に `schemaVersion`, `requestId`（UUID）必須。
- 同一 `requestId` 再送は同一結果へ収束。
- 未知 action / 不正 sender / payload サイズ超過は拒否。
- Service Worker は in-memory を正本にしない。起動のたび DB を開く。

#### Chrome API 利用

| API | 用途 |
| --- | --- |
| `chrome.tabs.query({ active: true, currentWindow: true })` | 現在タブ保存 |
| `chrome.tabs.create` | ホーム / welcome open |
| `fetch` + host_permissions | URL 指定メタデータ後追い |

`tabs` permission は **不要** とする（activeTab + currentWindow query で足りる想定。実装 spike で不足なら Document 更新）。

### Manifest 要件

```json
{
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://*/*", "http://*/*"],
  "commands": {
    "save-current-page": { "description": "現在のページをブックマーク" },
    "open-bookmation-home": { "description": "Bookmation ホームを開く" }
  }
}
```

- install 時の権限説明: host_permissions は URL 指定保存のメタデータ取得用（ISSUE-D35）。

## 非機能要件

| 項目 | 要件 |
| --- | --- |
| 冪等性 | requestId 再送、onInstalled 再発火、command 二重実行で重複 Bookmark を作らない |
| 永続性 | worker 再起動後も IndexedDB の Bookmark / Job が読める |
| セキュリティ | 危険 scheme 拒否、title / URL の XSS 非連結、fetch は検証済み URL のみ |
| 性能 | 保存応答はメタデータ fetch を **待たない**（先保存） |
| 障害 | DB エラーはユーザー向け安全メッセージ。内部 stack を popup に出さない |
| テスト | Vitest: Application use case + message handler + command handler。IndexedDB は fake-indexeddb |

## エラーとユーザー向け表示

| DomainErrorCode | 保存 | ユーザー向け（例） |
| --- | --- | --- |
| `INVALID_URL` | 否 | URL の形式が正しくありません |
| `TAG_SELECTION_INVALID` | 否 | タグが見つかりません。候補から選び直してください |
| `STORAGE_*` / DB 失敗 | 否 | 保存できませんでした。再度お試しください |
| 重複 URL | **是**（既存返却） | 保存済みです（duplicate=true） |

## 受け入れ条件（TASK-004 完了）

Issue #9 / [TASKS.md](../TASKS.md) / BE-04 完了条件と整合:

- [ ] popup に 2 ボタン + shortcut 表示 + 割り当て変更案内がある
- [ ] アイコン click だけでは保存されない
- [ ] `save-current-page` と `open-bookmation-home` が **別 handler** で、後者は保存しない
- [ ] dashboardからhttp(s) URLと0件以上のactive Tagを保存できる。それ以外は拒否
- [ ] Tag入力は空欄から始まり、0／1／8／9件以上のリアルタイム候補、新規作成Tag、`追加`／Enter、IME、連続追加、入力clear／focus復帰、`タグ n件`左／`追加`右、初期展開、Tag chip、個別解除を扱う
- [ ] 存在しないTag文字列、不在／非TAG／inactive ID、`categoryIds`を拒否し、Bookmark／edge／Jobを部分保存しない
- [ ] 3 保存入口が **同一 use case** を使う（context menu からも将来呼べる形状）
- [ ] valid URL なら metadata 失敗でも Bookmark が残る
- [ ] 重複 URL は新規複製せず既存を返す
- [ ] INSTALL だけ welcome 初期化 + tab open。update / reload では再表示しない
- [ ] worker 再起動後もデータが IndexedDB に残る
- [ ] `pnpm test` / `pnpm typecheck` / `pnpm build` が通る

## 判断ログ（追記）

- 2026-08-22 — 重複 URL: 既存返却 + UI「すでに保存されています」（P0）。
- 2026-08-22 — thumbnail: 最小 fetch（og:image 後追いのみ。詳細 MIME/容量は TASK-010）。
- 2026-08-23 — Bookmark追加／編集は同じTag順次追加componentを使い、仕様書をFigmaより優先する。
- 2026-08-22 — ホーム tab: 既に `#/home` が開いていればフォーカス、なければ新規 tab。

## 参考: 実装マイルストーン案（レビュー後に詳細化）

| 段階 | 内容 |
| --- | --- |
| M1 | Application `SaveBookmark` + urlHash 重複 + 単体テスト |
| M2 | SW message router + DB 接続 + `SAVE_CURRENT_TAB` |
| M3 | popup UI + shortcuts 表示 |
| M4 | commands `SAVE_CURRENT_PAGE` 接続 |
| M5 | dashboard URL フォーム + `SAVE_BOOKMARK_BY_URL` |
| M6 | onInstalled + host_permissions + メタデータ後追い skeleton |
| M7 | 結合確認（unpacked extension 手動） |

## 判断ログ

- 2026-08-22 — URL 指定保存 UI は `#/home` に P0 最小フォームを置く。
  - 理由: BACKEND.md が Dashboard URL 入力を Entrypoint と明記。専用 route は増やさない。
  - 代替案: popup 内 URL 入力 → FR-003 の 2 ボタン構成と矛盾するため不採用。
- 2026-08-22 — context menu は use case 共通化のみ。menu 登録は BE-16。
  - 理由: Issue #9 完了条件は「再利用できる use case」であり P1 menu 実装は含まない。

## 進捗

- [x] 2026-08-22 — 要件レビューと 3 点決定（重複 UI / thumbnail 最小 fetch / ホーム tab フォーカス）
- [ ] M1〜M7 実装
