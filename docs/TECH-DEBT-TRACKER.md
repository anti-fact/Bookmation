# 技術的負債トラッカー

## 目的

期限や検証不足のために採用した暫定策と、その解消条件を追跡する。単なる未実装機能は [TODO.md](TODO.md)、利用者に影響する不具合・未解決問題は [ISSUES.md](ISSUES.md) に置く。複数領域をまたぐ解消作業は [PLANS.md](PLANS.md) に沿ってExecution Planを作る。

現時点ではPlasmoの開発基盤、確認用popup、Vitestだけがあり、プロダクト機能、UI Webプレビュー、Playwright E2E、CIは未実装である。下表の「暫定選択」は、実装済み部分と未実装部分を区別して扱う。

## 優先度と状態

- `P0`: MVPのデータ安全性または成立性を妨げる。
- `P1`: MVP後すぐに品質・保守性へ影響する。
- `P2`: 利用規模や対応範囲の拡大時に顕在化する。
- 状態は `登録`、`対応中`、`解消`、`受容` のいずれかとする。`受容` には期限または再検討条件が必要である。

## 登録済み

| ID | 優先度 | 領域 | 暫定選択・不足 | 負債となる理由 / リスク | 解消条件・方針 | 状態 |
| --- | --- | --- | --- | --- | --- | --- |
| TD-001 | P0 | 開発基盤 | 2026-08-14時点でソース、`package.json`、ロックファイル、テスト、CIがない | ビルドや動作検証ができず、文書上の設計と実装の差を検出できない | 初期実装のExecution Planを作り、Node.js・パッケージマネージャー・Plasmo構成・品質コマンドを固定する。2026-08-16 に scaffold と品質コマンドを追加。CI は TASK-011 | 対応中 |
| TD-002 | P0 | AI | Chrome Prompt API（Gemini Nano）を第一候補とするが、端末・Chrome版・モデル取得状況・呼出しコンテキストに依存する | AIが使えない端末やservice workerからの誤呼出しで、保存操作全体が失敗する恐れがある | 対応するextension documentでの呼出しをスパイクし、capability判定をアダプターへ隔離する。`available` 以外では手動分類を使えるようにし、対応範囲を [CONSTRAINTS.md](CONSTRAINTS.md) に固定する | 登録 |
| TD-003 | P0 | AI | 分類プロンプト、出力JSONスキーマ、granularity snapshot、検証・再試行規則が未実装 | 設定変更後のJobが別上限で動く、同じ入力でも過剰タグや壊れたJSONが生じ得る | `{ granularity, maxNewTags }` をdiscriminated snapshot化し、カテゴリ生成禁止、親子整合、originを問わない名前競合再評価、USER優先、親／意味不適合NEEDS_REVIEWを保証する | 登録 |
| TD-004 | P0 | 保存 | 拡張機能専用ブックマークを使う方針だが、永続ストア、容量方針、マイグレーション実装がない | 更新・容量超過・スキーマ変更時に保存失敗やデータ消失が起こり得る | [DB-SCHEMA.md](DB-SCHEMA.md) の版管理、原子的更新、エクスポート、移行テストを実装する | 登録 |
| TD-005 | P1 | 分類・削除 | Unicode 15.1.0 vendored assetに基づくLabel Normalizer v1、Tag親変更fan-out、Category自動導出、名前予約・一意性、Category cascade削除と再分類が未実装 | runtime ICU差で同名判定が変わる、Tag親変更途中の失敗／再送で参照Bookmarkの派生Category／検索文書が不整合・二重更新になる、cascade途中失敗で孤立edgeやBookmark消失が起きる恐れがある | NFKC／White_Space／Default_Ignorable_Code_Point／CaseFolding C＋F assetとhashを固定し、runtime ICU非依存にする。tombstoneを含むunique index、Tag／親expected revision、`tag-update:` requestId／mutation receipt、全参照Bookmarkの原子的Category closure・revision・検索更新、AI再分類なし、Category削除用 `category-delete:` namespace、子Tag tombstone残存中の親GC拒否を実装する。Bookmark／Tagは確認なし、Categoryは警告確認後に原子的cascade soft-deleteし、Bookmarkを保持してPENDING／NEEDS_REVIEW再分類へ送る。削除Undo経路は作らない | 登録 |
| TD-006 | P0 | 拡張機能 | Manifest V3のservice workerで処理途中の状態をメモリだけに保持する危険がある | worker停止時にAI分類や保存が中断し、右クリックmenuの登録状態が設定とずれる、または二重登録・部分保存になり得る | ジョブ状態を永続化し、各段階を冪等化する。右クリック保存は端末固有設定とのinstall／startup／storage変更時reconcile、所有IDだけの登録／解除、OFF時click拒否を実装し、停止・再起動を含むテストを追加する | 登録 |
| TD-007 | P1 | 復旧 | インポート/エクスポート、バックアップ、壊れたレコードの隔離方法が未実装 | 障害調査や更新前に利用者データを退避できない | バージョン付きJSON/CSV形式、dry-run、検証結果、部分失敗レポートを設計・実装する | 登録 |
| TD-008 | P1 | メディア | サムネイルとfaviconの取得元、キャッシュ、権限、失敗時表示が未確定 | 過剰なhost permission、追跡リクエスト、容量増大、壊れたカードにつながる | 最小権限で取得し、失敗時プレースホルダー、容量上限、削除方針を定義する | 登録 |
| TD-009 | P1 | 検索・AI | フルページkeyword検索の最大8候補、AI検索の候補集合、機能説明、派生索引再構築が未実装 | 候補漏れ、古い結果、検索と機能案内の誤ルーティング、暗黙の順位付けが起こり得る | autocompleteとAI入力ポップアップを分離し、版付き索引、検索集合／機能質問fixture、lexical fallback、応答根拠の許可された機能情報を実装する | 登録 |
| TD-010 | P1 | UI | sticky header、可変高タグ、親子一覧、管理モード、Tag編集のCategory候補／nested side view、Category使用状況、フルページ検索、無限scroll、back-to-topの大量件数性能が未検証 | draft／focus復帰、候補popup、Tag親変更の多数Bookmark fan-out、影響件数、重複取得、描画性能が破綻し得る | デザインシート準拠prototypeを測定し、Tag編集／Category side viewのdraft・focus復帰、親変更結果、Category使用状況と削除警告、cursor・observer・virtualizationの性能予算を決める | 登録 |
| TD-011 | P1 | 共有・同期 | QR checksumの限界、異親同名Tag解決、Drive競合snapshot／resolution／保持が未実装 | checksumを真正性保証と誤認する、Tagを誤parentへ再利用する、LWWや暗黙remapで更新・Label edgeを失う恐れがある | checksumを破損検出に限定し、異親同名Tagは別名／skip／cancel再previewとする。Drive競合はimmutable syncSnapshotsと明示resolution planへ隔離し、open中GC禁止、解決後30日保持、暗黙Label／edge remap禁止を実装する | 登録 |
| TD-012 | P1 | 診断 | ログに残してよい情報と、URL・タイトル等を伏せる規則が未定 | デバッグ情報から閲覧情報が漏れる恐れがある | [SECURITY.md](SECURITY.md) に沿う構造化・匿名化ログと利用者による明示的な診断出力を設計する | 登録 |
| TD-013 | P1 | UI | popupの実shortcut表示、未割当、管理画面案内、2 commands、URL保存が未検証 | 競合や未割当を見落とし、アプリ内で変更できると誤認し得る | `commands.getAll()`、管理画面案内、popup二択と各commandをE2Eテストする | 登録 |
| TD-014 | P1 | 履歴・archive | 訪問／archive正整数範囲、通知cooldown、URL抑止、archive既定日数、復元情報が未確定 | URL抑止でglobal reminderを誤停止する、誤archive・復元不能につながる | `frequentVisitReminderEnabled` とcanonical URL単位SUPPRESSEDを分離し、確認前保存禁止、最小archiveと復元をfixture化する。UIにないautoArchiveEnabledを追加しない | 登録 |
| TD-015 | P1 | インポート | 標準Bookmark Folderの対応、重複UI、途中再開が未確定 | 分類乱立、二重取込、元データ変更の危険がある | 読取専用adapter、preview、Import Job、元tree不変契約、folder対応を実装する | 登録 |
| TD-016 | P0 | DB | JSON documentのruntime schema、size limit、migration形式が未実装 | 型castだけでは破損・過大・未知版データを防げない | 全StoreのJSON Schema、read/write検証、unknown version隔離、Blob分離、round-trip testを実装する | 登録 |
| TD-017 | P0 | テスト | production UIのWeb harnessと実拡張Playwright E2Eがない | Tag編集のCategory候補／side view／親変更fan-out、Category使用状況、cascade削除／再分類、削除Undo経路の誤混入、AI snapshot、URL抑止、右クリック設定と実menuのずれ、Drive snapshot／resolutionを人間が再現しにくく、Chrome固有不具合を見逃す恐れがある | [TESTING.md](TESTING.md) とTASK-013に沿い、Tag／親expected revision、Category自動導出、side view draft、全参照Bookmarkの原子的更新／AI再分類なし、Category警告付きcascadeとPENDING／NEEDS_REVIEW再分類、Undo経路なし、右クリックON／OFF・再起動・遅延clickを含む決定的fixture、隔離profile、report／screenshot／trace、人間受入記録を実装する | 登録 |
| TD-018 | P0 | 初回導線 | 初回インストール用ホーム、通常ホーム、Category template stepの状態遷移が未実装で、catalog詳細もISSUE-022で未決 | UPDATEをINSTALLと誤認して初回説明が再表示される、template閲覧だけでCategoryがseedされる、retry／再開で重複する、または一度も初期導線を見られず利用開始に失敗し得る | ISSUE-022を決め、`runtime.onInstalled` の `reason=INSTALL` だけで永続状態を冪等初期化する。version付きlocal catalog、明示適用、通常のUSER Category作成、INSTALL／UPDATE／再訪／retry／途中再開／同名競合fixtureとヘルプ導線を実装する | 登録 |

## 更新規則

1. 暫定実装を入れる変更と同じ変更セットで負債を登録する。
2. 各項目に、曖昧な「後で直す」ではなく観察可能な解消条件を書く。
3. 解消時は行を削除せず、状態を `解消` にして、関連するPlan・PR・検証結果を解消条件欄へ追記する。
4. 月1回またはマイルストーン終了時に、優先度、再検討条件、期限切れの `受容` を見直す。
5. 新しい要件でなく既存設計の省略から生じたものだけをここへ置く。

## 関連文書

- [DESIGN.md](DESIGN.md): 設計判断と責務境界
- [BACKEND.md](BACKEND.md): 保存・AI分類・service worker
- [SECURITY.md](SECURITY.md): データ、権限、外部送信
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md): 現象からの切り分け
- [WORKLOG.md](WORKLOG.md): 実際に行った作業と検証結果
