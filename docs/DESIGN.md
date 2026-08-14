# Bookmation 設計方針

## 文書の位置づけ

- 状態: **設計確定・実装前**
- 対象: Chrome 拡張機能として開発する Bookmation の全体設計
- 更新日: 2026-08-14
- 関連: [要件](./REQUIREMENTS.md) / [制約](./CONSTRAINTS.md) / [フロントエンド](./FRONTEND.md) / [バックエンド](./BACKEND.md) / [DBスキーマ](./db-schema.md) / [UI設計](./UI.md) / [セキュリティ](./SECURITY.md)

現時点のリポジトリには実装がない。本書は最新の確定要件を実装可能な境界へ落とした設計であり、コード、Chrome 実機、Gemini Nano の動作確認が完了したことを意味しない。

## 根拠ラベル

| ラベル | 意味 | 優先度 |
| --- | --- | --- |
| 確定要件 | 2026-08-14 にユーザーが直接指定した最新要件 | 1 |
| PDF確定 p.8 | 添付PDFの「確定事項」p.8 | 2 |
| PDF暫定 p.5 | 添付PDFの「仮案」p.5 | 3 |
| 設計判断 | 要件を実装可能な形にするための提案 | 4 |
| 未実装 | コードまたは実機検証がまだ存在しない状態 | - |

競合時は、より新しく具体的な確定要件を優先する。PDF の原文は [合同ハッカソン資料](../合同ハッカソン%20-%20Google%20ドキュメント.pdf) を参照する。

## プロダクトの目的

Bookmation は、Chrome 標準ブックマークとは別に Web ページを保存し、利用者が管理するメインタグと、AI が補助できるサブタグによって、増えた項目を後から見つけ直せる Chrome 拡張機能である。

### 確定している体験

- Plasmo（React ベース）と Tailwind CSS で Chrome 拡張機能 UI を実装する。
- 拡張機能アイコンから `このページをブックマーク` と `Bookmation ホームを開く` の2操作を選べる。
- 現在ページ保存とホーム表示を別々のショートカットで実行できる。
- URL を直接指定して Bookmark を追加できる。
- ホームは最近追加した Bookmark の一覧である。
- メインタグとサブタグを分け、どちらも複数 Bookmark で再利用でき、1件の Bookmark に複数付与できる。
- メインタグは利用者だけが新規作成できる。AI は既存メインタグを候補として選べるが作成できない。
- AI は既存の利用者定義サブタグを優先し、適切な候補がない場合だけ新規サブタグを作成できる。
- AI が新規作成するサブタグの細かさをスライダーで変更できる。
- タグ一覧は画面に追従する右サイドメニューへ表示する。
- タグ選択後は、そのタグを持つ Bookmark 一覧へ移動できる。
- 自然言語によるタグ検索と Bookmark 検索を分け、どちらも候補を複数提示する。
- 一覧はリスト、グリッド、弁当の3形式を切り替えられる。グリッドと弁当では1行の表示数を選べる。
- 各 Bookmark に付いた全メインタグと全サブタグを展開表示できる。
- PDF確定 p.8 の Gemini Nano 分類、Chrome 拡張、保存ショートカットまたはボタン、カード UI、追加読込を引き継ぐ。

## 用語と不変条件

| 用語 | 定義 |
| --- | --- |
| Bookmark | Bookmation の IndexedDB に保存する拡張機能専用レコード。Chrome 標準ブックマークとは別物 |
| メインタグ | 利用者だけが新規作成できる中心テーマ。Bookmark に0件以上付与できる |
| サブタグ | 補足的な特徴。利用者または制約付き AI が作成でき、Bookmark に0件以上付与できる |
| メインタグ未設定 | 既存メインタグが割り当てられていない Bookmark の状態。保存失敗ではない |
| AI 作成サブタグ | AI が新規作成したサブタグ。生成元を保持し、UI で識別・修正できる |
| タグの重なり | Bookmark と Tag が many-to-many で関連し、1件へ複数タグを付け、1タグを複数件で再利用できること |

