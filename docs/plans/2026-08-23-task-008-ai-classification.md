# AI分類policy v2と結果検証・適用の縦スライスが動く

- 状態: 進行中
- 作成日: 2026-08-23
- 最終更新: 2026-08-23 11:40 JST
- 担当: Auto
- 関連: TASK-008 / BE-08 / [AI_GUIDE.md](../AI_GUIDE.md) / [TASK-015 Plan](2026-08-23-task-015-classification-eval.md)

## 目的と利用者への価値

Bookmark保存後のAI分類が、policy version 2（件数上限なし・REUSE／CREATE・importance）で検証され、正常候補だけがTagへ反映される。評価基盤（`src/evaluation`）と同じpolicy／候補契約を Domain 正本として共有する。

## 現在地

- BE-06: Job claim／apply shell
- TASK-015: evaluation fixture／scorer
- **本Plan実装済み**: Domain policy v2、固定prompt、validate→APPLICABLE、applyValidatedClassificationResult、evaluation の policy 共有、**実 Gemini Nano Host**（Prompt API Provider + Dashboard `ClassificationHostPanel`）
- **未実装**: pendingApply／DISPATCH_RESERVED 永続化、LOCAL_SETTINGS_V1 gate、再分類 AI edge 置換完全版

## 対象範囲（本Plan）

- Domain: `ClassificationPolicySnapshot` に v2 を正本化（v1は履歴許容）
- Domain: `ClassificationPromptInput`、固定system prompt、候補query並び
- Domain: envelope／candidate schema → MODEL_DECISION → APPLICABLE
- Adapter: 検証済み候補の Tag CREATE／REUSE 適用（同TX）
- Job作成: `policyFromGranularity` を v2、`maxAssignedTags=0`（無制限）
- evaluation: Domain 正本を re-export
- 決定的テストと evaluation fixture との整合確認

## 対象外（後続）

- PREPARED／DISPATCH_RESERVED／pendingApply 永続化の完全実装
- LOCAL_SETTINGS_V1 durable migration gate
- 再分類時の AI edge 置換／USER昇格の全規則
- 実 Nano N=10 batch（#13+#16）／3 quality-zero の DISPATCH_RESERVED 永続リトライ

## 検証記録（2026-08-23）

- `pnpm typecheck` 成功
- `pnpm test` 304 tests 成功（Domain／eval 縦スライス時点）
- Domain `policyFromGranularity` ≡ evaluation `policyV2FromGranularity`
- validate→apply 縦スライス（CREATE+REUSE+混在棄却）確認

## 検証記録（2026-08-23・Nano Host）

- `pnpm typecheck` 成功
- Provider／Host runner 単体テスト成功（モック LanguageModel）
- 配線: `createGeminiNanoClassificationProvider` → `runOneClassificationJob` → claim／apply-validated／apply-terminal
- UI: Settings → 一般 →「Gemini Nano 分類 Host」（可用性確認／次の Job を分類）
- 実 Chrome 上の Prompt API 手動確認は未実施（対応環境が必要）

## 進捗

- [x] Domain policy v2
- [x] validator / prompt
- [x] apply
- [x] evaluation 整合
- [x] 実 Gemini Nano Host 配線（単発 claim→classify→validate→apply）
- [x] 文書・検証
- [ ] 実機 Chrome での Prompt API 手動確認
