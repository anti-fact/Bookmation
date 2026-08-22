# Bookmation フロントエンド実装ガイド

- 状態: 実装手順。UI-01 primitive／Web component sheet、UI-02 App Shell／hash route／共通header、UI-03 popup／shortcut／保存状態、UI-04 Bookmark LIST／GRIDを実装済み
- 基準日: 2026-08-22
- 対象: Radix Primitives + Plasmo 0.90.5 + React 18.3.1 + Tailwind CSS 3.4.17 + TypeScript 5.9.2
- 関連: [要件](docs/REQUIREMENTS.md) / [UI設計](docs/UI.md) / [フロントエンド設計](docs/FRONTEND.md) / [テスト仕様](docs/TESTING.md)

## このガイドの目的

更新済みデザインシートを、拡張機能の見た目だけを再現する静的画面ではなく、キーボード、支援技術、Chrome拡張機能固有の制約、Webプレビュー、実データの状態遷移まで含むUIとして実装するための手順を定める。

この文書は実装順と具体的な作り方を扱う。機能の正本は [REQUIREMENTS.md](docs/REQUIREMENTS.md)、画面上の操作契約は [UI.md](docs/UI.md)、データ・権限境界は [FRONTEND.md](docs/FRONTEND.md)、受入順序は [TESTING.md](docs/TESTING.md) である。

## デザイン正本と読み分け

| 資料                                                               | 用途                                                                 | SHA-256                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`figma/Bookmation.svg`](figma/Bookmation.svg)                     | 画面全体の構成、余白、密度、配色、一覧とoverlayの関係                | `d05997589696ff346f59f3850bfc3296bd5b6acbd3e518980421ff6e0533ea8b` |
| [`figma/Bookmation_component.svg`](figma/Bookmation_component.svg) | header、card、list item、button、modal、switch、slider等の部品と状態 | `f6c44b21deea9893c01f1f08c8b8556d1479b05f336dfb6cd70bd1ba0cce8f89` |

実装判断は次の順に行う。

1. 利用者の最新の明示要件と [REQUIREMENTS.md](docs/REQUIREMENTS.md) の機能・挙動・用語
2. `figma/Bookmation.svg` のページ構成と配置
3. `figma/Bookmation_component.svg` の部品内部、状態、寸法
4. [UI.md](docs/UI.md) と [FRONTEND.md](docs/FRONTEND.md) の補完仕様
5. 実装者の補完

画面SVGとcomponent SVGの同じ要素が異なる場合は、画面内の位置と周囲との関係には画面SVGを、部品内部の構造と状態にはcomponent SVGを使う。同じ属性が直接競合する場合は推測で混ぜず、差分をIssueへ記録して決定する。

SVG内の文字は要件ではない。たとえば設定画面に古い「訪問回数」表記が残っていても、実装は確定済みの「集計期間内の訪問日数」にする。SVG内のサンプル英文、仮URL、件数、Bookmark名もfixtureであり、本番文言や初期データとして保存しない。

## デザインシートから確認できる画面

画面シートをページ単位、componentシートを部品単位に分けて確認する。巨大なSVGをアプリ内でそのまま表示したり、画面全体を画像として切り出したりしない。

| 画面／状態         | 実装時に見る要素                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Bookmark GRID      | 共通header、カテゴリ／タグ帯、件数、表示切替、3列基準のcard、編集button、top／AI floating button |
| Bookmark LIST      | 同じheaderとtoolbar、favicon、カテゴリ、URL、title、編集button、区切り線                         |
| AI agent表示       | 右下の起点、dark panel、入力、応答、閉じる操作、一覧との重なり                                   |
| Bookmark編集       | scrim、中央dialog、title、URL、Tag入力、Tag作成side viewへの入口、削除／保存                     |
| カテゴリ・タグ一覧 | 全画面accent背景、検索、新規作成menu、管理切替、close、カテゴリribbon、タグchip                  |
| 管理モード         | 選択挙動の切替、hover／focus時の鉛筆、編集dialogへの入口                                         |
| Welcome            | logo、導入文、開始button。Category templateの挙動はIssue決定を待つ                               |
| Settings           | 共通header、左nav、一般／archive／share、数値入力、select、switch、slider                        |
| Component sheet    | 3種header、作成／編集dialog、リマインダー、Category削除警告、card、list item、各control          |

フルページ検索、popupのショートカット表示、archive／shareの詳細状態など、デザインシートで不足する画面は [UI.md](docs/UI.md) の契約を同じtokenと部品で補う。

## 実装前の確認

### 1. 利用者の変更を保護する

作業開始時に次を実行し、デザインシートの移動・更新を含む既存差分を確認する。

```bash
git status --short --branch
sha256sum figma/Bookmation.svg figma/Bookmation_component.svg
```

SVGは参照専用とし、最適化、整形、再保存を行わない。logoやiconが必要な場合は、Figmaの元componentから個別assetとして再exportし、`assets/ui/` 等へ別ファイルで置く。巨大なsheetから座標cropした画像をproduction assetにしない。

### 2. 固定済みの基盤を確認する

`package.json` と `pnpm-lock.yaml` が依存の正本である。2026-08-19時点の基盤は次のとおりである。

| 項目                   | 固定値                                           |
| ---------------------- | ------------------------------------------------ |
| package manager        | pnpm 10.15.1                                     |
| Plasmo                 | 0.90.5                                           |
| React / React DOM      | 18.3.1                                           |
| Tailwind CSS           | 3.4.17                                           |
| TypeScript             | 5.9.2                                            |
| UI behavior primitives | `radix-ui` 1.6.7 / `@radix-ui/react-icons` 1.3.2 |

