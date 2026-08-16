# トラブルシューティング

## 最初に確認すること

2026-08-17時点ではPlasmo開発基盤、`package.json`、Vitest、確認用popupが存在する。保存・一覧・AI、UI Webプレビュー、Playwright拡張E2Eは未実装である。`package.json` 自体が見つからない場合は古いbranch、誤ったディレクトリ、不完全なcheckoutを疑い、[QUICKSTART.md](QUICKSTART.md) で現在の状態を確認する。

実装後の障害調査では、次の順序を守る。

1. 保存済みデータを保護する。エクスポートできるなら先に退避する。
2. Chrome版、OS、拡張機能版、再現時刻、操作を記録する。
3. 一度に一つの条件だけ変えて再現する。
4. 元データと、検索インデックス・サムネイル等の派生データを区別する。
5. `chrome://extensions` の拡張機能エラーとservice workerのコンソールを確認する。

**調査のために拡張機能を削除したりストレージを消去したりしない。** アンインストールは拡張機能データを失う可能性がある。復旧手段が確認できない場合は、状態を保ったまま [ISSUES.md](ISSUES.md) へ記録する。

## 早見表

| 症状 | 主な切り分け先 |
| --- | --- |
| `package.json` がない / 開発サーバーを起動できない | [まだアプリがない](#packagejson-がない--起動コマンドが分からない) |
| 拡張機能を読み込めない | [ビルド出力とmanifest](#chromeが拡張機能を読み込まない) |
| AI分類だけ使えない | [Prompt APIの可用性](#prompt-apiが利用できない) |
| モデル取得が終わらない | [モデルダウンロード](#モデルのダウンロードが進まない) |
| 保存後に消える / 容量エラー | [ストレージ](#保存できない容量エラーまたは再読込後に消える) |
| 一度は動くが後でボタンが反応しない | [service worker](#しばらくすると保存処理が反応しない) |
| タグが増えすぎる / 同名タグが作成される | [分類](#タグが増えすぎるまたは同名タグが作成される) |
| 自然言語検索の候補がない / 1件に固定される | [検索候補](#自然言語検索の候補が正しく出ない) |
| keyword候補が8件を超える / 一覧上に検索結果が重なる | [フルページ検索](#keyword候補またはフルページ検索が正しくない) |
| 初回ホームが毎回出る / 一度も出ない | [初回ホーム](#初回ホームが正しく表示されない) |
| カテゴリ・タグを誤って削除した / 親子表示が崩れる | [カテゴリ・タグ管理](#カテゴリタグの作成編集削除が正しくない) |
| Bookmarkを削除した後に戻せない | [削除とundo](#bookmarkの削除またはundoが正しくない) |
| 設定値を保存できない / リマインダーが止まらない | [履歴とarchive](#訪問リマインダーまたは自動アーカイブが動かない) |
| popupやshortcutが意図した操作をしない | [保存導線](#popupまたはshortcutが意図した操作をしない) |
| Webプレビューと実拡張の結果が違う / E2E証拠がない | [テスト面の切り分け](#webプレビューplaywright人間確認を切り分けられない) |

## `package.json` がない / 起動コマンドが分からない

**症状**

- `pnpm dev`、`npm run dev` 等が `package.json` 不在で失敗する。
- Chromeへ読み込むディレクトリがない。

**考えられる原因**

- 古いbranch、誤ったディレクトリ、不完全なcheckoutを開いている。
- 別branchや別worktreeに実装がある。

**確認**

```bash
pwd
git status --short --branch
find . -maxdepth 2 -name package.json -o -name manifest.json
```

**対処**

- 現在のbranchとリポジトリを確認する。
- `origin/main` と差がある場合は、未コミット変更を保護してから履歴を確認する。
- 正しいcheckoutにも `package.json` がなければ、推測で再生成せず [ISSUES.md](ISSUES.md) に取得元とcommitを記録する。

## Chromeが拡張機能を読み込まない

**症状**

- `chrome://extensions` で「マニフェスト ファイルが見つからない」「読み込めませんでした」等が表示される。

**考えられる原因**

- ソースディレクトリを選び、ビルド出力を選んでいない。
- 開発ビルドが失敗または古い。
- manifestの権限、パス、service worker指定が不正である。

**確認**

1. 使用中のpackage scriptとビルドログを確認する。
2. 選択したディレクトリ直下に生成済み `manifest.json` があるか確認する。
3. 拡張機能カードの「エラー」から最初のエラーを確認する。

**対処**

- 既存のbuildディレクトリを削除する前に、未追跡の成果物だけか確認する。
- 正しい開発ビルドを再生成し、`chrome://extensions` の更新ボタンで再読込する。
- 権限を増やして回避せず、[SECURITY.md](SECURITY.md) の最小権限方針と照合する。

## Prompt APIが利用できない

**症状**

- AI分類ボタンが無効、または `LanguageModel is not defined` と表示される。
- 可用性が `unavailable`、`downloadable`、`downloading` のままである。

**考えられる原因**

- 使用中のChrome、OS、端末性能、言語指定が対応条件を満たさない。
- Gemini Nanoモデルが未取得または取得中である。
- Manifest V3のservice worker等、Prompt APIが提供されない実行コンテキストから呼び出している。
- `availability()` と `create()` / `prompt()` に渡す言語・モダリティ条件が一致していない。
- 古い試験版API名や期限切れのorigin trial権限を参照している。

**確認**

実装時点の公式仕様を先に確認する。2026-08-14に確認した公式資料では、Prompt APIは `LanguageModel.availability()` を使い、`unavailable`、`downloadable`、`downloading`、`available` を区別する。APIは変化し得るため、下記をアプリの恒久的な契約としてコピーせず、診断用に使う。

```js
typeof globalThis.LanguageModel
const options = {
  expectedInputs: [
    { type: "text", languages: ["en", "ja"] },
  ],
  expectedOutputs: [
    { type: "text", languages: ["ja"] },
  ],
}
await LanguageModel.availability(options)
```

`expectedInputs` / `expectedOutputs` には本番と同じモダリティと言語を指定し、同じ `options` を `LanguageModel.create(options)` にも渡す。公式資料: [Prompt API](https://developer.chrome.com/docs/ai/prompt-api)、[Built-in AIを始める](https://developer.chrome.com/docs/ai/get-started)。

また、同資料の2026-08-14時点の記載ではPrompt APIはWeb Worker内で利用できない。診断コードをservice workerのコンソールだけで試さず、設計上Prompt APIを実行する対応extension documentのコンソールでも確認する。どのdocument contextを使うかはprototypeで実証してから固定する。

**対処**

- `available`: session作成時のエラーと入力検証を調べる。
- `downloadable`: 利用者が明示的にAI機能を開始するクリック等からモデル取得を開始し、進捗を表示する。
- `downloading`: 同じ処理を連打せず進捗を表示し、保存は先に完了させる。
- `unavailable` またはAPIなし: 手動分類へ切り替える。ブックマーク保存自体を失敗させない。
- service workerだけでAPIなし: workerへモデルsessionを置かず、検証済みのextension document側へ分類処理を分離する。messageの中断・再送を冪等にする。
- 開発用flagやorigin trialは本番利用者への恒久的な解決策にしない。対象Chrome版と配布条件を [CONSTRAINTS.md](CONSTRAINTS.md) に記録する。

## モデルのダウンロードが進まない

**症状**

- `availability()` が長時間 `downloadable` / `downloading` のままである。
- ダウンロード後に再びモデルが必要と表示される。

**考えられる原因**

- Chrome profileを置くボリュームの空き容量が不足している。
- 従量制ネットワーク、通信中断、Chromeの再起動待ちである。
- 端末要件を満たさずモデルが削除・無効化された。

**確認**

- Chromeを再起動する。
- `chrome://on-device-internals` の `Model Status` でエラーと現在のモデル状態を確認する。
- ディスク空き容量とネットワーク状態を確認する。
- `availability()` を本番と同じ言語条件で再確認する。

2026-08-14に確認したChrome公式資料は、profileのあるボリュームに22 GB以上の空きを要件として案内し、取得後に空きが10 GB未満になるとモデルが削除され得るとしている。数値は更新され得るため、障害対応時は [公式要件](https://developer.chrome.com/docs/ai/get-started#requirements) を再確認する。

**対処**

- 空き容量と非従量制ネットワークを確保し、Chromeを再起動して待つ。
- 取得開始とAI分類は利用者操作から行い、`downloadprogress` をUIへ反映する。
- 取得に失敗しても専用ブックマークは保存し、手動分類と後日の再試行を案内する。

## 保存できない、容量エラー、または再読込後に消える

**症状**

- `QuotaExceededError`、保存失敗が出る。
- 保存直後は見えるが、拡張機能やChromeの再起動後に消える。
- サムネイル追加後から容量が急増する。

**考えられる原因**

- UI stateやservice workerのグローバル変数にだけ保存している。
- `localStorage` をservice workerから使おうとしている。
- 画像・HTML等を無制限に保存し、quotaへ達した。
- スキーマ移行が部分的に失敗した。

**確認**

```js
await navigator.storage.estimate()
```

- 実際の正本ストアに対象IDがあるか、UIのキャッシュと分けて調べる。
- `chrome://extensions` のservice workerコンソールで最初の保存エラーを見る。
- スキーマ版、移行ログ、サムネイル容量を確認する。

Chrome拡張のservice workerではIndexedDBを利用できる一方、Web Storageの `localStorage` / `sessionStorage` は利用できない。公式資料: [Extension storage and cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)。

**対処**

- UIだけを更新せず、永続化成功後に保存完了として表示する。
- サムネイル等の派生データから削減し、元URL・分類を先に保護する。
- 移行はバックアップ後に再実行可能な単位で行う。
- `unlimitedStorage` を無条件に追加せず、必要性と利用者への説明を [SECURITY.md](SECURITY.md) でレビューする。

## しばらくすると保存処理が反応しない

**症状**

- 拡張機能を読み込んだ直後は動くが、放置後に最初の操作だけ失敗する。
- 処理中表示のまま、または同じブックマークが二重登録される。

**考えられる原因**

- Manifest V3のservice worker停止でグローバル変数、session、途中状態を失った。
- 非同期処理の完了を待たずmessage channelを閉じた。
- 再送時の冪等性キーがない。

**確認**

1. `chrome://extensions` からservice workerの検証画面を開く。
2. workerを停止し、保存操作で正常に再起動するか確認する。
3. 保存要求ID、永続化済み段階、AI分類段階をログで追う。URLやタイトルそのものは診断ログへ不用意に出さない。

Chromeは拡張service workerを非活動時に終了するため、グローバル変数を正本にしてはならない。公式資料: [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)。

**対処**

- 入力を受けた時点でジョブIDと最小のブックマーク情報を永続化する。
- 保存、分類、インデックス更新を冪等な段階に分ける。
- worker再起動時に `pending` を再開するか、安全な失敗状態として手動再試行可能にする。
- workerを常時起動し続ける回避策に依存しない。

## タグが増えすぎる、または同名タグが作成される

**症状**

- 同義のタグ、表記違い、小さすぎるタグが想定以上にできる。
- 利用者が作ったタグとは別にAIタグが作られる。
- 同じ正規化名のタグが複数できる、またはimport／同期データの異なる親カテゴリで名前競合する。

**考えられる原因**

- 細分化スライダーの値がプロンプトや上限へ反映されていない。
- AIが既存のユーザー定義タグより新規作成を先に評価している。
- `tagUniqueName` のglobal unique indexまたは書込transaction検証がない。
- 同名判定を親カテゴリ内だけで行い、別の親カテゴリにあるタグを見落としている。
- soft-deleteで名前予約を外し、同名別IDを作ってからundoしている。
- NFKC、Unicode whitespace、case fold、禁止文字、normalizerVersionが入口ごとに異なる。
- AI出力を検証せずそのまま保存している。

**確認**

- 問題のタグについて、タグID、表示名、正規化キー、親カテゴリID、利用者／AIの由来、利用件数、作成時の細分化設定を確認する。
- `normalizerVersion=v1` と、NFKC、Unicode whitespace trim／collapse、固定locale非依存case fold、制御／禁止不可視文字拒否の結果を確認する。
- 細分化 `0` の場合は新規AIタグが0件であることと、既存タグの自動付与が止まっていないことを分けて確認する。
- Jobの `{ granularity, maxNewTags }` がdiscriminated snapshotとして `0→0 / 1→1 / 2→2 / 3→4 / 4→6` のいずれかに固定され、不一致が拒否されているか確認する。
- 同じfixtureを同じ設定で再分類し、差分を見る。
- 利用者定義候補をAIへ渡しているか確認する。
- 同じブックマークに同じタグIDの関連が2件以上ないか確認する。
- 同じ正規化名のTAGが複数あれば現行要件違反として、作成経路、migration、同期競合を調べる。CATEGORYとTAGは別namespaceなので、カテゴリ名とタグ名の相互一致は違反ではない。

**対処**

- 利用者定義の一致候補を最優先する。
- 新規タグ数、文字数、禁止値を決定的な後処理で検証し、細分化 `0`〜`4` と新規タグ上限 `0 / 1 / 2 / 4 / 6` の規則外の候補を拒否する。
- カテゴリは利用者だけが新規作成できる。AIが返した未知のカテゴリ名やIDは保存しない。
- activeなタグにはactiveな親カテゴリを必須とし、タグだけが親から外れた状態を保存しない。tombstoneタグはdeleted親を参照できるが、復元は親カテゴリを先に戻した後だけ許し、子tombstoneが残る親を物理回収しない。
- タグ作成時はLabel Normalizer v1の結果を使い、tombstoneを含め親カテゴリをまたいで名前競合を検出する。有効なら元画面で選び、削除済みなら同じIDを明示復元し、そうでなければ別名へ直す。物理回収前に別IDを作らない。
- 既に存在する重複タグは自動統合・自動削除せず隔離し、migrationまたは利用者確認付き修復へ回す。
- 完全に同じ `bookmarkId` と `labelId` の二重関連だけを除去する。

## 自然言語検索の候補が正しく出ない

**症状**

- 自然文で探しても候補が出ない、または常に1件しか出ない。
- Bookmarkまたはカテゴリ・タグの片方のグループしか更新されない。
- Bookmationの使い方を質問しても検索候補だけが出る、または検索しているのに機能説明だけが出る。
- AIが利用できないと検索自体が止まる。

**考えられる原因**

- AI入力ポップアップの意図判定またはresponse種別を誤り、検索と機能説明を区別できていない。
- 種類ごとの取得上限が1に固定されている、または候補集合の選択条件が厳しすぎる。
- タグやブックマーク更新後に派生インデックスが更新されていない。
- AIの返した未知IDを除外した後のfallback候補がない。
- 文字列・正規化検索をAI利用不可時に実行していない。

**確認**

1. 両一覧のAIボタンが同じ入力ポップアップを開き、送信と応答確認がpopup内で完結するか確認する。
2. 種類ごとの候補上限と返却ID集合を確認する。検索結果は1件に確定せず複数候補を返せる契約とする。
3. 対象bookmark、tag、関連が正本ストアにあるか確認する。
4. AIを無効にし、表示名・タイトル・URL・関連タグによるローカルfallbackが動くか確認する。
5. インデックス版と最終更新時刻を確認する。
6. 機能質問では、応答が版管理された現行機能情報に基づき、未実装機能を利用可能と断定していないか確認する。

**対処**

- AI入力と応答を同じpopupに残し、検索結果は上段の `カテゴリ・タグ`、下段の `ブックマーク` に分ける。
- 正本が正常なら派生インデックスだけを再構築する。先に元タグを削除しない。
- AI候補は既存IDの許可リストで検証し、AIの順序を捨てて中立順に並べる。不足時はローカル候補で補う。
- 候補カードには一致理由を短く示し、利用者が選んでからカテゴリ一覧またはブックマーク一覧へ移動する。
- 機能説明は現行仕様の許可された情報へ限定し、検索結果IDを説明文として扱わない。

## keyword候補またはフルページ検索が正しくない

**症状**

- 入力候補が9件以上表示される、入力に関係ない候補が残る。
- ブックマーク一覧またはカテゴリ・タグ一覧の上に検索結果が重なり、フルページへ切り替わらない。
- 候補を選んでも別のカテゴリ、タグ、Bookmarkへ移動する。

**確認**

1. 入力ごとのrequest ID、IME composing状態、応答revisionを確認する。
2. 0件、1件、8件、9件以上のfixtureで、表示件数が最大8件か確認する。
3. 候補の表示名だけでなくentity種別とIDを確認する。カテゴリ名とタグ名は同じでも別entityである。
4. 両一覧から同じフルページ検索routeへ遷移し、戻ったとき元画面のfocusとscroll位置を復元するか確認する。

**対処**

- 古い応答を破棄し、確定した最新入力に対応する候補だけを描画する。
- 検索一覧自体をpopoverとして重ねず、フルページ状態へ切り替える。入力中の最大8候補だけを検索欄に付随する候補リストとして表示する。
- 選択は表示文字列で再検索せず、候補が持つIDとentity種別で遷移する。

## 初回ホームが正しく表示されない

**症状**

- 新規インストールなのに最近追加ホームだけが表示される。
- 初回説明を完了した後も毎回初回ホームが表示される。

**確認**

1. 新しい隔離Chrome profileと既存profileを分けて再現する。
2. `runtime.onInstalled` の `reason=INSTALL` だけで初回状態を作成したか、UPDATEや通常起動のたびに上書きしていないか確認する。
3. 初回完了操作の保存成功後に通常ホームへ遷移しているか確認する。

**対処**

- 初回状態の初期化を冪等にし、既存値がある場合は上書きしない。
- UI遷移だけで完了扱いにせず、永続化成功を確認してから通常ホームを表示する。
- 日常profileのストレージを消さず、Web fixtureまたは一時profileで初回状態を再現する。

## カテゴリ・タグの作成、編集、削除が正しくない

**症状**

- タグが親カテゴリの外に表示される、または親なしで保存される。
- Bookmark編集のカテゴリ入力とタグ入力が同時に置き換わる。
- 作成modalが1件ごとに閉じる、既存項目を新規として追加できてしまう。
- 管理モードで鉛筆が表示されない、または通常モードのクリックで編集が開く。
- カテゴリ／タグ削除後に戻せない。

**確認**

1. TAGの親カテゴリIDを確認する。active TAGなら親CATEGORYもactive、tombstone TAGなら親CATEGORY recordが物理的に残っていることを確認する。
2. Bookmark編集でカテゴリ／タグが別field・別候補集合となり、各候補が最大8件か確認する。
3. 新規作成ボタンが同じmodal内のside viewを開き、元draftを保持するか確認する。作成画面は既存IDの選択／関連付けを行わず、同名競合時は既存項目を選ぶ元画面または別名入力へ案内する。
4. 全画面一覧の管理状態と、hover／focus時の鉛筆表示を確認する。
5. タグ編集modalでは親カテゴリが読取専用であることを確認する。親変更はISSUE-019の決定前に有効化しない。
6. 削除に確認画面が出ていないことと、soft-delete revision／undo情報が残ることを確認する。activeな子タグが残るカテゴリはBLOCKされ、cascade deleteされないこと、子Tag tombstoneが残る親Categoryは物理回収されないことも確認する。

**対処**

- 親カテゴリが存在しないタグの保存を拒否し、表示側だけで補正しない。
- 既存候補の選択と新規作成を別commandにし、作成画面では既存IDを追加しない。カテゴリ／タグ各namespaceの同名作成を拒否し、作成成功後もmodalは利用者が閉じるまで維持する。
- 通常モードはBookmark一覧への移動、管理モードは編集modalという操作を混ぜない。
- 削除確認画面を追加して仕様を変えず、対象名の明示、soft-delete、undo toastで誤操作に備える。子タグが残る親カテゴリでは子タグ削除または中止だけを案内し、移動や連鎖削除を出さない。

## Bookmarkの削除またはundoが正しくない

**症状**

- 削除前に確認画面が表示される、または削除直後にundoできない。
- undoしてもカテゴリ／タグ関連が戻らない。
- `UNDO_EXPIRED` と `UNDO_CONFLICT` が同じエラーとして表示される。

**確認**

1. Bookmark／Category／Tagのdeleteが物理削除ではなく `deleteOperationId`、対象revision、期限を持つsoft-deleteを作成しているか確認する。
2. undoが同じoperation IDと現在revisionを照合し、一度だけ戻せるか確認する。
3. 期限超過は `UNDO_EXPIRED`、削除後更新・同期等のrevision不一致は `UNDO_CONFLICT` か確認する。
4. Bookmark本体と関連edgeの復元を同じtransactionで行っているか確認する。
5. 削除→同名作成がtombstone予約で拒否され、その後のundoが名前競合なしで成功するか確認する。

**対処**

- 削除確認画面を追加せず、対象名の明示とundoで誤操作へ対応する。
- undo期限切れとrevision競合を別文言で示し、再送で別operationを作らない。
- undo失敗時も削除済みデータを物理回収せず、復旧可能なerrorとして表示する。

## 訪問リマインダーまたは自動アーカイブが動かない

**症状**

- 閾値を超えても通知されない。
- 「次回以降表示しない」を選んだのに再び通知される。
- あるURLで「次回以降表示しない」を選ぶと、別URLの通知まで止まる。
- 訪問回数またはarchive日数を入力しても保存されない。
- 最近使ったBookmarkがアーカイブされた、または休眠Bookmarkが残る。
- archive後にもfavicon、訪問履歴等が残る、または設定の一覧から復元できない。
- archive日数は保存されたが「権限待ち」から進まない。

**確認**

1. `frequentVisitReminderEnabled`、訪問回数の正整数入力、archive日数の正整数入力、`history` 権限を確認する。`notifications` はリマインダーだけに必要で、archive判定では要求しない。
2. `chrome.alarms.getAll()` で名前付きalarmが1件だけ存在するか確認する。
3. 対象URLの履歴 `visitCount` / `lastVisitTime` と、Bookmarkの `lastVisitedAt` / `archiveState` を比較する。
4. Reminder state、canonical URL単位の `SUPPRESSED`、`nextEligibleAt` を確認し、完全な履歴やURLを通常ログへ出さない。
5. archive documentがカテゴリ・タグ、ページ名、URLだけを保持し、設定のarchive一覧が同じIDを返すか確認する。
6. archive初回開始時にhistory権限の目的を説明したか、拒否時にarchive日数を保持したまま判定状態が `権限待ち` か確認する。

**対処**

- reminder権限拒否時は `frequentVisitReminderEnabled` を有効扱いにせず、権限を無断で再要求しない。
- archiveのhistory権限拒否時は入力済み日数を消さず、専用toggleを追加せず、判定を `権限待ち` で停止する。
- 数値入力の空、NaN、0以下、小数、範囲外は保存せず、利用者が直せるfield errorを表示する。
- alarmは起動時に冪等再登録する。sleep中に実行される正確な時刻を仮定しない。
- 通知の `保存` 前にBookmarkが作られていれば不具合として停止する。
- 「次回以降表示しない」は対象canonical URLだけを永続 `SUPPRESSED` にし、`frequentVisitReminderEnabled` や別URLを無効化しない。
- `lastVisitedAt=null` は自動archiveしない。ARCHIVEDは設定の一覧から選択して復元し、履歴削除やデータ初期化で直そうとしない。

## QR、Drive、標準Bookmark取込、右クリック保存が失敗する

**確認**

- QR生成はカテゴリ別／タグ別／個別Bookmarkの検索・checkbox選択をID集合へ正しく解決したか確認する。schemaVersion、byte数、checksum、preview結果も確認する。checksumは破損／切詰め検出だけで、真正性確認には使わない。
- QR読取はカメラ権限、decode結果、previewを確認し、不明版を無理に取り込まない。
- Driveは設定で選択した接続アカウントと利用経路を確認する。同一アカウント同期なら `appDataFolder`、別アカウント共有なら通常Drive fileのowner、permissions、capabilities、必要scopeを確認する。tokenをログへ貼らない。
- Driveの同一field更新、update対delete、add対delete、カテゴリ／タグ名前競合が自動LWWされず `syncConflicts` に残るか確認する。
- 標準Bookmark取込は `bookmarks` 権限、Import Jobのcursor、skip／failed理由を確認し、Chrome側treeの不変性を確認する。
- context menuは固定menu ID、`page` / `link` context、対象URL scheme、worker errorを確認する。

**対処**

- QR破損、不明版、容量超過は書き込まず再生成を依頼する。checksum一致を送信者本人または未改ざんの証明として案内しない。
- 同名Tagが異なるparentCategoryで競合したら既存再利用や親変更を行わず、別名／skip／cancelを選択してpreviewを再生成する。
- カテゴリ／タグ選択が重なっても同じBookmark IDを重複出力せず、読取後の確認前には保存しない。
- `appDataFolder` を別アカウントへ共有しようとせず、通常Drive file共有へ戻す。owner／permissions／capabilities不一致、認証失効は明示的な選択／再接続で直し、ローカル編集とOutboxを消さない。
- Drive競合をtimestampだけでLWWせず、`syncConflicts` の利用者解決へ回す。
- 取込は失敗分だけ再実行し、元の標準Bookmarkを削除・更新しない。
- 右クリック経路も通常のURL検証と重複判定を通し、権限やschemeを緩めて回避しない。

## popupまたはshortcutが意図した操作をしない

**症状**

- 拡張機能アイコンを押しただけで、確認なく現在ページが保存される。
- 「ホームを開く」で保存が走る、または保存shortcutでホームだけが開く。
- URL指定保存が無反応になる。

**確認**

1. popupに「このページを保存」と「ホームを開く」の2ボタンが同時に表示されるか確認する。
2. manifestの2つのcommand名とservice workerの分岐を確認する。
3. `chrome://extensions/shortcuts` で競合や未割当を確認する。
4. URL指定では入力が `http:` または `https:` か、メタデータ取得失敗前にURL本体を保持しているか確認する。

**対処**

- toolbarアイコンのクリック自体では保存せず、popup内の明示的なボタンから実行する。
- 保存とホームを別command、別message typeとして扱い、各handlerを冪等にする。
- shortcut競合時はChromeの設定画面への案内を出し、固定キーを前提にしない。
- popupは `chrome.commands.getAll()` の実割当を表示し、空文字を `未割り当て` とする。変更ボタンはアプリ内編集ではなくChrome管理画面への案内にする。
- URL指定保存では危険なschemeを拒否し、メタデータを取得できなくてもホスト名を仮タイトルとして保存する。

## 表示形式、追従ヘッダー、追加読込が正しくない

**症状**

- LIST / GRIDを変えても見た目が更新されない。
- 廃止した弁当または列数コントロールが表示される。
- 再読込後にセグメントの表示と実際のレイアウトが一致しない。
- 下端で同じページが二重に追加される、またはヘッダーが追従しない。

**考えられる原因**

- 旧 `BENTO` / 列数設定を移行せず復元している。
- observerが同じcursorを多重要求している。
- 以前のCSS classやvirtualized listのcacheが残っている。

**確認**

- 保存設定、セグメントの選択値、DOM上のレイアウト属性を同時に確認する。
- 同じ画面幅でLIST / GRIDを切り替え、弁当・列数UIがないことを確認する。
- キーボードの読み順が視覚順と一致するか確認する。
- sentinelのcursor、requestId、loading、返却ID重複を確認する。

**対処**

- 表示形式を `LIST | GRID` の単一列挙値で管理し、旧値は安全な既定値へ移行する。
- GRID列数はresponsive CSSで決め、永続設定にしない。
- 同じcursorの要求を1件へまとめ、IDでdedupeする。sticky headerには背景と正しいtop / z-indexを設定する。

## Webプレビュー、Playwright、人間確認を切り分けられない

**症状**

- `pnpm ui:preview` または `pnpm test:e2e` が存在しない。
- Webプレビューでは動くが、実拡張機能でChrome APIや永続化が失敗する。
- AIエージェントが成功と報告したが、HTML report、screenshot、trace、対象commitがない。

**確認**

1. [TESTING.md](TESTING.md) と `package.json` のscriptを比較する。
2. Webプレビューがproduction componentとfake Adapterを使い、別UIを複製していないか確認する。
3. Playwrightがbuild済み拡張を隔離profileへ読み込み、`chrome-extension://` ページを操作したか確認する。
4. AIエージェントの対象commit／buildと、人間が確認する成果物が一致するか確認する。

**対処**

- TASK-013完了前はWebプレビュー／Playwright scriptがなくても既知の未実装である。存在しない検査をpassと記録しない。
- Webプレビュー成功をpermissions、commands、Service Worker、拡張機能originの成功根拠にしない。
- reportまたはtraceがない場合はAIエージェント確認を未実施として再実行し、その後に人間受入を行う。
- screenshot基準を自動更新せず、人間が差分と理由を確認する。

## 問題報告テンプレート

[ISSUES.md](ISSUES.md) へ次を記録する。秘密、認証情報、完全な閲覧履歴は貼らない。

```markdown
### 症状

### 再現手順

### 期待結果 / 実際の結果

### 環境
- Bookmation版:
- Chrome版:
- OS:
- Prompt API availability:
- 表示形式 / 検索モード:

### 最初のエラー

### データ保護状況
- エクスポート済みか:
- ストレージ削除・再インストールを行っていないか:
```
