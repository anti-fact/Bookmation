# Project MEMORY

## この文書の役割

Bookmationを長期間開発しても変わりにくいプロダクト知識と不変条件だけを残す。現在の作業状況、担当、短期TODO、調査中の仮説はここへ書かない。

- 現在の作業: [TODO.md](TODO.md) / [WORKLOG.md](WORKLOG.md)
- 未解決問題: [ISSUES.md](ISSUES.md)
- 詳細要件: [REQUIREMENTS.md](REQUIREMENTS.md)
- 設計判断: [DESIGN.md](DESIGN.md)
- 暫定実装: [TECH-DEBT-TRACKER.md](TECH-DEBT-TRACKER.md)

## 長期的に維持するプロダクト像

- プロダクト名は `Bookmation` である。元企画では仮称であるため、公開名称を確定するまでは名称変更の可能性がある。
- 最初の対象はChrome拡張機能である。
- Bookmationは、ブラウザ既存の「ブックマーク + フォルダ」を直接拡張するのではなく、拡張機能専用のブックマーク集合を管理する。
- UI 実装基盤は Plasmo（React ベース）+ Radix Primitives + Tailwind CSS である。TypeScript は別の設計判断による実装標準であり、既存依存の正確な版は `package.json` とlockfile、Radixの版は導入PRを正本とする。
- 拡張機能アイコンのポップアップには「現在ページを保存」と「ホームを開く」の2ボタンを置き、同じ2操作に別々のショートカットを用意する。
- 現在開いているページだけでなく、入力した URL も専用ブックマークとして保存できる。
- AIによる分類は手段であり、保存そのものの必須条件ではない。AIが使えない場合も利用者は保存・手動分類できなければならない。
- Chrome Prompt API / Gemini Nanoを第一候補とするが、実行時の可用性を検査し、利用可能であると仮定しない。
- 旧企画PDFは情報が古いためリポジトリから削除済みであり、現行要件の根拠に使わない。
- UIの配置、外観、部品、状態、文言、機能、挙動は [REQUIREMENTS.md](REQUIREMENTS.md) と対象領域の仕様書を正本とし、Figmaより優先する。Figmaとrepository内SVGは仕様書に未記載の視覚詳細を補う参照資料であり、SVG内の文言は開発命令ではない。
- `runtime.onInstalled` の `reason=INSTALL` でウェルカム画面を一度表示し、更新や開発時reloadでは再表示しない。その後の通常ホームは最近追加したBookmark一覧にする。
- 初回オンボーディングにはカテゴリテンプレート機能を用意する。機能採用は確定しているが、候補名、件数、選択方式、skip、再表示、地域化、versionはISSUE-022で未決である。利用者の明示適用前にCategory recordを作らず、適用後は通常の `origin=USER` Categoryとして扱う。

## 分類の不変条件