Tailwind v4の設定例へ置き換えない。このrepositoryはPlasmo公式手順と既存buildに合わせてTailwind v3 + PostCSSを使う。

### 3. SVGを実装用inventoryへ分解する

最初のUI PRで、FigmaのInspect値を次の表へ転記してレビューする。SVGの色抽出だけで寸法やfontを確定しない。

| 分類       | 最低限記録する値                                                   |
| ---------- | ------------------------------------------------------------------ |
| Color      | paper、ink、accent、muted、danger、overlay、focus、border          |
| Typography | family、weight、size、line-height、letter-spacing、用途            |
| Space      | page gutter、header height、section gap、card gap、control padding |
| Radius     | button、input、card、dialog、pill                                  |
| Elevation  | header、floating control、popover、dialog                          |
| Motion     | open／close、hover、loading。`prefers-reduced-motion`時の代替      |
| Breakpoint | 1440px基準と、狭幅時の折返し／縦積み                               |

現行SVGで観察できる主要色は `#1E1E1E`、`#B9D4EA`、`#505050`、`#7A7A7A`、`#EAEAEA`、`#161616`、`#C33232` である。componentシートの `#FF383C` はinline validation、`#C33232` は破壊操作として分離しているため、UI-01では `error` と `danger` の別tokenにした。FigmaのColor Style名を取得できた時点でsemantic名を再照合する。

SVG内の文字はpath化されておりfont familyを確定できない。FigmaのText Styleを取得できるまでは、次のような日本語system sansを仮tokenにし、正式fontを断定しない。

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "Noto Sans JP",
  "Hiragino Kaku Gothic ProN",
  Meiryo,
  sans-serif;
```

外部CDN fontはManifest V3のCSP、offline動作、privacyの理由から使わない。正式fontを同梱する場合はlicenseとbundle sizeを確認し、local assetとして配布する。

## Radix Primitivesの導入

### 採用範囲

ここでいうRadix UIは、完成済みthemeを適用するRadix Themesではなく、unstyledなRadix Primitivesを指す。外観はTailwindとBookmation tokenで作り、Radixにはdialog、focus管理、keyboard操作、ARIA等のbehaviorを担当させる。

Radix公式は現在、primitiveごとのversionずれを避けるためtree-shake可能な`radix-ui` packageを推奨している。実装開始時に互換性を確認し、exact versionとlockfileを同じPRへ含める。

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm add -E radix-ui@1.6.7 @radix-ui/react-icons@1.3.2
pnpm why radix-ui @radix-ui/react-icons
pnpm lint
pnpm typecheck
pnpm test
pnpm ui:build
pnpm build
```

CorepackまたはpnpmがPATHにない場合は、repository既定の固定版を使う。

```bash
npx --yes pnpm@10.15.1 install --frozen-lockfile
npx --yes pnpm@10.15.1 add -E radix-ui@1.6.7 @radix-ui/react-icons@1.3.2
npx --yes pnpm@10.15.1 lint
npx --yes pnpm@10.15.1 typecheck
npx --yes pnpm@10.15.1 test
npx --yes pnpm@10.15.1 ui:build
npx --yes pnpm@10.15.1 build
```

Radix Iconsは検索、設定、閉じる、鉛筆など標準的な意味のiconに限る。Bookmation logo、barcode表現、AI robot等の識別性が高いassetは、デザイン正本から個別にexportしたlocal SVGを使う。近いiconで勝手に置換しない。

### primitiveとBookmation部品の対応

| Bookmation部品              | 実装基盤                                   | 注意点                                                                   |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| Bookmark／Category／Tag編集 | `Dialog`                                   | `Portal`、`Overlay`、`Title`、`Description`、focus returnをwrapperで固定 |
| Category連鎖削除警告        | `AlertDialog`                              | 警告と明示確認が必要なのはCategory削除だけ                               |
| Bookmark／Tag削除結果       | `Toast`                                    | Undo actionを置かない。失敗時はdialogを保持                              |
| 新規作成menu                | `DropdownMenu`                             | Category／Tagをmenu itemとして選ぶ                                       |
| AI agent panel              | desktopは非modal `Popover`、狭幅は`Dialog` | 同じ会話stateを使い、primitive差をfeature外へ漏らさない                  |
| 設定の期間選択              | `Select`                                   | 変更時に訪問日数draftを空へ戻す                                          |
| toggle                      | `Switch`                                   | label全体をclick可能にし、pending中は再操作を抑止                        |
| AI細分化0〜4                | `Slider`                                   | `min=0`、`max=4`、`step=1`、現在値と効果を常時表示                       |
| LIST／GRID                  | `RadioGroup`                               | 常にどちらか1つ。見た目だけsegment controlにする                         |
| 管理モード                  | `Toggle`                                   | `aria-pressed`と視覚状態を一致させる                                     |
| Tag開閉                     | `Collapsible`                              | hoverだけに依存せずclick／keyboardで開く                                 |
| archive／share選択          | `Checkbox`                                 | 全選択はindeterminateを表現する                                          |
| 補助説明                    | `Tooltip`                                  | hover専用情報にせずfocusでも開く。操作名の代替にはしない                 |
| modal内の長い一覧           | `ScrollArea`またはnative overflow          | page全体の無限scrollには使わない                                         |
| 進捗                        | `Progress`                                 | 読取可能なlabelと数値を付ける                                            |
| 検索／Tag／Category候補     | native input + APG準拠listbox              | Radixに完成済みComboboxはないため専用wrapperを実装・試験する             |

nativeの`input type="number"`、link、button、headingをRadixへ置換する必要はない。patternと意味が一致するprimitiveだけを採用する。