メインタグとサブタグは2種類のタグであり、厳密な親子ツリーにはしない。関連と選択は表示名ではなく ID で扱う。同じ表示名の別 ID を黙って統合せず、UI では種類、関連件数、補足文脈で区別する。

## MVP の範囲

### MVP に含める

- Manifest V3 の Chrome 拡張機能
- Plasmo + React + Tailwind CSS の UI
- 拡張機能ポップアップの2操作
- 現在ページ保存とホーム表示の2 commands
- URL、タイトル、ファビコン、取得可能なサムネイル、保存日時の保持
- 現在ページと URL 指定の保存
- 最近追加した Bookmark を初期表示するホーム
- 利用者によるメインタグ・サブタグ管理と many-to-many 関連
- 既存メインタグ候補の選択と、利用者定義サブタグを優先するローカル AI 分類
- AI 新規サブタグ細分化度の設定
- 自然言語によるタグ候補検索と Bookmark 候補検索
- 右サイドタグメニュー、タグ別一覧、3表示、グリッド・弁当の列数選択
- 全タグの展開、手動編集、再分類、AI 操作の取り消し
- IndexedDB へのドメインデータ保存
- `chrome.storage.local` への表示設定・AI設定保存
- 履歴権限を使わない手動アーカイブと復元

### MVP から外す

- PDF確定 p.8 の追加機能である訪問回数からの保存候補、最終訪問日時に基づく自動アーカイブ候補
- PDF確定 p.8 の QR 共有、Google Drive 同期
- PDF暫定 p.5 の外部サービスからの取り込み、CSV 入出力、共有用自然言語整形
- Chrome 以外のブラウザや外部 AI API
- ユーザーアカウント、サーバー、課金、チーム共同編集

将来機能は境界だけを用意し、未実装のボタンや設定を MVP の UI に表示しない。

## 採用アーキテクチャ

| 領域 | 採用または提案 | 状態 |
| --- | --- | --- |
| 拡張基盤 | Chrome Manifest V3 + Plasmo | Plasmo は確定要件、Chrome 実機は未検証 |
| UI | React + Tailwind CSS | 確定要件、未実装 |
| 実装言語 | TypeScript | 設計判断 |
| ドメイン保存 | IndexedDB | 設計判断、未実装 |
| 設定保存 | `chrome.storage.local` | 設計判断、未実装 |
| AI | Chrome Prompt API / Gemini Nano を Provider 経由で利用 | PDF確定を具体化、利用条件の実機検証前 |
| リモートバックエンド | MVP では設けない | 設計判断 |
| 将来同期 | Google Drive appDataFolder | 将来候補、詳細未決定 |
| 将来共有 | 選択した Bookmark の QR 共有 | 将来候補、詳細未決定 |

Plasmo の Manifest 生成、Tailwind の production build、CSP、必要な Chrome バージョン、バンドルサイズは初期スパイクで確認する。採用技術の指定と、環境適合性の検証済み状態は分けて記録する。

### 論理モジュール

| モジュール | 責務 |
| --- | --- |
| Capture Popup | 現在ページ情報を示し、保存またはホーム表示を選ばせる |
| Bookmation Page | 最近追加ホーム、タグ別一覧、自然言語検索、URL追加、設定を扱う |
| Background Service Worker | 2 commands、Bookmark 永続化、タブ再利用、job 管理、検証済み結果適用を扱う。AI session は作らない |
| AI Host Document | 対応を実証したトップレベル拡張ページでモデル準備、分類、自然言語検索を行う |
| Application Services | SaveCurrentPage、SaveUrl、SuggestTags、SearchTags、SearchBookmarks などを実行する |
| Domain | Bookmark、Tag、関連、作成者制約、細分化上限の不変条件を持つ |
| AI Provider | 組み込み AI 依存を隠し、利用不可状態と文字列検索 fallback を扱える境界を提供する |
| Repositories | IndexedDB の読書きとトランザクション境界を提供する |
| Settings Adapter | `chrome.storage.local` の設定だけを扱う |
| Sync / Share Ports | 将来の Drive 同期と QR 共有の境界。MVP では未接続 |

