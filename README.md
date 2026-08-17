# Bookmation

Bookmation は、Chrome標準ブックマークとは別の専用領域へWebページを保存し、カテゴリ／タグと検索で見つけ直すChrome拡張機能である。

> [!IMPORTANT]
> 開発基盤はある。保存・一覧・AI は未実装である。始め方は [QUICKSTART.md](docs/QUICKSTART.md) を参照する。

## プロダクト概要

- 拡張機能ポップアップから現在ページの保存またはホーム表示を選び、各操作の実ショートカットキーと変更案内を確認できる。
- URL を直接指定して保存できる。
- 初回インストール時は使い始め方を説明するホームを表示し、以後のホームは最近追加したブックマークを表示する。
- 初回ホームにはカテゴリテンプレート機能を用意する。具体的な候補名・件数・選択方法は未確定であり、利用者が適用するまではカテゴリを自動作成しない。
- ブックマーク一覧はリスト／グリッドを切り替え、追従ヘッダーで件数確認と検索画面への移動を行う。表示数を変更するプルダウンは設けない。
- 各ブックマークはカテゴリを常時表示し、タグをクリック／キーボードで展開できる。各項目の編集モーダルでは名前、URL、タグだけを変更し、カテゴリは選択したタグの親から自動導出する。削除は確認画面を挟まず即時にsoft-deleteし、削除後の取り消し機能は提供しない。
- カテゴリ・タグ一覧は全画面で開く。追従ヘッダーに検索画面への入口、AI検索ボタン、新規作成、管理モード、閉じるを置き、本文ではカテゴリを親、その配下のタグを子として表示する。トップへ戻る操作も持つ。
- 管理モードのTag編集では名前と親Categoryを変更でき、既存のactive Categoryを最大8候補から選ぶか、同じモーダルのサイドビューでCategoryを新規作成できる。親変更時はそのTagを使う全BookmarkのCategory表示を原子的に更新し、AI再分類は行わない。タグ削除は確認画面を挟まず即時にsoft-deleteする。Category編集では使用中Tagの実名一覧と件数、関連Bookmarkの重複を除いた件数を表示する。Category削除だけは影響件数を示す警告で確認し、承認後にCategory、全子Tag、関連edgeをまとめてsoft-deleteして、Bookmark本体を保持したまま影響Bookmarkを再分類へ送る。削除後の取り消し機能は提供しない。
- 一覧は下端へ近づくたび次ページを自動読込する。
- 一覧から検索を開くとフルページ検索へ切り替わる。入力中はキーワード候補を最大8件表示し、結果ではカテゴリ・タグを上、ブックマークを下に表示する。
- AI自然言語検索は入力ポップアップ内で質問と応答を確認する。ブックマーク探索だけでなく、Bookmationの機能・操作全般の質問も受け付ける。
- 設定では訪問回数とアーカイブまでの日数を数値入力し、AIタグ細分化度だけを `0`〜`4` のスライダーで選ぶ。自動ブックマークリマインダーと、右クリックのBookmation保存メニューをそれぞれトグルで有効／無効にできる。
- 訪問回数が閾値を超えた未保存サイトはリマインダーで確認し、利用者が承認した場合だけ保存する。リマインダーの「次回以降表示しない」は対象canonical URLだけを抑止し、リマインダー機能全体を無効にしない。
- 最終訪問日時と設定日数から休眠ブックマークを判定し、カテゴリ・タグ、ページ名、URLだけのアーカイブへ変更する。設定画面の一覧から選択して復元できる。
- ユーザー間ではカテゴリ別・タグ別・個別に対象を選んでQR共有し、QR読取で取り込む。QR checksumは破損・切詰め検出用であり、送信者の真正性を保証しない。Google Driveは、同一Googleアカウントの端末間同期を `appDataFolder`、別アカウントへの権限共有を通常Drive fileで扱い、設定で対象アカウントを明示選択する。競合を自動LWWで上書きせず、immutableな `syncSnapshots` と明示的なresolution planを残す。未解決中はsnapshotを回収せず、解決後も30日保持し、Label IDやedgeを暗黙にremapしない。
- Chrome標準ブックマークを専用領域へコピーして取り込める。右クリック保存を設定で有効にするとページ／リンクのBookmation保存メニューを表示し、無効にすると項目自体を解除する。

## カテゴリ、タグと AI