### wrapperの規約

featureからRadixを直接importせず、`src/ui/primitives/`の薄いwrapperへ集約する。これによりfocus、z-index、animation、class、error表現を画面ごとにばらつかせない。

```text
src/ui/primitives/
  alert-dialog.tsx
  button.tsx
  checkbox.tsx
  dialog.tsx
  dropdown-menu.tsx
  popover.tsx
  radio-group.tsx
  select.tsx
  slider.tsx
  switch.tsx
  toast.tsx
  toggle.tsx
  tooltip.tsx
```

Radixの`asChild`を受けるleaf componentは、すべてのpropsをDOMへ渡し、`React.forwardRef`でrefを転送する。

```tsx
import * as React from "react"
import { Slot } from "radix-ui"

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  tone?: "default" | "danger"
}

const toneClass = {
  default: "bg-bm-ink text-bm-paper",
  danger: "bg-bm-danger text-bm-paper"
} as const

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className = "", tone = "default", ...props }, ref) => {
    const Component = asChild ? Slot.Root : "button"

    return (
      <Component
        {...props}
        type={asChild ? undefined : (props.type ?? "button")}
        ref={ref}
        className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-medium outline-none focus-visible:ring-2 ${toneClass[tone]} ${className}`}
      />
    )
  }
)

Button.displayName = "Button"
```

`asChild`で`div`をbutton化しない。最終的にrenderされる要素がlinkなら`a`、操作なら`button`というnative semanticsを守る。

## Tailwindとdesign token

### tokenを一箇所へ集約する

現在の`src/ui/tokens.ts`と`tailwind.config.js`はscaffold用の最小値であり、`src/style.css`はbody全体をdarkにしている。最新デザインはwhite、accent、dark panelを画面の役割ごとに使うため、bodyの一律dark指定を残したまま個別画面で上書きしない。

1. `src/ui/styles/tokens.css`へsemantic CSS custom propertiesを置く。
2. `tailwind.config.js`は同じcustom propertiesを参照する。
3. TypeScriptで必要な値だけ`src/ui/tokens.ts`から参照する。
4. 旧token名は移行期間だけaliasにし、画面実装完了後に削除する。

初期inventoryは次の形にする。値はFigma Inspect確認後に確定する。

```css
:root {
  --bm-color-paper: #ffffff;
  --bm-color-ink: #1e1e1e;
  --bm-color-accent: #b9d4ea;
  --bm-color-panel: #161616;
  --bm-color-on-panel: #eaeaea;
  --bm-color-muted: #7a7a7a;
  --bm-color-control-muted: #505050;
  --bm-color-danger: #c33232;
  --bm-color-overlay: rgb(0 0 0 / 55%);

  --bm-radius-control: 0.5rem;
  --bm-radius-card: 0.90625rem;
  --bm-radius-panel: 1.5rem;

  --bm-z-sticky: 20;
  --bm-z-floating: 30;
  --bm-z-popover: 40;
  --bm-z-dialog: 50;
  --bm-z-toast: 60;
}
```

Tailwind v3では次のようにsemantic名へ接続する。

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bm: {
          paper: "var(--bm-color-paper)",
          ink: "var(--bm-color-ink)",
          accent: "var(--bm-color-accent)",
          panel: "var(--bm-color-panel)",
          muted: "var(--bm-color-muted)",
          danger: "var(--bm-color-danger)"
        }
      },
      borderRadius: {
        "bm-card": "var(--bm-radius-card)",
        "bm-panel": "var(--bm-radius-panel)"
      },
      zIndex: {
        "bm-sticky": "var(--bm-z-sticky)",
        "bm-floating": "var(--bm-z-floating)",
        "bm-popover": "var(--bm-z-popover)",
        "bm-dialog": "var(--bm-z-dialog)"
      }
    }
  },
  plugins: []
}
```

Tailwind classは静的な対応表から選ぶ。`bg-${tone}`のような文字列連結はcontent scanで生成されないため使わない。

```ts
const toneClass = {
  default: "bg-bm-ink text-bm-paper",
  danger: "bg-bm-danger text-bm-paper"
} as const
```

### responsiveの決め方

デザインシートの1440px画面は基準であり、固定canvas幅ではない。

- pageは`min-h-dvh`とnormal document scrollを使う。
- desktopのGRIDは3列を基準にし、狭幅では2列、1列へ落とす。
- 列数を利用者が変更するUIや表示件数のプルダウンは作らない。
- toolbarはstickyのまま折り返し、検索、件数、LIST／GRIDが重ならないようにする。
- modalはdesktopでdesign寸法を上限とし、狭幅では`max-h-[calc(100dvh-2rem)]`と縦scrollを持つ。
- AI panelはdesktopで右下、狭幅では画面内dialogへ切り替える。
- 200% zoomと320 CSS px相当で横scrollを発生させない。ただしデータ表等、意味上必要な局所scrollは例外とする。

GRIDの開始例は次のとおりである。

```tsx
<section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
  {bookmarks.map((bookmark) => (
    <BookmarkCard key={bookmark.id} bookmark={bookmark} />
  ))}
</section>
```

## Plasmo上の構成

### entrypoint

Plasmoのfile conventionに従い、entryは薄く保つ。

| path                 | 責務                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `src/popup.tsx`      | popup専用Appへ本番Portを注入する                                                                 |
| `src/tabs/index.tsx` | dashboard Appへ本番Portを注入する。`#/...` routeを受ける                                         |
| `src/background.ts`  | Service Worker eventとmessage handler。ReactやRadixをimportしない                                |
| `preview/main.tsx`   | ViteでrootのUI-01 component sheetと `?view=app-shell#/...` のUI-02 App Shell fixtureを切り替える |