依存方向は UI → Application → Domain とし、Chrome API、IndexedDB、AI API を外側の adapter とする。React component と Domain からブラウザ固有 API を直接呼ばない。

## 主要データフロー

### 現在ページを保存

1. 利用者が拡張機能アイコンを開き、`このページをブックマーク` を選ぶ。または保存 command を実行する。
2. Capture Popup または Background が、利用者操作で許可された現在タブの URL、タイトルなどを取得する。
3. URL を正規化し、既存 Bookmark 候補を確認する。
4. Application 層が Bookmark と PENDING 分類 job を先にローカル保存する。AI 完了を保存成功の条件にしない。
5. AI Host が利用可能になったら、既存メインタグ ID と既存サブタグを入力候補にして分類する。
6. AI はメインタグを既存 ID からだけ提案し、サブタグは利用者定義の再利用を優先して、必要時だけ細分化上限内で新規候補を返す。
7. Application / Domain 層が作成者、tag kind、候補 ID、上限を再検証して原子的に適用する。
8. UI は保存済み・分類待ち・分類中・要確認・失敗を区別する。main が0件でも Bookmark は保持する。

### URL を指定して保存

1. Bookmation Page の `URL を追加` から `http:` または `https:` URL を入力する。
2. 形式を検証し、取得できる範囲でメタデータ preview を作る。
3. 利用者確認後に Bookmark を永続化する。メタデータ取得失敗は URL 保存を妨げない。
4. 重複 URL 候補があれば、既存項目を開く、タグを追加する、別項目として保存する、を選ばせる。黙って上書きしない。
5. 保存後の分類は現在ページ保存と同じ規則を使う。

### タグから探す

1. ホームまたは一覧の右サイドメニューで main / sub tag を選ぶ。
2. tagId を route へ反映し、関連する Bookmark をカーソル方式で取得する。
3. 表示形式や列数を変えても tagId、並び順、取得済み条件を保つ。
4. Bookmark の disclosure から全 main / sub tag を確認できる。

### 利用者がタグを作る

1. 右サイドメニューまたは Bookmark 編集から、MAIN / SUB を選んで作成フォームを開く。
2. 入力名に対する既存の完全一致・類似候補を、IDを識別できる補足情報付きで先に示す。
3. 既存タグの再利用、または利用者が確認した `同名の別タグとして作成` を選ぶ。
4. 新規 Tag を保存し、必要なら対象 Bookmark との edge を同じ短い transaction で作る。MAIN の新規作成要求は利用者操作からだけ受け付ける。

### 自然言語から探す

1. 利用者が検索対象を `タグ` または `ブックマーク` から明示選択し、自然な文章を入力する。
2. Application 層が検索対象（Tag または Bookmark）、件数上限、query fingerprint を含む request を作る。
3. AI が利用可能ならローカルで複数候補 ID と短い理由を生成し、Domain / Repository が存在と可視性を再確認する。
4. 利用不可ならタグ名、タイトル、URL の文字列検索へ縮退し、その事実を UI に示す。
5. タグ候補の選択はタグ別一覧へ、Bookmark 候補の選択は Bookmation 内の詳細へ進む。最上位候補へ自動決定しない。

## AI 分類と検索の方針