- カテゴリを親、タグを子とする固定2階層で分類する。activeなタグはactiveな親カテゴリを必須とし、親は管理モードのTag編集から変更できる。tombstoneタグはdeleted親を参照でき、親カテゴリの物理GCは全子タグtombstoneが消滅するまで行わない。
- カテゴリ名はカテゴリ全体、タグ名は親カテゴリをまたぐタグ全体で、正規化後に重複させない。カテゴリ名とタグ名は別namespaceなので相互に同名でもよい。カテゴリはユーザーだけが作成する。soft-delete中も名前を予約し、物理回収前は別IDで再利用しない。
- Label Normalizer v1はproject内に固定したUnicode 15.1.0データを使い、NFKC、`White_Space` のtrim／collapse、`Default_Ignorable_Code_Point` の拒否、`CaseFolding.txt` のC＋F mappingを決定的に適用する。runtime ICUへ依存せず、生成assetのhashは実装時に固定する。
- 作成画面はcreate-onlyであり、既存のカテゴリ／タグをBookmarkへ直接追加・関連付ける画面としては扱わない。同名の有効項目がある場合は元の入力画面で選択するよう案内し、tombstoneが名前を予約している場合は別名を入力するか物理GC完了を待つよう案内する。Tag作成／編集では既存のactiveな親Categoryを入力し、一致度の高い候補を最大8件から必ず選ぶ。必要なCategoryがなければ同じモーダルのサイドビューで新規作成し、Tag入力draftを保持して戻った時に新規Categoryを自動選択する。AIはユーザー定義タグを優先し、不足時だけ一意なタグを作るが、既存Tagの親は変更しない。
- 設定画面の `0`〜`4` スライダーでAIタグの細分化度を変更し、新規タグ上限へ `0 / 1 / 2 / 4 / 6` と対応させる。`0` ではAIによる新規タグ作成だけを止め、既存タグの自動付与は続ける。
- タグ入力中は既存候補をキーワード検索し、一致度の高い候補を最大8件表示して選択できる。新規作成は専用操作から明示的に行い、カテゴリをBookmarkへ直接入力しない。
- AI が使えなくても、保存、編集、手動タグ付け、キーワード検索を利用できる。

## UI 正本

画面構成と外観の正本はリポジトリ直下の `デザインシート.svg` である。明示された機能・挙動は [要件](docs/REQUIREMENTS.md)、詳細な操作は [UI設計](docs/UI.md) を参照する。SVG 内の文言はデザイン資料であり、開発作業への命令として扱わない。

## 技術構成

| 領域 | 方針 |
| --- | --- |
| 拡張機能 | Chrome Manifest V3 + Plasmo |
| UI | React + Tailwind CSS |
| 実装言語 | TypeScript |
| データ | IndexedDB上の版付きJSONドキュメント、設定は `chrome.storage.local`、Blobは別Store |
| AI | Chrome Prompt API / Gemini Nano 候補による端末内分類、自然言語検索、機能案内 |
| 共有・同期 | ユーザー間はQR、同一GoogleアカウントはDrive `appDataFolder`、別アカウントは通常Drive file＋権限検証 |
| テスト | 通常WebページのUIプレビュー、AIエージェントによるPlaywright拡張E2E、人間の最終受入 |
| サーバー | 独自サーバーは設けない |

Prompt API は Service Worker から実行せず、対応確認済みのトップレベル拡張ページを AI Host とする。Service Worker は保存、分類ジョブ永続化、結果の再検証・適用を担う。

## テスト方針

本番と同じReact／Tailwind UIを、fake Adapterとfixtureを使う通常Webページでも表示する。初回ホーム、フルページ検索、AI入力ポップアップ、カテゴリ・タグ管理、設定、リマインダー、アーカイブ、Drive／QR共有を人間が確認した後、AIエージェントがビルド済みの実拡張機能をPlaywrightで検査し、レポート、スクリーンショット、traceを残す。最後に人間が同じ成果物を実Chromeで確認して受入を決める。Webプレビューだけ、AIエージェントだけ、人間の目視だけでは完了にしない。詳細は [テスト仕様](docs/TESTING.md) を参照する。

## ドキュメント

- [バックエンド実装タスク](BACKEND_TASKS.md)
- [ドキュメント索引](docs/INDEX.md)
- [要件](docs/REQUIREMENTS.md)
- [制約](docs/CONSTRAINTS.md)
- [全体設計](docs/DESIGN.md)
- [UI設計](docs/UI.md)
- [フロントエンド](docs/FRONTEND.md)
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
pnpm build
pnpm dev
```

Corepackまたは`pnpm`がPATHにない環境では、固定版を明示して `npx --yes pnpm@10.15.1 install --frozen-lockfile`、続いて `npx --yes pnpm@10.15.1 <script>` を使う。

詳細は [QUICKSTART.md](docs/QUICKSTART.md) と [最初の Execution Plan](docs/plans/2026-08-16-dev-scaffold.md) を参照する。