Plasmoのtab pageは`src/tabs/*.tsx`から`chrome-extension://<id>/tabs/*.html`へbundleされる。`src/tabs/index.tsx`内でhash routeを解釈し、Welcome、Home、Search、Labels、Settingsを同じApp shellで切り替える。

### 推奨directory

```text
src/
  popup.tsx
  background.ts
  tabs/
    index.tsx
  ui/
    app/
      ExtensionApp.tsx
      AppProviders.tsx
      hash-route.ts
    pages/
      WelcomePage.tsx
      BookmarkListPage.tsx
      SearchResultsPage.tsx
      CategoryTagPage.tsx
      SettingsPage.tsx
    features/
      ai-agent/
      bookmarks/
      category-tags/
      onboarding/
      search/
      settings/
      share/
    components/
      AppHeader.tsx
      EmptyState.tsx
      ErrorState.tsx
      LoadingState.tsx
    primitives/
    styles/
      tokens.css
      globals.css
    tokens.ts
  application/
  domain/
  ports/
  adapters/
```

page componentから`chrome.*`、IndexedDB、Prompt API、Drive、cameraを直接呼ばない。`src/ports/`のquery／command interfaceを`AppProviders`で注入し、本番entryはChrome Adapter、Web previewはfake Adapterを渡す。

```ts
export type UiPorts = {
  bookmarks: BookmarkPort
  labels: LabelPort
  search: SearchPort
  settings: SettingsPort
  aiAgent: AiAgentPort
  permissions: PermissionPort
  sharing: SharingPort
}
```

### Portalとlayer

Plasmoのpopup／tab pageは通常のextension documentなので、Radix `Portal`は既定の`document.body`へmountできる。`Dialog`、`Popover`、`Tooltip`、`Toast`のz-indexは共通tokenから与える。

将来content-script UIを追加してShadow DOM内へ表示する場合は別途設計する。現時点のBookmation UIにcontent-script UIは不要であり、Shadow Root向けCSS注入やPortal containerを先回りして本番へ入れない。

Service Workerのglobal stateは永続しない。UIのloading中にworkerが停止・再起動しても、request IDとRepositoryの状態から再取得できるようにする。Prompt APIはService Workerから呼ばず、対応を確認したtop-level extension pageのAI Adapterでだけ実行する。

## 実装順序

### Phase 0: visual inventoryと状態表を確定する

1. 2つのSVGのhashを記録する。
2. 画面SVGをscreenごと、component SVGをcomponentごとに一覧化する。
3. Figma Inspectからfont、space、radius、shadowを取得する。
4. [UI.md](docs/UI.md) の画面状態と照合する。
5. SVGにない状態をfixtureとして列挙する。
6. 不一致を「挙動差」「文言差」「visual差」に分ける。

最低限必要な状態は、loading、empty、success、partial、validation error、permission denied、revision conflict、AI unavailable、offline、infinite-scroll retry、disabled、hover、focus-visible、openである。

### Phase 1: tokenとprimitiveを作る

1. `tokens.css`とTailwind semantic mappingを追加する。
2. global resetをwhite／accent／dark panelの役割別へ変更する。
3. `Button`、`IconButton`、`Field`、`Dialog`、`AlertDialog`から作る。
4. `Switch`、`Slider`、`Select`、`RadioGroup`、`Toggle`を追加する。
5. `Popover`、`Tooltip`、`Toast`を追加する。
6. component sheetだけで各stateをWeb previewに並べる。
7. keyboard、focus return、Escape、outside clickをcomponent testで固定する。

Radixはunstyledなので、Overlayをviewport全面へ広げる、Contentをpositionする、scrollを抑止する等のfunctional CSSも実装側の責任である。見た目のclassだけ付けて完了にしない。

Dialog wrapperでは最低限、次を必須にする。