- AI はメインタグを新規作成、改名、削除しない。出力の main は既存の利用者作成 tagId だけを許可する。
- main tag が0件でも Bookmark 保存を成功させ、`メインタグ未設定` として手動編集できる。
- AI はサブタグ候補を、利用者作成の既存完全一致、利用者作成の既存意味近似、既存 AI 作成、上限付き新規作成の順で評価する。
- 1件の Bookmark に main / sub tag をそれぞれ複数関連付けられる。AI の候補数と、Domain が許す関連数を同じものとして扱わない。
- 細分化スライダーは1〜5の離散値とし、1回の分類で新規作成できるサブタグ上限の初期値を0、1、2、4、6とする。
- スライダーは main tag、既存 subtag の再利用、過去 Bookmark の自動再分類へ作用させない。
- 自然言語検索はタグ検索と Bookmark 検索を分け、候補を複数返す。raw score だけでなく短い一致理由を UI 用に返す。
- Web ページ由来の文字列を命令として扱わない。AI 出力は固定 JSON schema で検証する。
- AI の提案は編集・取消可能にし、生成元と分類時刻を記録する。
- AI が利用できなくても保存、一覧、手動タグ付け、文字列検索を継続する。
- Prompt API の LanguageModel を Manifest V3 Service Worker から呼ばない。対応を実機で証明したトップレベル拡張ページを AI Host にする。
- Offscreen Document で利用できるとは仮定しない。

## 画面構造

### Capture Popup

拡張機能アイコンをクリックしたとき、現在ページを自動保存せず、保存とホーム表示の2ボタンを出す。保存不可 scheme、保存中、保存済み、既存、失敗を区別する。

### Bookmation Page

初期 route は `#/home` とし、最近追加した Bookmark を `savedAt desc` で表示する。デスクトップでは次の3領域に分ける。

- 上部: ホーム、URL追加、自然言語検索、並び替え、3表示、列数。
- 中央: 見出し、適用条件、件数、Bookmark 一覧、追加読込、空・エラー状態。
- 右: MAIN / SUB の2セクションを持つ追従タグメニュー。

右サイドメニューのタグ選択は `#/bookmarks?tag=<tagId>` に反映する。狭い画面では drawer へ変形し、選択状態を route に保持する。Chrome 標準ブックマークのフォルダ UI はどの幅でも表示しない。

### 検索結果

タグ候補にはタグ名、種類、件数、一致理由を表示する。Bookmark 候補にはタイトル、ドメイン、保存日時、タグ要約、一致理由を表示する。候補の外部 URL をカード全体の暗黙動作にせず、`元ページを開く` と明示する。

### 一覧表示

リスト、グリッド、弁当を文字付きセグメントで切り替える。グリッドと弁当だけに `自動 / 2 / 3 / 4 / 5 / 6` の列数選択を出す。弁当の大小はピン留めまたは決定的パターンで決め、AI の確信度を重要度として使わない。

各 Bookmark は閉じた状態で `タグ N件` だけを示し、`タグを表示` の展開時に付与された全 main / sub tag を種類別に表示する。main だけを常時表示する旧仕様は採用しない。

詳細は [UI設計](./UI.md) と [フロントエンド設計](./FRONTEND.md) を参照する。

## Manifest V3 とライフサイクル

Service Worker はいつでも停止され得る前提で設計する。Prompt API の LanguageModel は Web Worker から利用しない。

- 保存 command 受領直後に Bookmark と PENDING job を IndexedDB へ永続化する。
- ホーム command は既存 Bookmation タブを検索してフォーカスし、なければ `#/home` を開く。
- Service Worker は LanguageModel の可用性確認、モデル取得、session 作成、prompt 実行を行わない。
- job は状態、試行回数、入力 fingerprint、lease を持ち、再送でも二重適用しない。
- 対応を実証したトップレベル拡張ページが、モデル準備、分類、自然言語検索を担当する。
- AI Host が閉じている間は job を PENDING のまま保持する。実行中に閉じた場合は lease 期限後に再試行可能にする。
- UI は Service Worker の常駐を前提にせず、起動時に保存済み状態を読み直す。
- schedule 処理が必要になるまで `chrome.alarms` 権限は追加しない。

