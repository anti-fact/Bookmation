# 保存した Bookmark / Category / Tag が再読込後も IndexedDB に残る

- 状態: 進行中
- 作成日: 2026-08-22
- 最終更新: 2026-08-22 12:05 JST
- 担当: 未定
- 関連: [要件](../REQUIREMENTS.md) / [設計](../DESIGN.md) / [DB-SCHEMA](../DB-SCHEMA.md) / [BACKEND](../BACKEND.md) / [TASK-003](../TASKS.md) / [BE-02](../../BACKEND_TASKS.md) / [Issue #7](https://github.com/anti-fact/Bookmation/issues/7)

## 目的と利用者への価値

Bookmation 専用の Bookmark、Category、Tag、分類 Job を **端末内 IndexedDB** に正本として保存し、拡張機能の再読込・Service Worker 再起動後もデータが失われない基盤を作る。

TASK-004 以降、利用者は popup や URL 入力から保存した Bookmark が dashboard の「最近追加」に残り、Category / Tag の名称・親子・論理削除ルールが一貫して守られる。本 Plan 単体では保存ボタン UI は完成しないが、Repository 契約テストと開発者向けの永続化確認で「再読込後も残る」ことを証明する。

## 現在地

### 存在する

| パス | 役割 |
| --- | --- |
| `src/domain/` | BE-01 完了。Bookmark / Label / Job 型、Normalizer v1、値オブジェクト、Domain エラー |
| `src/background.ts` | MV3 Service Worker entry（commands allowlist のみ。DB 未接続） |
| `src/tabs/index.tsx` | UI-02 App Shell（IndexedDB 未接続） |
| `docs/DB-SCHEMA.md` | Store / index / transaction 設計（**提案・未実装**と明記） |

### 存在しない

| パス | 備考 |
| --- | --- |
| `src/ports/` | Repository Port 定義なし（`export {}` のみ） |
| `src/adapters/indexeddb/` | IndexedDB open / migration / Repository 実装なし |
| `src/application/` | 保存 use case なし（TASK-004 / BE-04） |

### 確認済み制約

- IndexedDB 利用に追加 Manifest 権限は不要（[SECURITY.md](../SECURITY.md)）。
- Label Normalizer v1 は Domain 層に実装済み。Repository は **正規化結果を信用せず** write 前に Domain validator を通す。
- P1 Store（`visitReminders`、`syncOutbox` 等）は [DB-SCHEMA.md](../DB-SCHEMA.md) に定義があるが、本 Plan では **作成しない**。
- 旧試作 DB からの本番 migration は、現リポジトリに試作データが存在しないため **新規 install 前提** とする。legacy migration 手順は DB-SCHEMA に記載済みだが、本 Plan の完了条件には含めない。

## 対象範囲

- 対象:
  - P0 必須 Object Store 10 件（AI分類設定正本 `classificationSettings` を含む）の作成と index 定義
  - `schemaMeta` による DB 版管理と中断可能な migration **骨格**
  - Port 定義と IndexedDB Adapter（Repository 実装）
  - JSON document の read/write schema 検証、size 上限、unknown version 隔離
  - Bookmark + `classificationSettings` 正本の同一 transaction 保存と、AI 有効時だけの PENDING ClassificationJob
  - Label 名称の Normalizer v1 適用、tombstone 中の名称予約、namespace 分離 unique
  - `(bookmarkId, labelId)` edge と `creationRequestId` の冪等
  - `UpdateTag`（`tag-update:` requestId + `tagMutationReceipts` + Bookmark fan-out、**AI 再分類 Job なし**）
  - `DeleteCategoryCascade`（`category-delete:` requestId + AI 有効時だけ影響 Bookmark への PENDING Job）
  - Bookmark / Tag の確認なし soft-delete、Category の cascade soft-delete
  - SearchDocument の再構築・回収 **境界**（最小実装）
  - cursor ページング（`savedAt + id` 等）と Repository 契約テスト
- 対象外:
  - popup 保存 UI、commands 接続（TASK-004 / BE-04）
  - Service Worker message 契約（BE-03）
  - Bookmark 一覧 UI（TASK-005）
  - AI Host / Prompt API 実行（BE-07 / BE-08）
  - P1 Store と Drive / QR / 訪問リマインダー
  - Playwright 拡張 E2E（TASK-013）
  - 削除 Undo の operation / token / 復元経路（仕様上禁止）

## 前提・用語

- **正本**: Blob 以外は版付き JSON 互換 document。Blob は `blobs` Store のみ。
- **Category / Tag**: 利用者向け名称。内部 Store 名は `labels`、`kind` で `CATEGORY` / `TAG` を区別。
- **tombstone**: `deletedAt != null` の論理削除レコード。名称 unique index は tombstone も対象にし、物理 GC まで予約を維持。
- **Normalizer v1**: Unicode 15.1.0 vendored asset。`src/domain/normalizer/` を正本とし、asset SHA-256 は `getVendoredAssetSha256()` で固定。
- **requestId namespace**: Tag 更新は `tag-update:`、Category 連鎖削除は `category-delete:`。混用と別 payload 再利用を拒否。
- **テスト環境**: Vitest（node）。IndexedDB は `fake-indexeddb` 等で決定的にテストする（BE-00 完了メモ、確認日: 2026-08-16）。
- **Node / pnpm**: `.nvmrc` 22、`pnpm@10.15.1`（確認日: 2026-08-22、`package.json`）。

### Label / edge / Bookmark の不変条件（Repository が守る）

- project-vendored Unicode 15.1.0 に固定した **Label Normalizer v1**。
- tombstone 中も **名称を予約**し、同名別 ID を拒否。物理回収後のみ再利用。
- **active Tag** は **active Category** を 1 件必須。tombstone Tag は deleted 親参照可。
- 子 Tag tombstone が残る間、**親 Category の物理 GC を拒否**。
- Bookmark の Category 集合は **active Tag の親から自動導出**。Category 直接編集は拒否。
- **Tag 親変更**は Tag / 選択親の expected revision と submit 開始時に 1 回発行する `tag-update:` requestId を検証。全参照 Bookmark の Category closure・revision・検索派生データ・mutation receipt を **原子的** に更新。同 request 再送は同じ `UpdateTagResult` へ収束。別 payload で requestId 再利用は拒否。**AI 再分類 Job は作らない**。
- **Category 連鎖削除**は `category-delete:` namespace。警告確認後に Category / 全子 Tag / 関連 edge を cascade soft-deleteし、Bookmark 本体を保持する。classificationSettings が CONFIGURED かつ enabled の場合だけ、影響 Bookmark ごとの **PENDING 再分類 Job** を同じ transaction で作成する。AI 有効時は3 dispatchすべてquality-zeroの場合だけ `NEEDS_REVIEW`、technical failureを含むdispatch枯渇またはexecution枯渇は `FAILED` とする。disabled / 再設定待ちは Job を作らず残存active Tag有無から `CLASSIFIED` / `UNCLASSIFIED` にし、全状態で手動分類を許す。
- Bookmark / Tag は **確認なし soft-delete**。削除 Undo 用 token / 期限 / 復元経路は **作らない**。

## 実装方針

### レイヤー配置

```text
src/
  domain/                 # 既存。Repository は import せず Port 経由で Domain 型のみ受け渡し
  ports/
    repositories.ts       # BookmarkRepository, LabelRepository, JobRepository 等
    unit-of-work.ts       # transaction 境界（任意。1 ファイルにまとめても可）
  adapters/
    indexeddb/
      open-database.ts    # open / upgrade / schemaMeta
      migrations/         # version ごとの upgrade 手順
      stores.ts           # store 名・index 定数
      mappers.ts          # IDB record ↔ Domain（schema 検証を挟む）
      *-repository.ts     # Port 実装
  application/            # 本 Plan では Repository を呼ぶ thin helper / 契約テスト用のみ
```

- **Domain は IndexedDB / Chrome API に依存しない**（既存方針維持）。
- Adapter は `idb` ライブラリまたは素の `indexedDB` API を使用。選定は M1 着手時に判断ログへ記録する。
- UI / Service Worker から Repository を直接 import しない。TASK-004 以降は Application 層が Port を注入する。

### Object Store と主要 index（P0）

[DB-SCHEMA.md](../DB-SCHEMA.md) に従い、最低限次を実装する。

| Store | 主要 unique index |
| --- | --- |
| `bookmarks` | （urlHash は non-unique。normalizedUrl は Repository で比較） |
| `labels` | `byCategoryUniqueName`, `byTagUniqueName`, `byCreationRequestId` |
| `bookmarkLabels` | `byBookmarkAndLabel` |
| `classificationJobs` | `byActiveInputKey`, `byRequestId` |
| `classificationSettings` | key-addressed |
| `tagMutationReceipts` | requestId を key path |
| `bookmarkRevisions` | — |
| `searchDocuments` | — |
| `blobs` | — |
| `schemaMeta` | key-addressed |

non-unique index（`bySavedAt`, `byParentCategory`, `byLabel`, `byBookmark` 等）は M2 以降で一覧・fan-out に必要なものから追加する。

### transaction 境界

| 操作 | 含める Store（P0） |
| --- | --- |
| 新規 Bookmark 保存 | `bookmarks`, `labels`, `bookmarkLabels`, `classificationSettings`, `classificationJobs`, `bookmarkRevisions`, `searchDocuments` |
| Tag edge 更新 | `labels`, `bookmarkLabels`, `bookmarks`, `classificationJobs`, `bookmarkRevisions`, `searchDocuments` |
| UpdateTag | `labels`, `bookmarkLabels`, `bookmarks`, `bookmarkRevisions`, `searchDocuments`, `tagMutationReceipts` |
| DeleteCategoryCascade | `labels`, `bookmarkLabels`, `bookmarks`, `classificationJobs`, `classificationSettings`, `bookmarkRevisions`, `searchDocuments` |
| Tag / Bookmark soft-delete | 上記と同様に fan-out 対象を 1 transaction |

P1 の `syncOutbox` は Port に optional hook を留めるか、M4/M5 では **未実装** とし、transaction コメントで拡張点を明示する。

### migration 骨格

- 新規 install: `schemaMeta.dbVersion = 1`、`migrationState = IDLE`。
- upgrade は **Store / index 追加のみ** を version 単位で行い、大量データ変換は `migrationCursor` で段階化（初版では cursor を使う変換処理は空でもよい）。
- `migrationCursor.lastKey` は JSON round-trip 可能な string / finite number / 一次元配列のみ。
- 失敗時: `migrationState = FAILED` を記録し、再 open で復旧手順をテストする。

## マイルストーン

### M1: IndexedDB を開き、Bookmark を保存して再読込後も残す

- 成果: 開発者がテストまたは一時的な dev hook から Bookmark を 1 件書き込み、DB を閉じて再度 open しても同じレコードが読める。
- 変更箇所: `src/ports/`, `src/adapters/indexeddb/open-database.ts`, `stores.ts`, `bookmark-repository.ts`, `schemaMeta` 初期化。
- 実行: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- 期待結果: fake IndexedDB 上で Bookmark の JSON round-trip、不正 schemaVersion 拒否、再 open 後の read 成功。
- 失敗時: transaction 途中で throw した場合、部分 commit された Bookmark を一覧 API が返さない（all-or-nothing）。
- 手動確認: 該当なし（M6 まで UI 接続しない）。

### M2: Category / Tag の作成と名称一意・tombstone 予約

- 成果: Normalizer v1 適用後の Category / Tag を作成でき、同名 tombstone がある間は別 ID 作成を拒否する。
- 変更箇所: `label-repository.ts`, unique index 利用、Domain `normalizeLabelName` 連携。
- 実行: `pnpm test`（Normalizer golden + 名称競合 + tombstone 予約 fixture）
- 期待結果: `  Ｐｙｔｈｏｎ　入門 ` → 正規化保存、tombstone 同名 → `LABEL_NAME_CONFLICT` 相当、active Tag は active 親必須。
- 失敗時: 競合時は Store へ write せず DomainError を返す。

### M3: edge 冪等と Bookmark + AI 設定正本の同一 transaction

- 成果: `(bookmarkId, labelId)` edge と `creationRequestId` の再送が重複レコードを増やさず、Bookmark 保存と新規 install 既定（revision 1、CONFIGURED、AI 有効、細分化度 2、BALANCED）の `classificationSettings` 正本を同じ transaction で扱う。CONFIGURED かつ enabled の場合だけ PENDING Jobを同時 commit／rollbackし、disabled／再設定待ちはJobなしで保存する。
- 変更箇所: `bookmark-label-repository.ts`, `classification-job-repository.ts`, unit-of-work。
- 実行: `pnpm test`
- 期待結果: 同一 creationRequestId 再送 → 1 件、AI有効時にJobだけ成功／Bookmark失敗 → 両方rollback、AI無効時はJob 0件でBookmarkがCLASSIFIED／UNCLASSIFIED。
- 失敗時: 部分 Job 公開なし。AI設定にかかわらずBookmark保存を失わない。

### M4: UpdateTag（receipt 収束・Bookmark fan-out・AI Job なし）

- 成果: Tag 名または親 Category 変更時、全参照 Bookmark の Category closure / revision / SearchDocument が 1 transaction で更新され、同 `tag-update:` requestId 再送は同じ `UpdateTagResult` を返す。
- 変更箇所: `update-tag.ts`（Adapter 内）、`tagMutationReceipts` Store。
- 実行: `pnpm test`（0 件 / 1 件 / 多数 Bookmark、revision 競合、requestId 再利用拒否）
- 期待結果: fan-out 途中失敗 → 全件 rollback；**ClassificationJob は新規作成しない**。
- 失敗時: `REQUEST_ID_REUSED`, `REVISION_CONFLICT` を Domain エラーで返す。

### M5: Category cascade 削除とAI設定gate付き再分類

- 成果: `category-delete:` requestId と impact fingerprint 検証後、Category / 全子 Tag / edge を cascade soft-deleteしてBookmark本体を残す。classificationSettingsがCONFIGUREDかつenabledの場合だけ影響BookmarkごとにPENDING Jobを1件作り、disabled／再設定待ちはJobを作らず残存active Tag有無からCLASSIFIED／UNCLASSIFIEDにする。
- 変更箇所: `delete-category-cascade.ts`、Job 作成ロジック。
- 実行: `pnpm test`（fingerprint 不一致 → 無変更、完了済み request 再送 → no-op）
- 期待結果: AI有効時は3 quality-zeroでBookmark `NEEDS_REVIEW`、technical／execution枯渇で `FAILED` へ遷移可能な状態を残す。AI無効／再設定待ちはJob 0件で、どちらも手動分類できる。
- 失敗時: 削除 Undo 経路は作らない。

### M6: SearchDocument 境界・cursor 一覧・migration 骨格

- 成果: `savedAt desc` + cursor で Bookmark 一覧を取得でき、SearchDocument の再構築 / tombstone 時無効化の境界がテストで固定される。migration 中断再開の smoke test がある。
- 変更箇所: `search-document-repository.ts`, `migrations/`, cursor query。
- 実行: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- 期待結果: 同一 `savedAt` でも id tie-break で cursor が安定、migration FAILED → 再 open で IDLE 復帰または明示エラー。
- 手動確認: Chrome devtools Application → IndexedDB に Store が存在すること（任意。自動テストを正本とする）。

## 進捗

- [x] 2026-08-22 11:55 JST — Execution Plan 作成（本ファイル）
- [x] 2026-08-22 12:05 JST — M1–M6 実装完了。`LocalDataLayer` + 17 Repository 契約テスト。`pnpm test` 195 passed / typecheck / build OK
- [ ] YYYY-MM-DD HH:MM JST — TASKS.md / BE-02 チェックリスト更新、Plan 完了

## 発見事項

- 2026-08-22 — 発見: IndexedDB transaction 内で `crypto.subtle` 等の非 IDB await を挟むと fake-indexeddb / 実装ともに transaction が inactive になる。
  - 証拠: 初回テスト 15 failed、`InvalidStateError` at `putBookmark`
  - 影響: fingerprint / urlHash は transaction **開始前** に計算。Category cascade は read → fingerprint 検証 → write の 2 phase に分割。

- 2026-08-22 — 判断: Adapter ライブラリに `idb`、テストに `fake-indexeddb` を採用。
  - 理由: Promise ベース API と決定的な node/jsdom テスト。
  - 検討した代替案: 素の indexedDB API。
  - 再検討条件: Service Worker 環境で idb の bundle サイズが問題になった場合。

## 判断ログ

- 2026-08-22 — 判断: legacy DB migration は本 Plan の完了条件から除外し、新規 install の migration 骨格のみ実装する。
  - 理由: 現 `main` に試作 IndexedDB データや旧 Store 実装が存在せず、DB-SCHEMA も「未実装」と明記されている。
  - 検討した代替案: DB-SCHEMA の 11 段階 legacy 移行を同時実装する。
  - 再検討条件: 試作 DB を持つ環境や beta ユーザーデータが発生したとき、別 Plan を起票する。

- 2026-08-22 — 判断: Normalizer v1 は Domain 層（BE-01）を再利用し、Repository では write 前後の Domain validator のみ呼ぶ。
  - 理由: BE-01 完了メモで Normalizer と golden vector が既に単体テストされている。
  - 検討した代替案: Adapter 内に正規化ロジックを複製する。
  - 再検討条件: Normalizer asset 更新時は Domain と Repository テストを同時更新する。

## 検証と受け入れ条件

- [ ] 自動検証: `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` が成功する。
- [ ] Webプレビュー: **対象外**。本 Plan はデータ層のみで UI 導線を変更しない。Repository 契約は Vitest + fake IndexedDB が正本。
- [ ] AIエージェントE2E: **対象外**（TASK-013）。IndexedDB 永続化の成功根拠に Web プレビューを使わない（[TESTING.md](../TESTING.md)）。
- [ ] 手動検証: 任意。Chrome DevTools で Store 存在確認。必須証拠は自動テスト。
- [ ] 人間受入: TASK-003 完了時は BE-02 チェックリストと Issue #7 完了条件の照合を [WORKLOG.md](../WORKLOG.md) に記録する。TASK-012 の人間受入は含めない。
- [ ] 状態fixture: Normalizer v1 golden、tombstone 同名拒否、edge 再送、Tag 親変更 0/1/多数 Bookmark、revision 競合、同 request 再送 / 別 payload 拒否、新規installのAI設定既定、AI enabled／disabled／再設定待ち別の保存とCategory cascade、fingerprint 不一致、削除 Undo 経路なし、migration 中断 — を Repository テストで再現する。
- [ ] エラー経路: transaction 失敗時は部分データを公開せず、既存 commit 済みデータを破壊しない。
- [ ] 文書: 実装完了時に [TASKS.md](../TASKS.md) TASK-003 チェック、[BACKEND_TASKS.md](../../BACKEND_TASKS.md) BE-02 状態を更新する。

## 再実行・復旧

- `pnpm test` と DB テストは fake IndexedDB 上で毎回 isolated に実行可能。
- migration テスト失敗時は fake DB を破棄して再実行する。
- 開発中の Chrome 手動確認で DB を汚した場合は、拡張機能の「サイトデータ削除」または DevTools で IndexedDB を削除して再読込する。
- 破壊的 schema 変更は version を上げ、downgrade はサポートしない。

## 結果と残課題

- （Plan 完了時に記録）