```tsx
<Dialog.Root open={open} onOpenChange={onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-bm-dialog bg-[var(--bm-color-overlay)]" />
    <Dialog.Content
      aria-describedby={descriptionId}
      className="fixed left-1/2 top-1/2 z-bm-dialog max-h-[calc(100dvh-2rem)] w-[min(51rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-bm-panel bg-bm-paper"
    >
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description id={descriptionId}>{description}</Dialog.Description>
      {children}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### Phase 2: App shellと共通headerを作る

1. `AppProviders`、typed hash route、error boundaryを作る。
2. logo、検索、AI、設定を持つ共通headerを作る。
3. Labels用accent header、Settings用header variantを同じprimitiveから作る。
4. sticky位置とmain contentのscroll offsetを確認する。
5. icon-only buttonへaccessible nameとTooltipを付ける。
6. 画面遷移後のheading focus、戻る時のscroll復元を実装する。

headerを画面ごとにコピーしない。`variant="default" | "labels" | "settings"`とslotで差を表現し、検索挙動とfocus順を共有する。

UI-02ではこのphaseの基盤を実装済みである。Plasmo dashboard entryは型付きの9 routeをApp Shellへ渡し、3種の共通header、`IconButton`／`Tooltip`、route変更後のheading focus、戻る／進む時のscroll復元、`ErrorBoundary`を共有する。route本文は後続phaseを接続するためのshellであり、Bookmarkデータ、検索／AI、カテゴリ・タグ管理、設定formの完成を意味しない。

### Phase 3: popupを完成させる

popupはdashboardとは別entryだが、Button、token、error表現を共有する。

1. `chrome.commands.getAll()`をPort経由で取得する。
2. `現在ページをブックマーク`と`ホームを開く`を表示する。
3. 各操作の実キーまたは`未割り当て`を併記する。
4. `割り当てを変更`はChromeのshortcut管理画面への案内にする。
5. 保存中、重複、成功、失敗を表示し、popupを早期closeしない。
6. popupの幅、高さ、keyboard tab順、200% zoomを確認する。

キーを拡張機能内から書き換えるAPIがあると仮定しない。

UI-03ではこのphaseの画面、Chrome Port、Web fixture、component testを実装済みである。production entryは`PopupApp`へChrome adapterを注入し、画面から`chrome.*`を直接呼ばない。保存messageのApplication use caseと永続化、command経由の保存はTASK-004の範囲として残る。

### Phase 4: Bookmark一覧を作る

1. `BookmarkListPage`へ通常flowのtoolbarを置く。App Headerの下へ表示するが、画面scrollには追従させない。
2. App Headerに統合keyword検索とカテゴリ・タグ一覧へ移動する望遠鏡を置き、secondary toolbarに現在位置、Bookmark件数、LIST／GRIDの`RadioGroup`を置く。secondary toolbarへ重複する一覧buttonは置かない。
3. GRIDは`BookmarkCard`、LISTは`BookmarkRow`へ同じview modelを渡す。
4. Categoryは常時表示し、Tagは`Collapsible`で展開する。
5. 各項目に編集buttonを置く。
6. viewport下端のsentinelを`IntersectionObserver`で監視する。
7. cursorごとの多重requestを防ぎ、ID重複を除去する。
8. page追加失敗はsentinel位置で再試行できるようにする。
9. 一定量scroll後にtop buttonを表示する。

page全体をRadix `ScrollArea`へ入れない。native document scrollを使うことでsticky header、browser search、無限scroll、back-to-topを予測可能にする。

Tagはhover Tooltipだけで隠さない。pointer、touch、keyboardで同じ情報へ到達できる`Collapsible.Trigger`を必須経路にし、Tooltipは補助説明に限る。

UI-04ではこのphaseを実装済みである。`BookmarkListPage`は`BookmarkListPort`だけへ依存し、production adapterがIndexedDBのBookmark／Label edgeと`chrome.storage.local`の表示形式へ接続する。secondary toolbarはApp Headerの下へ通常flowで配置し、画面scrollには追従させない。GRID／LIST、カテゴリ／タグ条件、cursor多重要求防止、requestId照合、ID重複除去、追加失敗の再試行、終端、back-to-topをcomponent testとWeb fixtureで確認する。カテゴリ・タグ一覧はApp Headerの望遠鏡から開き、secondary toolbarの重複buttonは削除した。編集はbuttonのみとし、UI-05／UI-07／UI-08へ責務を分離する。

### Phase 5: Bookmark編集と同一dialog内side viewを作る

Bookmark編集の分類入力はTagだけであり、Categoryを直接入力させない。

```ts
type BookmarkEditDraft = {
  title: string
  url: string
  tagIds: string[]
}

type BookmarkDialogStep =
  | "EDIT_BOOKMARK"
  | "CREATE_TAG"
  | "CREATE_CATEGORY_FOR_TAG"
```

1. title、URL、Tag combobox、Tag新規作成、削除、保存を置く。
2. Tag作成へ進む時も親`Dialog.Root`を閉じず、Content内部のstepを切り替える。
3. Tag名、Bookmark draft、検索語、dirty state、戻り先focusを保持する。
4. Tag作成ではactive Categoryを最大8候補から1件選ぶ。
5. Categoryがなければ同じdialog内のCategory作成stepへ進む。
6. Category作成成功後はTag作成へ戻り、新Categoryを自動選択する。
7. Tag作成成功後はBookmark編集へ戻り、新Tagを選択済みにする。
8. 保存直前にactive Tagの親からCategory集合を導出する。
9. Bookmark削除は確認dialogを開かない。成功後に結果だけ通知し、Undoを置かない。

side viewを別のRadix Dialogとして重ねない。focus trapの二重化、Escapeの曖昧化、draft喪失を避けるため、1つのDialog内を明示的なstep state machineで切り替える。

### Phase 6: カテゴリ・タグ一覧と管理を作る

1. `#/labels`をaccent背景の全画面pageとして作る。
2. sticky headerに統合検索、AI、新規作成menu、管理toggle、closeを置く。
3. Category ribbonの下へ子Tag chipをDOM上も同じ順で置く。
4. VIEWでは選択を一覧filter遷移、MANAGEでは編集dialog起動にする。
5. 鉛筆iconはhover可能端末のhoverと、すべての端末のfocus-visibleで表示する。
6. Category／Tagの新規作成は`DropdownMenu`から同じcreate dialogを開く。
7. 成功後もdialogを開いたままfieldを初期化し、閉じるまで連続作成できるようにする。
8. 正規化後の同名はfield errorにし、自動統合しない。

Tag編集では名前と親Categoryを変更できる。親Categoryは最大8候補から選び、必要なら同じdialogのside viewでCategoryを新規作成する。submit開始時に`tag-update:<UUID>`を1回生成し、同じpayloadのretryでは同じIDを使う。

Category編集では、使用中のactive Tagの実名と件数、関連active Bookmarkのunique件数を表示する。Category削除だけは`AlertDialog`で、削除対象Category、子Tag、影響Bookmark、再分類が発生することを警告する。previewがstaleなら内容を更新して再確認を求める。削除後のUndoは実装しない。

### Phase 7: keyword検索を作る

Bookmark一覧とカテゴリ・タグ一覧の検索入口は同じ`SearchBox`を使う。

