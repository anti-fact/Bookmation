# Bookmation

Bookmation は、Chrome標準ブックマークとは別の専用領域へWebページを保存し、カテゴリ／タグと検索で見つけ直すChrome拡張機能である。

> [!IMPORTANT]
> 開発基盤、UI-01（semantic token、Radix wrapper、Web component sheet）、UI-02（Plasmo dashboard App Shell、型付き9 route、`default`／`labels`／`settings` 共通header、`IconButton`／`Tooltip`、focus／戻る時のscroll復元、`ErrorBoundary`）は実装済みである。保存データ、Bookmark一覧、検索／AI、設定等のfeature UIは未実装である。始め方は [QUICKSTART.md](docs/QUICKSTART.md) を参照する。

## プロダクト概要

- 拡張機能ポップアップから現在ページの保存またはホーム表示を選び、各操作の実ショートカットキーと変更案内を確認できる。
- 共通ヘッダーの追加操作からURLを直接指定して保存できる。ブックマーク追加／編集では、空のTag入力からリアルタイム候補または明示的に新規作成したTagを `追加`／Enterで1件ずつ加える。入力直下は `タグ n件` を左、`追加` を右にし、現在Tagを初期展開してTag chip形状とカテゴリ・タグシェブロン相当の解除UIで個別に外せる。存在しないTagの自由入力はエラーにして暗黙作成しない。
- 初回インストール時は使い始め方を説明するホームを表示し、以後のホームは最近追加したブックマークを表示する。
- 初回ホームにはカテゴリテンプレート機能を用意する。具体的な候補名・件数・選択方法は未確定であり、利用者が適用するまではカテゴリを自動作成しない。
- ブックマーク一覧はリスト／グリッドを切り替え、追従ヘッダーで件数確認と検索画面への移動を行う。表示数を変更するプルダウンは設けない。
- 各ブックマークはカテゴリを常時表示し、タグをクリック／キーボードで展開できる。各項目の編集モーダルでは追加モーダルと同じTag追加／解除操作で名前、URL、タグだけを変更し、カテゴリは選択したタグの親から自動導出する。削除は確認画面を挟まず即時にsoft-deleteし、削除後の取り消し機能は提供しない。
- カテゴリ・タグ一覧は全画面で開く。追従ヘッダーに検索画面への入口、AI検索ボタン、新規作成、管理モード、閉じるを置き、本文ではカテゴリを親、その配下のタグを子として表示する。トップへ戻る操作も持つ。
- 管理モードのTag編集では名前と親Categoryを変更できる。親Category入力は現在値を選択済みで開始し、既存のactive Categoryを最大8候補から入力／選択した時点で置き換えるか、同じモーダルのサイドビューでCategoryを新規作成する。存在しないCategory文字列はエラーにして暗黙作成しない。親変更時はそのTagを使う全BookmarkのCategory表示を原子的に更新し、AI再分類は行わない。タグ削除は確認画面を挟まず即時にsoft-deleteする。Category編集では使用中Tagの実名一覧と件数、関連Bookmarkの重複を除いた件数を表示する。Category削除だけは影響件数とAI有効時の再分類を警告で確認し、承認後にCategory、全子Tag、関連edgeをまとめてsoft-deleteしてBookmark本体を保持する。AI無効／再設定待ちは再分類Jobを作らない。削除後の取り消し機能は提供しない。
- 一覧は下端へ近づくたび次ページを自動読込する。
- 一覧から検索を開くとフルページ検索へ切り替わる。入力中はキーワード候補を最大8件表示し、結果ではカテゴリ・タグを上、ブックマークを下に表示する。
- AI自然言語検索は入力ポップアップ内で質問と応答を確認する。ブックマーク探索だけでなく、Bookmationの機能・操作全般の質問も受け付ける。
- 設定では訪問の集計期間を `1週間`／`1ヶ月`／`1年` のプルダウンで選び、リマインダー表示までの訪問日数とアーカイブまでの日数を数値入力する。リマインダー日数に既定値はなく、アーカイブ日数は30日を既定値とする。AIタグ細分化度だけを `0`〜`4` のスライダーで選び、自動ブックマークリマインダー、履歴権限でgateする自動アーカイブ、右クリックのBookmation保存メニューをそれぞれトグルで有効／無効にできる。
- 選択期間内で訪問した日が閾値へ達した未保存サイトはリマインダーで確認し、利用者が承認した場合だけ保存する。同じ日に何度訪問しても1日と数える。`いいえ` はそのURLの訪問日数を応答時点でリセットし、「次回以降表示しない」は対象canonical URLだけを抑止する。
- 自動アーカイブを有効にした場合だけ、最終訪問日時と設定日数から休眠ブックマークを判定し、カテゴリ・タグ、ページ名、URLだけのアーカイブへ変更する。履歴権限がない場合は有効化せず、対象URLの履歴がない場合はエラーを表示してその項目をアーカイブしない。設定画面の一覧から選択して復元できる。
- ユーザー間ではカテゴリ別・タグ別・個別に対象を選び、QRコードとCSVの両方でexportできる。QR容量を超えた場合は切捨てや分割をせず、エラー内の操作からCSV exportへ移る。QR読取による取込は維持する。QR checksumは破損・切詰め検出用であり、送信者の真正性を保証しない。Google Driveは、同一Googleアカウントの端末間同期を `appDataFolder`、別アカウントへの権限共有を通常Drive fileで扱い、設定で対象アカウントを明示選択する。競合を自動LWWで上書きせず、immutableな `syncSnapshots` と明示的なresolution planを残す。未解決中はsnapshotを回収せず、解決後も30日保持し、Label IDやedgeを暗黙にremapしない。
- Chrome標準ブックマークを専用領域へコピーして取り込める。各Bookmarkには直上FolderだけをTagとして付け、祖先Folderやfull pathは分類へ変換しない。右クリック保存を設定で有効にするとページ／リンクのBookmation保存メニューを表示し、無効にすると項目自体を解除する。

