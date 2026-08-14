# トラブルシューティング

## 最初に確認すること

2026-08-14時点では実行可能なBookmationアプリはまだない。`package.json` やビルド出力が見つからない場合、それは環境故障ではなく未bootstrapの可能性が高い。[QUICKSTART.md](QUICKSTART.md) で現在の状態を確認する。

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
| サブタグが増えすぎる / 同名タグを見分けられない | [分類](#サブタグが増えすぎるまたは同名タグを見分けられない) |
| 自然言語検索の候補がない / 1件に固定される | [検索候補](#自然言語検索の候補が正しく出ない) |
| popupやshortcutが意図した操作をしない | [保存導線](#popupまたはshortcutが意図した操作をしない) |

## `package.json` がない / 起動コマンドが分からない

**症状**

- `pnpm dev`、`npm run dev` 等が `package.json` 不在で失敗する。
- Chromeへ読み込むディレクトリがない。

**考えられる原因**

- リポジトリは文書作成段階で、拡張機能がまだbootstrapされていない。
- 別branchや別worktreeに実装がある。

**確認**

```bash
pwd
git status --short --branch
find . -maxdepth 2 -name package.json -o -name manifest.json
```

**対処**

- 現在のbranchとリポジトリを確認する。
- 実装がない場合、推測で依存関係や生成物を追加せず、[PLANS.md](PLANS.md) に沿う初期実装Planを作る。
- 実装追加後、[QUICKSTART.md](QUICKSTART.md) を実際のコマンドへ更新する。

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

## サブタグが増えすぎる、または同名タグを見分けられない

**症状**

- 同義のタグ、表記違い、小さすぎるサブタグが想定以上にできる。
- 利用者が作ったタグとは別にAIタグが作られる。
- 同名タグが複数あり、どれを選ぶべきか判別できない。

**考えられる原因**

- 細分化スライダーの値がプロンプトや上限へ反映されていない。
- AIが既存のユーザー定義サブタグより新規作成を先に評価している。
- UIがタグID、メイン／サブ、作成者、利用件数を区別せず、表示名だけを出している。
- AI出力を検証せずそのまま保存している。

**確認**

- 問題のタグについて、タグID、表示名、正規化キー、メイン／サブ、利用者／AIの由来、利用件数、作成時の細分化設定を確認する。
- 同じfixtureを同じ設定で再分類し、差分を見る。
- 利用者定義候補をAIへ渡しているか確認する。
- 同じブックマークに同じタグIDの関連が2件以上ないか確認する。同名でもIDが異なるタグは要件上許可される。

**対処**

- 利用者定義の一致候補を最優先する。
- 新規サブタグ数、文字数、禁止値を決定的な後処理で検証し、細分化スライダーの上限を超えた候補を拒否する。
- メインタグは利用者だけが新規作成できる。AIが返した未知のメインタグ名やIDは保存しない。
- 同名タグは自動統合・自動削除せず、役割、作成者、利用件数を添えて利用者に提示する。
- 完全に同じ `bookmarkId` と `tagId` の二重関連だけを除去する。

## 自然言語検索の候補が正しく出ない

**症状**

- 自然文でタグを探しても候補が出ない、または常に1件しか出ない。
- タグ検索を選んだのにブックマーク候補が出る、または逆になる。
- AIが利用できないと検索自体が止まる。

**考えられる原因**

- UIの検索モードとqueryの `target` が同期していない。
- 取得件数が1に固定されている、または候補スコアの閾値が高すぎる。
- タグやブックマーク更新後に派生インデックスが更新されていない。
- AIの返した未知IDを除外した後のfallback候補がない。
- 文字列・正規化検索をAI利用不可時に実行していない。

**確認**

1. 同じ自然文を「タグ」と「ブックマーク」の両モードで一回ずつ実行し、候補型が分かれるか確認する。
2. 候補上限、閾値、返却ID配列を確認する。検索結果は1件に確定せず複数候補を返せる契約とする。
3. 対象bookmark、tag、関連が正本ストアにあるか確認する。
4. AIを無効にし、表示名・タイトル・URL・関連タグによるローカルfallbackが動くか確認する。
5. インデックス版と最終更新時刻を確認する。

**対処**

- 検索欄の近くに「タグ／ブックマーク」の現在モードを表示する。
- 正本が正常なら派生インデックスだけを再構築する。先に元タグを削除しない。
- AI候補は既存IDの許可リストで検証し、除外後に候補が不足したらローカル順位の候補で補う。
- 候補カードには一致理由を短く示し、利用者が選んでからタグ一覧またはブックマーク一覧へ移動する。

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
- URL指定保存では危険なschemeを拒否し、メタデータを取得できなくてもホスト名を仮タイトルとして保存する。

## 表示形式または列数が反映されない

**症状**

- リスト表示で列数変更が出る。
- グリッドから弁当へ変えても見た目が更新されない。
- 再読込後にセグメントの表示と実際のレイアウトが一致しない。

**考えられる原因**

- 表示形式と列数を別々の状態源から復元している。
- レスポンシブ上限で指定列数を表示できないが、UIが説明していない。
- 以前のCSS classやvirtualized listのcacheが残っている。

**確認**

- 保存設定、セグメントの選択値、DOM上のレイアウト属性を同時に確認する。
- 同じ画面幅でリスト、グリッド、弁当を順に切り替える。
- キーボードの読み順が視覚順と一致するか確認する。

**対処**

- 表示形式を単一の列挙値で管理する。
- 列数コントロールはグリッド・弁当時だけ有効にする。
- 画面幅で列数を下げる場合、実効列数をUIへ示す。

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