1. 入力中はカテゴリ・タグを上、Bookmarkを下にして、全種類合計最大8候補を表示する。
2. 日本語IME composition中は確定queryを送らない。
3. 150〜250msを目安にdebounceし、古いrequest IDの結果を捨てる。
4. 入力は`role="combobox"`、候補は`role="listbox"`／`role="option"`として実装する。
5. focusはinputに維持し、`aria-activedescendant`でactive候補を伝える。
6. Arrow Up／Down、Enter、Escape、Tab、pointerを試験する。
7. Enterまたは検索buttonで`#/search?q=<encoded>`へ移る。
8. 結果pageはカテゴリ・タグを上、Bookmarkを下にし、cursorとempty／errorを別々に持つ。
9. browser backで元query、route、scroll位置を復元する。

Radix `Popover`を候補の外枠に使う場合も、open時にinputからfocusを奪わないことを試験する。安定しない場合は、inputと同じrelative container内へabsolute listboxを描画する。完成済みComboboxがRadixにあると仮定しない。

### Phase 8: AI agent popupを作る

AI入口はBookmark一覧とカテゴリ・タグ一覧の両方に置き、同じfeature componentを開く。

1. desktopでは右下floating buttonから非modal panelを開く。
2. 狭幅では同じ会話stateをfull-height Dialogへ描画する。
3. 入力、送信、処理中、streaming、回答、再試行、reset、closeを同一面に置く。
4. intentを`SEARCH_LIBRARY`、`PRODUCT_HELP`、`OUT_OF_SCOPE`に分ける。
5. 検索候補はカテゴリ・タグを上、Bookmarkを下にする。
6. 候補へ順位番号やscoreを表示しない。
7. 機能説明は実装済み、未実装、権限不足、AI利用不可を区別する。
8. AI出力から削除や設定変更を自動実行しない。
9. AI利用不可時はkeyword検索と静的helpへ縮退する。
10. streaming領域は過剰に逐次読み上げず、完了単位の`aria-live`通知を設計する。

AI panelにデザイン上の英語sampleがあっても、本番placeholderとhelpは日本語の文言catalogから供給する。

### Phase 9: WelcomeとCategory templateを作る

1. `reason=INSTALL`でだけ`#/welcome`を開く。
2. logo、説明、開始buttonをscreen sheetどおり配置する。
3. 開始後は`#/home`へ遷移する。
4. update、development reload、通常起動ではwelcomeを再表示しない。
5. Category templateはcatalog表示だけでCategoryを作らない。
6. 具体的な候補、初期選択、skip、再表示はISSUE-022をDecidedにしてから実装する。

未決のtemplate UIを見た目だけ先行してproductionへ入れない。必要ならWeb previewの`experimental` fixtureへ隔離し、production buildへ含めない。

### Phase 10: Settingsを作る

Settingsはmodalではなく`#/settings/general`、`#/settings/archive`、`#/settings/share`のfull pageである。左navはURL遷移なのでRadix Tabsではなくnative `nav`とlinkを使い、現在地に`aria-current="page"`を付ける。

一般設定の実装順は次のとおりである。

1. 訪問集計期間を`1週間`／`1ヶ月`／`1年`の`Select`にする。
2. 訪問日数を既定値なしのnumber inputにする。
3. 期間未選択時は日数をdisabledにする。
4. 期間変更のたび日数draftを空にし、maxを7／30／365へ変える。
5. 自動Bookmarkリマインダーを`Switch`にする。
6. 自動archiveを既定OFFの`Switch`にし、history権限許可後だけONへcommitする。
7. archive日数を既定30、`min=1`のnumber inputにする。
8. AI細分化だけを0〜4の`Slider`にし、0でも既存Tag付与は続くと説明する。
9. 右クリック保存を既定ONの`Switch`にする。
10. 保存中はcontrolを二重送信できないようにし、成功後だけ表示値をcommitする。

archive pageは一覧、選択、復元、部分失敗、`ARCHIVE_HISTORY_NOT_FOUND`を扱う。share pageはDrive account、QR／CSV export、QR読取を扱う。QR容量超過時は部分QRを表示せず、同じ選択を保持したまま`CSVでエクスポート`へ誘導する。

### Phase 11: reminder、import、共有のdialogを作る

- Visit reminderはURL、期間内の訪問日数、はい、いいえ、`次回以降表示しない`を示す。
- `いいえ`はそのURLの訪問日数集計を応答時刻でresetする。
- Chrome標準Bookmark importは直上FolderだけをTagにし、新規Tagには親Category選択を必須にする。
- QR／CSV選択はCategory、Tag、Bookmarkの集合をIDでdedupeする。
- QR readerはcamera拒否、file fallback、不正payload、重複、import結果を別状態にする。
- Driveは同一accountのappDataと別accountの通常fileを混同しない。

これらのUIは権限requestをrender時に自動実行しない。利用者gesture内で目的を説明してからApplication use caseを呼ぶ。

## 状態管理と通信

### 正本の置き場所

| 状態                            | 正本                       |
| ------------------------------- | -------------------------- |
| Bookmark／Category／Tag         | IndexedDB Repository       |
| 設定                            | `chrome.storage.local`     |
| route／query／selected ID       | hash URL                   |
| dialog、draft、管理mode、AI会話 | React local state          |
| cursor、loading、requestId      | query state                |
| AI分類job、import、sync         | Repository／Service Worker |

React stateへ永続データの正本を複製しない。command成功後はresponseのrevisionでcacheを更新し、曖昧なtimeout時は同じrequest IDで再送または再queryする。

### UI stateをdiscriminated unionにする

booleanの組合せで`loading && error && data`の矛盾を作らない。