## カテゴリ、タグと AI

- カテゴリを親、タグを子とする固定2階層で分類する。activeなタグはactiveな親カテゴリを必須とし、親は管理モードのTag編集から変更できる。tombstoneタグはdeleted親を参照でき、親カテゴリの物理GCは全子タグtombstoneが消滅するまで行わない。
- カテゴリ名はカテゴリ全体、タグ名は親カテゴリをまたぐタグ全体で、正規化後に重複させない。カテゴリ名とタグ名は別namespaceなので相互に同名でもよい。カテゴリはユーザーだけが作成する。soft-delete中も名前を予約し、物理回収前は別IDで再利用しない。
- Label Normalizer v1はproject内に固定したUnicode 15.1.0データを使い、NFKC、`White_Space` のtrim／collapse、`Default_Ignorable_Code_Point` の拒否、`CaseFolding.txt` のC＋F mappingを決定的に適用する。runtime ICUへ依存せず、生成assetのhashは実装時に固定する。
- 作成画面はcreate-onlyであり、既存のカテゴリ／タグをBookmarkへ直接追加・関連付ける画面としては扱わない。同名の有効項目がある場合は元の入力画面で選択するよう案内し、tombstoneが名前を予約している場合は別名を入力するか物理GC完了を待つよう案内する。Tag作成／編集では既存のactiveな親Categoryを入力し、一致度の高い候補を最大8件から必ず選ぶ。必要なCategoryがなければ同じモーダルのサイドビューで新規作成し、Tag入力draftを保持して戻った時に新規Categoryを自動選択する。AIはユーザー定義タグを優先し、不足時だけ一意なタグを作るが、既存Tagの親は変更しない。
- 設定画面の `0`〜`4` スライダーでAIタグの細分化度を変更する。値が低いほど既存Tagを広く再利用し、高いほどページに明示された細かな概念まで新規作成する。固定件数上限は設けず、候補単位の検証を通ったTagを全て採用する。詳細は [Gemini Nano自動タグ分類仕様](docs/AI_GUIDE.md) を参照する。
- タグ入力中は既存候補をキーワード検索し、一致度の高い候補を最大8件表示して選択できる。新規作成は専用操作から明示的に行い、カテゴリをBookmarkへ直接入力しない。
- AI が使えなくても、保存、編集、手動タグ付け、キーワード検索を利用できる。