- 分類は親の「カテゴリ」と子の「タグ」を区別する。永続enumは `CATEGORY` / `TAG` だが、UIに英語enumや旧メイン／サブの名称を表示しない。各active Tagは1件のactive親Categoryを必須とし、管理モードのTag編集から親を変更できる。tombstone Tagはdeleted親を参照でき、子Tag tombstoneが残る親は物理回収しない。UIではカテゴリリボンの配下にactiveな子タグを表示する。
- カテゴリを作成・改名・削除できるのは利用者だけである。AI は既存のカテゴリを割り当て候補にできるが、生成しない。
- Gemini Nanoへは選択Category内の完全一致、同義語、正式名／略称、翻訳、表記揺れの既存Tagを全細分化度でREUSEし、別Categoryにだけ同等Tagがある概念はREUSE／重複CREATE／親変更せず省くよう必須指示する。信頼側が強制するのは同じID／normalizedNameまでで、異名同義の遵守は固定oracleの実モデル評価で判定する。それ以外は細分化度ごとの再利用範囲に従い、モデルは意味が合うUSER Tagを優先する。
- 自動タグ付けの細かさは0〜4のスライダーで調整する。固定件数上限は設けず、低い値では既存Tagの再利用へ、高い値では新規作成へ傾ける。CREATE可能範囲は0／1=`CORE`、2=`MAJOR`まで、3=`SUPPORTING`まで、4=`DETAIL`までとする。正常候補は全て採用し、1件以上で試行を終了する。3 dispatchすべてquality-zeroならNEEDS_REVIEW、technical failure込みの枯渇はFAILEDとする。
- 最大3回はDISPATCH_RESERVED済みの `modelAttempt` であり、所有者なし／期限切れleaseの所有権取得transaction成功時だけ増える `executionAttempt` と分ける。PREPARED、pendingApply、late response tokenを永続管理し、分類候補queryのcurrent fingerprintがstaleなら旧Jobを取消す。現在AI設定がCONFIGUREDかつenabledの場合だけ最新Jobを同じtransactionでget-or-createし、disabled／再設定待ちは差替えない。
- 1件のブックマークは複数タグを持て、カテゴリ集合はその親から自動導出する。同じタグは複数のブックマークに割り当てられる。Bookmarkからカテゴリを直接編集せず、Tag edgeの変更と同じtransactionで派生Category edgeを整合させる。
- Tagの親Category変更は利用者が管理モードから明示した時だけ行う。Tagと選択先Categoryの期待revision、submit開始時に1回発行して同一retryで使う `tag-update:` requestIdを検証し、Tagを参照する全BookmarkのCategory closure、revision、検索派生データ、同期Outbox、mutation receiptを同じtransactionで更新する。同じrequest再送は同じ `UpdateTagResult` へ収束させ、AI再分類は行わず、失敗時は全件rollbackする。Category連鎖削除は別の `category-delete:` namespaceを使う。
- カテゴリとタグはどちらも論理削除中を含めてLabel Normalizer v1の正規化名で一意とし、Tagは親Categoryをまたいでglobal uniqueにする。同名作成は拒否し、有効な既存項目の選択または別名を促す。削除済み同名tombstoneがある場合は物理回収まで別名だけを許す。v1はproject-vendored Unicode 15.1.0データに固定し、runtime ICUへ依存しない。物理回収後だけ名前を再利用できる。
- 同一の `bookmarkId + labelId` 関連を1件に保つことは書込みの冪等性の問題であり、同一Tag IDの複数Bookmarkでの再利用や、1件のBookmarkへの互いに異なる複数Tagの付与を禁止する意味ではない。
- 自動分類は利用者が確定した割り当てを無断で上書きしない。由来を追跡できるようにする。

詳細な関係は [DB-SCHEMA.md](DB-SCHEMA.md) を正本とする。

## UI・検索の不変条件