```ts
type QueryState<T> =
  | { status: "idle" }
  | { status: "loading"; requestId: string }
  | { status: "success"; data: T; requestId: string }
  | { status: "empty"; requestId: string }
  | { status: "error"; error: UiError; requestId: string }
```

Dialog submitも`editing`、`submitting`、`conflict`、`failed`、`completed`を区別する。validation errorとRepository conflictを同じ赤文字だけで表現しない。

### error表示

- field errorはfield直下へ置き、`aria-describedby`で関連付ける。
- page query errorは対象section内へ置き、他sectionの成功結果を消さない。
- permission拒否は設定をONに見せない。
- revision conflictではdraftを保持し、最新値の再読込または再確認を促す。
- destructive command失敗時はdialogを閉じない。
- background再起動や応答消失を単純な「不明なエラー」で隠さず、再照会可能にする。

## アクセシビリティの実装基準

Radixを導入しただけではBookmation全体のアクセシビリティは完成しない。次を画面ごとに検査する。

- すべてのDialog／AlertDialogにTitleとDescriptionを付ける。
- 開く前のtriggerへ閉じた後のfocusを戻す。
- Category削除警告ではCancelを安全な初期focusにする。
- icon-only buttonに日本語のaccessible nameを付ける。
- hover表示する鉛筆をfocus-visibleでも表示する。
- Tooltipだけに必須情報や操作を置かない。
- 検索候補はIME、矢印、Enter、Escape、screen readerで操作できるようにする。
- Sliderへ現在値と`aria-valuetext`を付け、0の意味を説明する。
- Switchの状態名と対象をlabelへ含める。
- loading、保存結果、件数変化、AI完了は適切なlive regionで通知する。
- 色だけでCategory、Tag、error、selectedを区別しない。
- 200% zoom、320 CSS px、keyboard only、`prefers-reduced-motion`を確認する。
- focus ringをSVGの見た目に合わせるために消さない。
- modalを閉じた後、消滅したDOMへfocusしない。

## Webプレビュー

[TESTING.md](docs/TESTING.md) のとおり、本番と同じReact componentを通常Webページで人間が確認できるようにする。preview専用の画面コピーを作らない。

Vite 7.3.6をrunnerに固定し、`preview/ComponentSheet.tsx`がproduction tokenとprimitiveだけを読み込む通常Webページを実装した。`pnpm ui:preview`は `127.0.0.1:4173`、`pnpm ui:build`は `build/ui-preview`を使う。root URLはUI-01 component sheetを維持し、UI-02 App Shellは `http://127.0.0.1:4173/?view=app-shell#/home`、UI-04 Bookmark一覧は `http://127.0.0.1:4173/?view=bookmarks&fixture=grid#/home` でproduction componentを表示する。Bookmark fixtureは`grid`／`list`／`empty`／`single`／`many`／`loading`／`initial-error`／`page-error`をURLで切り替えられる。

App Shell fixture自体はnavigation shellだけを対象とし、Bookmark一覧だけを別のfake `BookmarkListPort`付きfixtureとして追加した。カテゴリ・タグ管理、検索、設定等のfeature fixture catalogとPlaywright拡張E2E環境はISSUE-018／TASK-013の残作業である。

```tsx
const previewPorts = createFakeUiPorts(fixture)

root.render(
  <AppProviders ports={previewPorts} runtime="web-preview">
    <ExtensionApp initialRoute={fixture.route} />
  </AppProviders>
)
```

preview側が変更してよいのは、Adapter、fixture選択、debug panelである。production component内へ`if (preview)`を増やさない。fixture／debug UI／fake secretをPlasmo production bundleへ含めない。

最低限のfixture catalogは次のとおりである。

- Welcome、Category template未適用／適用中／競合
- Home GRID／LIST、0件／1件／多数、次page loading／失敗／終端
- Bookmark編集、Tag作成、Category side view、validation／conflict
- Labels VIEW／MANAGE、Category／Tag作成・編集、Category削除warning／stale
- keyword候補0／8／9、IME中、全画面検索の上下group
- AI idle／streaming／検索候補／help／unavailable／error
- Settings一般／archive／share、permission許可／拒否／取消
- reminder、archive履歴なし、復元部分失敗
- QR成功／容量超過からCSV、reader拒否／不正payload
- popup shortcut割当済み／未割当、保存成功／重複／失敗

## テストと受入

実装PRは次の順で検証する。

1. lint、typecheck、unit／component test
2. Webプレビューで全fixtureを確認
3. screenshot差分を人間がレビュー
4. Plasmo production build
5. AIエージェントがPlaywrightでbuild済み拡張を確認
6. 人間が同じcommitとbuildを実Chromeで最終確認

