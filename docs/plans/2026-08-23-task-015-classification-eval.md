# policy v2 分類評価fixtureと再採点可能な評価基盤が動く

- 状態: 完了
- 作成日: 2026-08-23
- 最終更新: 2026-08-23 11:25 JST
- 担当: Auto
- 関連: [AI_GUIDE.md](../AI_GUIDE.md#必須の実モデル評価) / [TESTING.md](../TESTING.md) / [BACKEND_TASKS.md](../../BACKEND_TASKS.md) §BE-08 / TODO-007 / PR #70

## 目的と利用者への価値

Gemini Nano タグ分類 policy v2 について、単発の成功例ではなく、固定fixture×細分化度を反復し、同じartifactから再採点できる証拠を残す。品質不合格時は promptVersion を上げて固定Nの全batchをやり直せる。

## 現在地

### 存在する

- [AI_GUIDE.md](../AI_GUIDE.md) の fixtureSchemaVersion 3 / resultSchemaVersion 1 / scorerVersion `classification-eval-scorer-v2` 契約
- Domain LabelNormalizer v1 と asset SHA-256
- BE-06 永続 Classification Job（policy v1 snapshot）
- BE-07 Prompt API Host スパイク

### 存在しない

- `src/evaluation/` の実装本体（空ディレクトリのみ）
- policy v2 Domain 型（現行 Domain は `maxNewTags` の v1）
- 分類候補 validator / Tag 適用 runtime（anti-fact/Bookmation#16）
- 実モデル N=10 batch の実行環境確定（#13）

## 対象範囲

- 対象:
  - fixtureSchemaVersion 3 artifact・preflight・canonical JSON v1 SHA-256 固定
  - NORMAL / MULTI_CONCEPT / AMBIGUOUS / BOUNDARY×4 / EQUIVALENCE 6×2 の fixture set
  - resultSchemaVersion 1 不変条件検証と resultArtifactSha256
  - scorer `classification-eval-scorer-v2`（通常・multi・境界・同等・曖昧の自動判定）
  - 初回dispatch前だけの環境除外 allowlist と runSequence N=10 規則
  - 隔離DB復元契約と batch harness（fake / recorded Provider）
  - 制御系の決定的試験（混在候補、timeout、truncated、process loss、late response、rollback、3 quality-zero）
- 対象外:
  - production AI Host / Prompt adapter / Tag 適用 use case 本体（#16）
  - 実 Chrome 上の Gemini Nano N=10 最終batch（#16 + #13 後）
  - Domain policy の v1→v2 本番移行と LOCAL_SETTINGS_V1 durable gate（BE-08 runtime）

## 前提・用語

- **cell**: `(fixtureId, granularity)` の組。各cellで非除外 N=10。
- **MODEL_DECISION / APPLICABLE / COMMITTED**: AI_GUIDE の3段階。attempt間結合禁止。
- **環境除外**: modelAttempt=0 かつ DISPATCH_RESERVED 未commit・応答未受信で allowlist 理由のみ。

## 実装方針

1. `src/evaluation/` に production runtime と分離した型・fixture・scorer・harness を置く。
2. evaluation 内で policy v2 snapshot 型を定義（Domain v1 と混在させない）。
3. fixture set をコード定義し、preflight 通過後に hash 固定。結果確認後の oracle 変更禁止をテストで固定。
4. fake Provider で制御系を決定的に試験。実モデル runner は Port として残し、環境未確定時は batch 開始を拒否する。
5. 隔離DBは fixture `initialState` + `baseInput` から復元する契約を実装。runtime apply が無い間は recorded / simulated commit path で result artifact を組めるようにする。

## 作業手順

1. Plan 作成（本ファイル）
2. canonical JSON v1・hash・評価型
3. fixture set + preflight + 固定hashテスト
4. result artifact 検証
5. scorer v2 + 閾値自動判定テスト
6. exclusion / runSequence / isolated DB / batch harness
7. control-path fake Provider テスト
8. BACKEND_TASKS BE-08 評価項目・WORKLOG・TODO-007 進捗更新

## 検証計画

| 確認 | 方法 | 合格条件 |
| --- | --- | --- |
| fixture preflight | vitest | 必須 case 欠落・oracle衝突・空期待集合を FIXTURE_INVALID |
| fixture hash 安定 | vitest | 同一 set で SHA-256 一致。oracle 変更で hash 変化 |
| result 不変条件 | vitest | N=10・attempt 規則・COMMITTED 整合の不正を拒否 |
| scorer | vitest | 通常80/90/95%、境界20pt、同等REUSE、曖昧NEEDS_REVIEWを判定 |
| 制御系 | vitest + fake Provider | timeout等を実モデル待ちせず再現 |
| typecheck / test | `pnpm typecheck` / `pnpm test` | 既存＋新規がパス |

## 判断ログ

- 2026-08-23 — 判断: production runtime（#16）と評価基盤を分離し、本Planは TASK-015 / BE-08 の評価契約部分だけを完了対象とする。
  - 理由: Issue本文が「品質評価基盤と評価結果を追跡」「runtime本体は#16」と明示。
  - 再検討条件: #16 マージ後に実モデル batch を同 harness で実行。

## 進捗

- [x] Plan 作成
- [x] 型・canonical JSON・hash
- [x] fixture set + preflight
- [x] result artifact
- [x] scorer v2
- [x] batch / exclusion / isolated DB
- [x] control-path tests
- [x] 文書更新と検証記録

## 完了条件

- fixtureSchemaVersion 3 / resultSchemaVersion 1 / scorerVersion `classification-eval-scorer-v2` の artifact 実装
- 必須 fixture 種別を含み、hash 固定後の oracle 変更を禁止できる
- 同じ result artifact から再採点できる scorer
- 制御系が fake Provider で決定的に通る
- 実モデル最終batchは依存（#16/#13）未充足として文書上ブロックと明記

## 非目標と後続

- Domain / Job / apply の policy v2 本番実装 → #16 / BE-08 runtime Plan
- Prompt API 対象環境の確定 → #13
- 実機 N=10 結果の合格判定と promptVersion bump 運用 → 上記依存解消後

## 検証記録（2026-08-23）

- `pnpm typecheck` 成功
- `pnpm test` 308 tests 成功（evaluation 16 件含む）
- 実 Gemini Nano batch: 未実施（`allowRealModel: true` は harness が拒否）

- 状態: 完了（評価基盤）。実モデル最終batchは後続。