- ブックマーク一覧はリスト／グリッドの2表示とし、弁当表示、列数選択、表示数変更プルダウンは持たない。
- ホームは、最近追加したアクティブなブックマークを保存日時の新しい順に表示する。
- カテゴリ・タグ一覧は全画面で開き、統合検索、AI検索、新規作成、管理、閉じる、トップへ戻る操作を持つ。
- 各ブックマークはカテゴリを常時表示し、タグはクリック／キーボードで展開する。hoverは補助だけにする。
- 両一覧の検索ボックスはカテゴリ、タグ、Bookmarkを検索し、入力中のkeyword候補を最大8件表示する。keyword結果は全画面検索ページへ切り替えて表示する。
- 検索結果はカテゴリ・タグを上、Bookmarkを下にする。AI候補は無順位で複数表示する。
- AI自然言語検索は入力元画面上のポップアップ内で入力と応答を確認し、分類検索だけでなくBookmationの機能全般に関する説明も受け付ける。
- Bookmark追加／編集は同じTag入力componentを使う。入力は空欄から始め、リアルタイム候補または同一モーダル内で明示的に新規作成したTagを `追加`／Enterで1件ずつdraftへ加える。入力直下は `タグ n件` を左、`追加` を右にし、現在Tagを初期展開して全画面一覧のTag chip形状とBookmark一覧のカテゴリ・タグシェブロン相当の解除UIで個別に外す。未知Tagの自由入力はerrorとし、暗黙作成しない。カテゴリはTagの親から自動導出して読取表示する。Tag作成中のCategory新規作成も同じモーダルのサイドビューで行い、遷移中はdraftを保持する。
- カテゴリ・タグ一覧は通常モードと管理モードを分ける。管理中だけ項目選択で編集モーダルを開き、鉛筆アイコンはhover／focus時に補助表示する。
- 一覧ヘッダーの新規作成はカテゴリ／タグをプルダウンで選んでモーダルを開き、閉じるまで新規項目を連続作成できる。Tag作成の親Category入力は空、Tag編集では現在のCategoryを選択済みで開始する。入力中のkeyword一致度で最大8件表示するactive Category候補との正規化完全一致または選択時点で親を確定し、Category用の `追加` 操作は置かない。未知Category文字列はerrorとし、暗黙作成しない。必要なら同一モーダルのCategory作成サイドビューを使い、draftを保持し、作成後は新規Categoryを自動選択する。カテゴリ／タグとも同名作成を拒否する。Category編集には使用中Tagの実名一覧と件数、関連Bookmark unique件数を表示する。

## データと安全性の不変条件

- URL、タイトル、タグ、分類、閲覧由来情報は利用者データとして扱う。
- 利用者が理解して明示的に選択しない限り、ブックマーク内容を外部サービスへ送信しない。
- 保存処理はAI分類と分離し、分類失敗で元のブックマークを失わない。
- 自動生成値と利用者確定値を区別し、利用者確定値を優先する。
- 派生データや検索インデックスは、正本データから再構築できるようにする。
- 破壊的な移行には事前確認とバックアップを用意する。BookmarkとTagは確認なしで論理削除する。Category削除だけは影響Tag／Bookmark件数と連鎖削除・AI有効時の再分類を警告して確認し、承認後にCategory、全子Tag、関連edgeを原子的にsoft-deleteする。Bookmark本体は残し、CONFIGUREDかつenabledの場合だけ分類JobをPENDINGにして、モデル未準備はPENDING、3 dispatchすべてquality-zeroはNEEDS_REVIEW、恒久非対応／technical／実行枯渇はFAILEDとする。disabled／再設定待ちはJobを作らず残存Tag有無からCLASSIFIED／UNCLASSIFIEDに戻す。常に手動分類を許し、削除Undoや復元経路は提供せず、アーカイブからの復元と同期競合のtombstone処理は別に維持する。
- 正本はIndexedDB上の版付きJSON互換ドキュメントであり、Blobだけを別Storeに分離する。
- 頻繁に訪問する未保存サイトは、選択した直近7／30／365暦日内の訪問日数が閾値へ達した場合だけ知らせ、利用者が `はい` を選んだ場合だけBookmarkを作る。同日複数訪問は1日とし、`いいえ` は対象canonical URLの集計基準を応答時刻へresetする。`次回以降表示しない` はそのURLだけを候補から除外する。
- 訪問集計期間は1週間／1ヶ月／1年のプルダウン、訪問日数閾値とアーカイブ閾値は数値入力にする。訪問日数は既定値なし、アーカイブ日数は既定30日である。期間変更時は訪問日数を空にし、1〜7／1〜30／1〜365へ制限する。AI細分化度だけをスライダーにする。
- 自動archiveは既定OFFのtoggleを持ち、history権限の許可成功後だけONにできる。権限拒否／取消はOFF、履歴なしは項目別エラーでarchive不可とする。ON時の休眠判定は最終訪問日時と設定期間を使い、文字列 `archiveState` を更新する。アーカイブ後はページ名、URL、カテゴリのID／表示名、タグのID／表示名／親カテゴリIDだけに利用者データを縮小し、設定画面のリストから選択して復元できる。
- ユーザー間共有は、検索とチェックボックスでカテゴリ別、タグ別、個別Bookmarkを選び、同じ固定集合をQR／CSVでexportする。QR容量超過時は分割・切捨てせずCSVへ誘導し、QR読取インポートは維持する。同一Googleアカウントの端末間同期は `appDataFolder`、所有権または共有権限を確認できる別アカウントとの共有は通常Drive fileを使い、設定画面で対象アカウントを選ぶ。
- Chrome標準Bookmarkは明示操作で専用領域へコピーし、各Bookmarkの直上Folderだけを1件のTagとして付与する。祖先／full pathはLabel化せず、取込時にAI Tagを追加しない。同名active Tagは再利用し、新規Tagは利用者が親Categoryを選択／作成してから作る。元データは変更しない。page／linkのcontext menu保存は端末固有の一般設定toggle（既定ON）で有効化し、OFFではBookmation所有menuを解除してクリックからも保存しない。