現在存在する品質commandは次である。

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm ui:build
pnpm build
```

`pnpm test:e2e` と `pnpm test:e2e:ui` のscriptはまだ存在しない。UI-02までのunit／component testとWebプレビューは実拡張Playwright E2Eの代替ではなく、人間による実Chrome受入も未完了である。

Radix wrapperのcomponent testでは最低限、次を固定する。

- Dialogのopen、Tab cycle、Escape、close、triggerへのfocus return
- AlertDialogでCancelが安全な初期操作になること
- DropdownMenu、Select、RadioGroup、Switch、Sliderのkeyboard操作
- `asChild` wrapperがpropsとrefを失わないこと
- Tooltipがfocusでも表示されること
- `prefers-reduced-motion`で重要情報を失わないこと

feature testでは最低限、次を固定する。

- 検索の0／8／9候補、IME、stale response破棄、上下group
- LIST／GRIDが空値にならず、設定を保持すること
- Tag disclosureがpointer／keyboardの両方で動くこと
- side view往復でdraftとfocusが戻ること
- Tag親変更の0／1／多数Bookmark、retry、rollback
- Category削除preview stale、再確認、成功再送の冪等性
- infinite scrollの多重要求防止、dedupe、retry、終端
- permission拒否時にtoggleがONへ見えないこと
- AI unavailableでもkeyword検索とmanual操作が使えること

visual testは同一OS、browser、font、viewport、device scale factorで行う。pixel差分だけで合格にせず、意図したデザイン変更かを人間が判断する。基準画像の更新PRには、対象screen、変更理由、旧／新画像を添付する。

## PRの分割案

巨大な「全UI実装」PRにしない。次の順なら各PRをWeb previewで独立確認できる。

1. `UI-01`: Radix導入、token、primitive、component sheet preview
2. `UI-02`: App shell、hash route、共通header、layout
3. `UI-03`: popup、shortcut、保存状態
4. `UI-04`: Bookmark GRID／LIST、一覧toolbar、無限scroll
5. `UI-05`: Bookmark編集、Tag／Category side view
6. `UI-06`: Labels VIEW／MANAGE、Category／Tag作成・編集・削除
7. `UI-07`: keyword combobox、full-page search
8. `UI-08`: AI agent popupとfallback
9. `UI-09`: WelcomeとCategory template枠
10. `UI-10`: Settings一般／archive／share
11. `UI-11`: reminder、import、QR／CSV／Drive状態
12. `UI-12`: Web preview catalog、visual baseline、extension E2E

UI-01からUI-04は実装済みである。UI-02のWebプレビューはApp Shellのroute／header／layout、UI-03のpopupプレビューは画面状態とPort境界、UI-04のBookmarkプレビューは一覧の表示・追加読込・失敗状態だけを対象とする。保存Application、Bookmark編集、検索／AI、画像Blob解決、UI-12の全fixture／E2E完了を示さない。

各PRはtokenやprimitiveを勝手に複製せず、必要な共通変更を先行PRへ戻す。画面PRで新しい色やradiusが必要になったら、Figma上の役割を確認してtoken PRとしてレビューする。

## 完了条件

UI実装は、次をすべて満たした時だけ完了とする。

- 最新の2つのSVGと対象commitのhashが記録されている。
- 最新明示要件とSVG文言の差が意図どおり解決されている。
- screen layoutとcomponent stateがそれぞれのデザイン正本に対応している。
- Radix wrapperにbehaviorを集約し、featureから無秩序に直接importしていない。
- Tailwind classとsemantic tokenにmagic color／spaceが散在していない。
- popup、tab page、Web previewが同じprimitive／feature componentを共有している。
- Chrome API、Repository、AI、Driveをpage componentから直接呼んでいない。
- keyboard、focus、screen reader用name、IME、200% zoom、狭幅を確認している。
- loading、empty、error、permission、conflict、offline、AI unavailableを確認している。
- Web preview、AIエージェントの実拡張Playwright、人間の実Chrome受入を順に終えている。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm ui:build`、`pnpm build`が成功している。
- 実施していないruntime確認を「成功」と記録していない。

## 実装時に避けること

- SVG全体を画像として貼ってUI実装の代わりにしない。
- デザインシート自体をformatterやoptimizerへ通さない。
- Radix Themesの既定外観でデザインを置き換えない。
- Radixを使っただけでaccessibleになったとみなさない。
- Dialogの中へ別Dialogを重ねてside viewを作らない。
- TooltipやhoverだけにTagや編集操作を置かない。
- page全体をcustom ScrollAreaへ閉じ込めない。
- Tailwind v4の設定例を現行v3構成へ混ぜない。
- dynamic class文字列でproduction CSSを欠落させない。
- Service WorkerでReact、Radix、Prompt API sessionを動かさない。
- UI componentから`chrome.*`やIndexedDBへ直接アクセスしない。
- preview fixtureやdebug controlを本番extension bundleへ含めない。
- Chrome権限をpage表示時に自動要求しない。
- SVG内の古い文言を最新要件より優先しない。

## 公式資料

- [Radix Primitives: Introduction](https://www.radix-ui.com/primitives/docs/overview/introduction) — unstyled primitive、incremental adoption、package導入
- [Radix Primitives: Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) — WAI-ARIA、keyboard、focus、label
- [Radix Primitives: Styling](https://www.radix-ui.com/primitives/docs/guides/styling) — functional style、`className`、`data-state`
- [Radix Primitives: Composition](https://www.radix-ui.com/primitives/docs/guides/composition) — `asChild`、props展開、ref転送
- [Plasmo Framework](https://docs.plasmo.com/framework) — entry、development、production build
- [Plasmo: Extension Pages](https://docs.plasmo.com/framework/ext-pages) — popup等のpage convention
- [Plasmo: Tab Pages](https://docs.plasmo.com/framework/tab-pages) — `tabs` entryとextension URL
- [Plasmo: Background Service Worker](https://docs.plasmo.com/framework/background-service-worker) — worker entryと非永続state
- [Plasmo: Tailwind CSS quickstart](https://docs.plasmo.com/quickstarts/with-tailwindcss) — Tailwind v3、PostCSS、extension pageへのCSS import
- [Tailwind CSS v3: PostCSS installation](https://v3.tailwindcss.com/docs/installation/using-postcss) — content path、PostCSS、Tailwind directives
- [WAI-ARIA APG: Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — 最大8件候補のkeyboard／focus設計
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — keyboard、focus、contrast、reflowの受入基準

外部資料は更新されるため、Radix依存を追加するPR、PlasmoをupgradeするPR、release前に公式資料を再確認する。
