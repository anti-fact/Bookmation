# TASK-101: 訪問日数閾値と保存リマインダー — 要件

- 日付: 2026-08-23
- 関連: FR-101 / TASK-101 / BE-13 / ISSUE-D34 / ISSUE-D39 / [UI.md](../UI.md) §一般設定・訪問リマインダー

## 目的

設定で有効化し、履歴権限を許可した場合だけ、期間内の訪問日数が閾値に達した **未保存 URL** にリマインダーを出す。利用者が「はい」を選ぶまで Bookmark を作らない。

## ISSUE-008 決定（ISSUE-D39）

| 項目 | 決定 |
|------|------|
| 集計期間の初期値 | **未選択（null）**。プレースホルダー表示。日数入力は期間未選択時 disabled |
| `DISMISSED`（通知を閉じた） | **`いいえ` と同じ reset**（`countingResetAt = 応答時刻`、以降の訪問日だけ再カウント） |
| SUPPRESSED URL 管理 | **v1 は一覧なし**。リマインダー UI の「次回から表示しない」チェックボックスのみ |

## スコープ（本実装）

### 一般設定 UI

- `自動ブックマークのリマインダー` switch（ON で `history` 権限説明と request）
- `訪問の集計期間` select（未選択 / 1週間 / 1ヶ月 / 1年）
- `リマインダー表示までの訪問日数` number input（既定 null、期間に応じ 1〜7 / 1〜30 / 1〜365）
- 期間変更時は日数をクリアして保存

### バックエンド

- IndexedDB `visitReminders` store（DB v2）
- 訪問日数集計（同日 1 日、URL 別 `countingResetAt`）
- `chrome.alarms` による定期評価（1 時間間隔）
- Dashboard `VisitReminder` ダイアログ（はい / いいえ / 次回から表示しない）
- messages: `get-general-settings-snapshot` 拡張、`update-reminder-settings`、`handle-visit-reminder`、`get-pending-visit-reminder`（取得前に評価）

### 非スコープ（v1）

- SUPPRESSED URL 一覧・再許可 UI（後続）
- AI 分類完了表示
- `DISMISSED` 専用の再表示 cooldown（`いいえ` と同じ reset）

## 受け入れ

- [ ] 設定未完了（期間 null または日数 null）では評価しない（`REMINDER_CONFIG_REQUIRED`）
- [ ] 閾値到達・未保存・非 SUPPRESSED URL にだけ通知
- [ ] 「はい」だけ `SaveBookmark`、`いいえ` / 通知閉じで reset
- [ ] 「次回から表示しない」で URL 単位 `SUPPRESSED`
- [ ] 確認前に Bookmark が増えない