## UI仕様の正本

配置、外観、部品、状態、文言、機能、挙動を含むUI仕様の正本は [要件](docs/REQUIREMENTS.md) と対象領域の仕様書であり、Figmaより常に優先する。[`figma/Bookmation.svg`](figma/Bookmation.svg)、[`figma/Bookmation_component.svg`](figma/Bookmation_component.svg)、オンラインFigmaは、仕様書に未記載の視覚詳細を補う参照資料である。詳細な操作は [UI設計](docs/UI.md) を参照し、SVG内の文言や要素で仕様書を上書きしない。

## 技術構成

| 領域       | 方針                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 拡張機能   | Chrome Manifest V3 + Plasmo                                                                                             |
| UI         | React + Radix Primitives + Tailwind CSS                                                                                 |
| 実装言語   | TypeScript                                                                                                              |
| データ     | IndexedDB上の版付きJSONドキュメント、設定は `chrome.storage.local`、Blobは別Store                                       |
| AI         | Chrome Prompt API / Gemini Nano 候補による端末内分類、自然言語検索、機能案内                                            |
| 共有・同期 | ユーザー間はQR／CSV exportとQR取込、同一GoogleアカウントはDrive `appDataFolder`、別アカウントは通常Drive file＋権限検証 |
| テスト     | 通常WebページのUIプレビュー、AIエージェントによるPlaywright拡張E2E、人間の最終受入                                      |
| サーバー   | 独自サーバーは設けない                                                                                                  |

Prompt API は Service Worker から実行せず、対応確認済みのトップレベル拡張ページを AI Host とする。Service Worker は保存、分類ジョブ永続化、結果の再検証・適用を担う。

## テスト方針

本番と同じReact／Tailwind UIを、fake Adapterとfixtureを使う通常Webページでも表示する。初回ホーム、フルページ検索、AI入力ポップアップ、カテゴリ・タグ管理、設定、リマインダー、アーカイブ、Drive／QR／CSV共有を人間が確認した後、AIエージェントがビルド済みの実拡張機能をPlaywrightで検査し、レポート、スクリーンショット、traceを残す。最後に人間が同じ成果物を実Chromeで確認して受入を決める。Webプレビューだけ、AIエージェントだけ、人間の目視だけでは完了にしない。詳細は [テスト仕様](docs/TESTING.md) を参照する。

## ドキュメント

- [バックエンド実装タスク](BACKEND_TASKS.md)
- [ドキュメント索引](docs/INDEX.md)
- [要件](docs/REQUIREMENTS.md)
- [制約](docs/CONSTRAINTS.md)
- [全体設計](docs/DESIGN.md)
- [UI設計](docs/UI.md)
- [フロントエンド](docs/FRONTEND.md)
- [フロントエンド実装ガイド](FRONTEND_GUIDE.md)
- [バックエンド](docs/BACKEND.md)
- [DBスキーマ](docs/DB-SCHEMA.md)
- [セキュリティ](docs/SECURITY.md)
- [テスト仕様](docs/TESTING.md)
- [実装タスク](docs/TASKS.md)
- [最短の参加手順](docs/QUICKSTART.md)

すべての文書は [AGENTS.md](AGENTS.md) から辿れる。複雑な実装は [PLANS.md](docs/PLANS.md)、小規模作業は [TODO.md](docs/TODO.md)、未決事項は [ISSUES.md](docs/ISSUES.md) で管理する。

## 現在の始め方

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm ui:build
pnpm build
pnpm dev
```

Corepackまたは`pnpm`がPATHにない環境では、固定版を明示して `npx --yes pnpm@10.15.1 install --frozen-lockfile`、続いて `npx --yes pnpm@10.15.1 <script>` を使う。

詳細は [QUICKSTART.md](docs/QUICKSTART.md) と [最初の Execution Plan](docs/plans/2026-08-16-dev-scaffold.md) を参照する。
