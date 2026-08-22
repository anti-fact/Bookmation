# BE-19 初回 Category template 適用

## 今回の実装

- 同梱 catalog の schema と、ISSUE-022 未決を示す空の `pending-issue-022` catalog を追加した。候補名は hardcode しない。
- catalog 読取は副作用を持たない。
- 明示 selection、catalog version、安定 requestId を受け、既存の `createCategory` を通して `origin=USER` Category を作る use case を追加した。
- requestId receipt を `chrome.storage.local` に保存し、同じ request の再送は同じ結果を返し、別 payload の再利用を拒否する。

## 未決事項

ISSUE-022 が決まるまで、候補名・set・初期選択・skip・再表示・locale/version 運用・onboarding state schema は追加しない。空 catalog の閲覧・適用は Label を作らない。