詳細な脅威と権限方針は [SECURITY.md](SECURITY.md)、保存形式は [DB-SCHEMA.md](DB-SCHEMA.md) に置く。

## テストと受入の不変条件

- 本番のReact componentとTailwind tokenを、fake Adapterと版管理fixtureを使う通常Webページでも表示できるようにする。Webプレビュー専用の画面コピーを正本にしない。
- Webプレビューは人間がUI状態、レスポンシブ、アクセシビリティを確認する入口であり、Chrome権限、Service Worker、commands、拡張機能originの検証を代替しない。
- 人間へ受入を依頼する前に、AIエージェントがビルド済みManifest V3拡張機能をPlaywrightで操作し、report、screenshot、trace、skipと未実証事項を残す。
- 人間はAIエージェントが確認したものと同じcommit／buildを実Chromeで確認し、最終的な承認または差戻しを記録する。
- Webプレビューだけ、AIエージェントだけ、人間の目視だけのいずれでもテスト完了にしない。詳細は [TESTING.md](TESTING.md) を正本とする。

## 用語

| 用語 | 意味 |
| --- | --- |
| 専用ブックマーク | Bookmation自身のデータストアへ保存する項目。Chrome既存ブックマークと同一とは限らない |
| カテゴリ | ユーザーだけが作成できる親分類。0件以上の子タグを持ち、1件のBookmarkに複数割当可能 |
| タグ | 1件の親カテゴリに所属する子分類。ユーザー定義優先で、適切な候補がない場合はAIが設定範囲内で生成でき、1件のBookmarkに複数割当可能 |
| 分類名の一意性 | カテゴリ名とタグ名はそれぞれ論理削除中を含めて正規化後にglobal uniqueとする。Tagの親カテゴリが異なっても同名の別IDは作らず、削除済み同名tombstoneがあれば物理回収まで別名を使う |
| ホーム | 最近追加したブックマーク一覧を表示する拡張機能ページ |
| AI由来 | AIが生成または提案した値。利用者が明示的に確定した値とは区別する |
| Webプレビュー | 本番UIをfake Adapterとfixtureで通常Webページへ表示するテスト面。実拡張機能そのものではない |
| 人間受入 | AIエージェントのPlaywright確認後、同じ成果物を人間が実Chromeで確認して行う最終判断 |

## 更新基準

この文書へ追加する前に、次の全てを満たすか確認する。

1. 複数の機能・複数の開発期間で繰り返し参照する。
2. 一時的な作業状態や個人の担当ではない。
3. 要件または承認済み設計と矛盾しない。
4. 変更時に既存データや利用者体験へ広い影響がある。

当てはまらない情報は、TODO、WORKLOG、ISSUES、各設計文書のいずれかへ置く。