公式制約と確認元は [参考資料](./REFERENCES.md#chrome-拡張機能と端末内-ai) に記録する。AI Host の採用先は実機スパイク後に確定する。

## 将来の同期と共有

### Google Drive 同期

MVP の Repository 境界を保ったまま、将来 SyncAdapter を追加する。保存先は appDataFolder を候補とする。OAuth scope、Chrome Web Store 審査、offline 競合は実装前に検証する。

競合は黙って一方を消さず、共通祖先からの三者 merge を基本とする。scalar 値は更新時刻と deviceId、タグ関連は追加・削除 event を統合し、同名タグや名称競合は要確認として残す。詳細は [DBスキーマ](./db-schema.md#将来同期の競合設計) を参照する。

### QR 共有

共有対象は利用者が明示選択した Bookmark だけに限定する。version、件数、checksum を持つ形式を定め、取込前に preview する。容量超過時の分割、CSV、暗号化方式は未決定である。

## 設計原則

1. ローカルファースト: MVP では Bookmark 内容と検索文を外部サーバーへ送らない。
2. 保存優先: AI 分類やメタデータ取得に失敗しても、有効な URL の Bookmark を失わない。
3. 利用者定義優先: main tag は利用者だけが作成し、AI は利用者定義 subtag を再利用してから新規作成する。
4. 複数候補から選択: 自然言語検索と AI 分類で単一候補を自動確定しない。
5. タグの重なりを保持: many-to-many 関連と別 ID を表示名だけで潰さない。
6. 最小権限: 機能を実装する時点まで Chrome 権限を追加しない。
7. 可逆性: AI 分類、AI subtag 作成、archive、削除は取消または復旧手段を持つ。
8. 境界の明確化: Domain を React、Chrome API、AI API、同期先から分離する。
9. 段階的拡張: 共有、同期、履歴分析は MVP 完成後に追加する。

## 設計判断記録

| ID | 判断 | 根拠 | 再検討条件 |
| --- | --- | --- | --- |
| ADR-001 | Chrome 標準ブックマークではなく IndexedDB へ保存する | 確定要件、権限とモデルを単純化 | Chrome 標準ブックマークとの双方向同期が必須になったとき |
| ADR-002 | MVP にリモートバックエンドを置かない | Gemini Nano、local-first、短期開発 | チーム共有または cross-browser が MVP 要件になったとき |
| ADR-003 | MAIN / SUB の2種類を many-to-many tag として扱い、厳密な親子 tree にしない | 最新要件の重なりを損なわない | 明示的な親子階層が改めて要件化されたとき |
| ADR-004 | AI を Provider interface の後ろに置く | Prompt API の変更・利用不可に備える | なし。実装方式が変わっても境界を維持する |
| ADR-005 | Domain データを IndexedDB、設定だけを `chrome.storage.local` へ置く | 件数、索引、transaction が必要 | 実測で別方式が明確に優れるとき |
| ADR-006 | Plasmo + React + Tailwind CSS を採用する | 最新の確定要件 | Chrome 配布要件を満たせず、利用者と再合意したとき |
| ADR-007 | 拡張機能ページを最近追加ホームとし、hash route で探索状態を表す | ホーム要件と拡張ページ内 navigation | route に機密情報を置く必要が生じたとき |
| ADR-008 | 自然言語検索をタグと Bookmark に分け、複数候補から選ばせる | 誤選択を防ぎ、要求された候補性を保つ | user test で統合検索の方が明確と確認されたとき |

## 実装前に検証する事項

- Plasmo で popup、tab page、2 commands、Tailwind production build が Manifest V3 / CSP 下で動くか。
- Dashboard 相当のトップレベルページを AI Host にできるか。対象 Chrome、ユーザー操作を伴うモデル取得、日本語、構造化出力も確認する。
- `activeTab` だけで必要なタイトル、URL、ファビコン、サムネイルを取得できる範囲。
- URL 指定時に安全に取得できるメタデータ範囲と、取得不能時の代替。
- 自然言語のタグ検索と Bookmark 検索で、日本語の候補品質、複数候補数、理由表示が実用になるか。
- AI 細分化スライダーのラベルと0、1、2、4、6件の上限が期待と一致するか。
- 同名別 ID のタグを利用者が識別できる補足文脈。
- 弁当表示の大小規則、基準列数、DOM 順、可変高の性能。
- 一意 URL の正規化と、重複 URL を別項目として保存するときの扱い。
- QR に含める上限、暗号化の必要性、Drive 同期の競合 UX。
