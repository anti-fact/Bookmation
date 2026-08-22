/**
 * 型付きのURLルートを共通ヘッダーと画面の土台へ結び付け、
 * 画面遷移時のフォーカスとスクロール位置を管理するアプリ本体です。
 */
import * as React from "react"
import {
  ArchiveIcon,
  GearIcon,
  Share2Icon
} from "@radix-ui/react-icons"

import { AppHeader } from "~/ui/components/AppHeader"
import { AppShell } from "~/ui/components/AppShell"
import { BookmarkListPage } from "~/ui/features/bookmarks/BookmarkListPage"
import {
  emptyBookmarkListPort,
  type BookmarkListPort
} from "~/ui/features/bookmarks/bookmark-list-port"
import { Button } from "~/ui/primitives"
import { joinClassNames } from "~/ui/primitives/class-names"

import { useAppRuntime, useHashRouteStore } from "./AppProviders"
import { HomeSavePanel } from "./HomeSavePanel"
import { PromptApiTester } from "./PromptApiTester"
import {
  getHashRouteKey,
  serializeHashRoute,
  type HashRoute,
  type KnownHashRoute,
  type SettingsSection
} from "./hash-route"

// モジュール相対URLにすることで、ビルド時に画像を拡張機能へ同梱できます。
const aiTelescopeIcon = new URL("../assets/ai-telescope.svg", import.meta.url)
  .href
const bookmationLogo = new URL("../assets/bookmation-logo.svg", import.meta.url)
  .href
const manageWrenchIcon = new URL("../assets/manage-wrench.svg", import.meta.url)
  .href

type RouteCopy = {
  description: string
  eyebrow?: string
  heading: string
}

const settingsLabels: Record<SettingsSection, string> = {
  archive: "アーカイブ",
  general: "一般",
  share: "共有"
}

const settingsIcons = {
  archive: ArchiveIcon,
  general: GearIcon,
  share: Share2Icon
}

// ホバーと継続選択で同じ領域を使い、背景色だけを各レイヤーで管理します。
const settingsItemBackgroundClass =
  "pointer-events-none absolute inset-y-0 -right-2 w-screen sm:-right-4 lg:-right-6"

const welcomeDescription = [
  "Bookmationはブックマークを簡単に整理できる拡張機能です。",
  "かんたんな初期設定を終わらせて、さっそくはじめましょう。"
] as const

// ルートごとの見出しと説明を一か所へ集め、画面本体との表記ずれを防ぎます。
function getRouteCopy(route: HashRoute): RouteCopy {
  switch (route.kind) {
    case "welcome":
      return {
        description: welcomeDescription.join("\n"),
        heading: "Bookmationへようこそ"
      }
    case "home":
      return {
        description: "最近追加したブックマークを表示するホームです。",
        eyebrow: "Home",
        heading: "最近追加したブックマーク"
      }
    case "bookmarks": {
      const filterDescription =
        route.filter.kind === "category-tag"
          ? `カテゴリID「${route.filter.categoryId}」とタグID「${route.filter.tagId}」`
          : `${route.filter.kind === "category" ? "カテゴリ" : "タグ"} ID「${route.filter.id}」`
      return {
        description: `${filterDescription}で絞り込む一覧です。`,
        eyebrow: "Bookmarks",
        heading: "ブックマーク一覧"
      }
    }
    case "search":
      return {
        description: `「${route.query}」のカテゴリ・タグ結果を上、ブックマーク結果を下に表示する画面です。`,
        eyebrow: "Search",
        heading: "検索結果"
      }
    case "labels":
      return {
        description:
          "カテゴリと、そのカテゴリに属するタグを確認する全画面一覧です。",
        eyebrow: "Categories & tags",
        heading: "カテゴリ・タグ一覧"
      }
    case "settings":
      return {
        description: `${settingsLabels[route.section]}設定の画面です。`,
        eyebrow: "Settings",
        heading: `${settingsLabels[route.section]}設定`
      }
    case "not-found":
      return {
        description:
          "URLを解釈できませんでした。入力されたURLは自動で書き換えていません。",
        eyebrow: "Not found",
        heading: "ページが見つかりません"
      }
  }
}

type NavigateRoute = (
  route: KnownHashRoute,
  options?: { replace?: boolean }
) => void

type RouteHeaderProps = {
  closeSurface: () => void
  navigate: NavigateRoute
  onUnavailable: (message: string) => void
  route: HashRoute
}

// URLの種類から3種類の共通ヘッダーを選び、未実装操作は状態通知へつなぎます。
function RouteHeader({
  closeSurface,
  navigate,
  onUnavailable,
  route
}: RouteHeaderProps) {
  const commonProps = {
    logoSrc: bookmationLogo,
    onLogoClick: () => navigate({ kind: "home" })
  }

  switch (route.kind) {
    case "home":
    case "bookmarks":
      return (
        <AppHeader
          {...commonProps}
          aiAccessibleLabel="カテゴリ・タグ一覧を開く"
          aiIcon={
            <span className="inline-flex size-6 items-center justify-center">
              <img alt="" className="size-[1.125rem]" src={aiTelescopeIcon} />
            </span>
          }
          onAiSearchClick={() => navigate({ kind: "labels" })}
          onSearchClick={() =>
            onUnavailable("検索入力と候補は現在準備中です。")
          }
          onSettingsClick={() =>
            navigate({ kind: "settings", section: "general" })
          }
          variant="default"
        />
      )
    case "search":
      return (
        <AppHeader
          {...commonProps}
          aiIcon={
            <span className="inline-flex size-6 items-center justify-center">
              <img alt="" className="size-[1.125rem]" src={aiTelescopeIcon} />
            </span>
          }
          onAiSearchClick={() => onUnavailable("AI検索は現在準備中です。")}
          onSearchClick={() =>
            onUnavailable("検索入力と候補は現在準備中です。")
          }
          onSettingsClick={() =>
            navigate({ kind: "settings", section: "general" })
          }
          variant="default"
        />
      )
    case "labels":
      return (
        <AppHeader
          {...commonProps}
          manageIcon={<img alt="" className="size-6" src={manageWrenchIcon} />}
          onClose={closeSurface}
          onCreateCategoryClick={() =>
            onUnavailable("カテゴリ作成は現在準備中です。")
          }
          onCreateTagClick={() => onUnavailable("タグ作成は現在準備中です。")}
          onManageClick={() => onUnavailable("管理モードは現在準備中です。")}
          onSearchClick={() =>
            onUnavailable("検索入力と候補は現在準備中です。")
          }
          variant="labels"
        />
      )
    case "settings":
      return (
        <AppHeader {...commonProps} onClose={closeSurface} variant="settings" />
      )
    case "welcome":
    case "not-found":
      return null
  }
}

type RouteBodyProps = {
  bookmarkListPort: BookmarkListPort
  headingRef: React.RefObject<HTMLHeadingElement>
  navigate: NavigateRoute
  onUnavailable: (message: string) => void
  route: HashRoute
  runtime: ReturnType<typeof useAppRuntime>
}

type WelcomeScreenProps = {
  description: string
  heading: string
  headingRef: React.Ref<HTMLHeadingElement>
  navigate: NavigateRoute
}

// Figma「メイン画面」の初期画面を、通常画面のヘッダーやカードから独立して再現します。
function WelcomeScreen({
  description,
  heading,
  headingRef,
  navigate
}: WelcomeScreenProps) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-bm-paper text-bm-ink">
      <main
        className="mx-auto flex min-h-dvh w-full max-w-[90rem] items-center justify-center px-6 py-10 sm:px-10 sm:py-16"
        id="main-content"
      >
        <section
          aria-labelledby="welcome-heading"
          className="flex w-full max-w-[52rem] flex-col items-center text-center"
        >
          <img
            alt="Bookmation"
            className="h-auto w-full max-w-[25rem]"
            height={121}
            src={bookmationLogo}
            width={400}
          />
          <h1
            className="mb-0 mt-8 scroll-mt-8 rounded-bm-field text-3xl font-normal leading-tight outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-4 sm:mt-7 sm:text-[2.5rem] sm:leading-[1.45]"
            id="welcome-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            {heading}
          </h1>
          <p className="mb-0 mt-6 text-base font-normal leading-7 sm:mt-11 sm:text-[1.75rem] sm:leading-[1.25]">
            {description.split("\n").map((line) => (
              <span className="block" key={line}>
                {line}
              </span>
            ))}
          </p>
          <Button
            className="mt-7 h-[5.1875rem] w-full max-w-[26.75rem] !rounded-none px-6 !font-normal sm:mt-9 sm:!text-[1.75rem]"
            onClick={() => navigate({ kind: "home" })}
          >
            ここからはじめる
          </Button>
        </section>
      </main>
    </div>
  )
}

// UI-02では画面遷移の骨組みを実装し、後続機能の領域はプレースホルダーにします。
function RouteBody({
  bookmarkListPort,
  headingRef,
  navigate,
  onUnavailable,
  route,
  runtime
}: RouteBodyProps) {
  const [homeListRevision, setHomeListRevision] = React.useState(0)

  if (route.kind === "settings") {
    return (
      <div className="grid grid-cols-[clamp(7rem,28vw,13rem)_0.125rem_minmax(0,1fr)] gap-2 sm:gap-4 lg:gap-6">
        <nav
          aria-label="設定メニュー"
          className="-ml-4 w-[calc(100%+1rem)] self-start sm:-ml-8 sm:w-[calc(100%+2rem)] lg:-ml-[4.5rem] lg:w-[calc(100%+4.5rem)] min-[1440px]:ml-[calc(-4.5rem-(100vw-90rem)/2)] min-[1440px]:w-[calc(100%+4.5rem+(100vw-90rem)/2)]"
        >
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {(["general", "archive", "share"] as const).map((section) => {
              const current = route.section === section
              const destination = { kind: "settings", section } as const
              const SettingsIcon = settingsIcons[section]

              return (
                <li className="min-w-0 flex-none" key={section}>
                  <a
                    aria-current={current ? "page" : undefined}
                    className={joinClassNames(
                      "group relative flex min-h-12 w-full items-center whitespace-nowrap pl-8 pr-2 text-left text-base no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset sm:pl-10 sm:pr-4 sm:text-lg lg:pl-14 lg:text-xl",
                      current
                        ? "font-bold text-bm-paper focus-visible:ring-bm-paper"
                        : "font-medium text-bm-ink focus-visible:ring-bm-focus"
                    )}
                    href={serializeHashRoute(destination)}
                    onClick={(event) => {
                      // 修飾キー付きクリックはリンク本来の動作を残し、通常クリックだけ型付きルートへ渡します。
                      if (
                        event.defaultPrevented ||
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      ) {
                        return
                      }

                      event.preventDefault()
                      navigate(destination, { replace: true })
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={joinClassNames(
                        settingsItemBackgroundClass,
                        "bg-transparent group-hover:bg-bm-accent"
                      )}
                    />
                    {current && (
                      <span
                        aria-hidden="true"
                        className={joinClassNames(
                          settingsItemBackgroundClass,
                          "bg-bm-ink"
                        )}
                      />
                    )}
                    <span className="relative flex min-w-0 items-center gap-3">
                      <SettingsIcon
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                      <span>{settingsLabels[section]}</span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
        <span
          aria-label="設定メニューと設定内容の区切り"
          aria-orientation="vertical"
          className="block w-0.5 self-stretch bg-bm-muted"
          role="separator"
        />
        <section
          aria-label={`${settingsLabels[route.section]}設定の内容`}
          className="min-w-0 space-y-6 overflow-x-auto rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-3 sm:p-5 lg:p-8"
        >
          {route.section === "general" && (
            <>
              <div>
                <h3 className="font-semibold text-bm-ink">一般設定</h3>
                <p className="mt-2 text-sm leading-6 text-bm-muted-text">
                  この設定項目は現在準備中です。
                </p>
              </div>
              {/* TASK-007: Prompt API スパイク実装 */}
              <div className="border-t border-bm-border pt-6">
                <PromptApiTester />
              </div>
            </>
          )}
          {route.section !== "general" && (
            <p className="m-0 text-sm leading-6 text-bm-muted-text">
              この設定項目は現在準備中です。
            </p>
          )}
        </section>
      </div>
    )
  }

  if (route.kind === "not-found") {
    return (
      <div className="max-w-2xl rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-5 sm:p-8">
        <p className="m-0 break-all text-sm leading-6 text-bm-muted-text">
          入力されたURL: <code>{route.attemptedHash || "（空）"}</code>
        </p>
        <div className="mt-5 flex justify-start">
          <Button onClick={() => navigate({ kind: "home" })} variant="outline">
            ホームへ移動
          </Button>
        </div>
      </div>
    )
  }

  if (route.kind === "home" || route.kind === "bookmarks") {
    const filter =
      route.kind === "home" ? ({ kind: "recent" } as const) : route.filter
    const bookmarkList = (
      <BookmarkListPage
        filter={filter}
        headingRef={headingRef}
        key={route.kind === "home" ? homeListRevision : undefined}
        onClearFilter={() => navigate({ kind: "home" })}
        onEdit={(bookmarkId) =>
          onUnavailable(
            `ブックマーク「${bookmarkId}」の編集はUI-05で実装します。`
          )
        }
        onNavigateToFilter={(nextFilter) =>
          navigate({ filter: nextFilter, kind: "bookmarks" })
        }
        port={bookmarkListPort}
        runtime={runtime}
      />
    )

    return route.kind === "home" ? (
      <div className="space-y-8">
        <HomeSavePanel
          onSaved={() => setHomeListRevision((revision) => revision + 1)}
          showRecent={false}
        />
        {bookmarkList}
      </div>
    ) : (
      bookmarkList
    )
  }

  return (
    <section
      aria-label="画面コンテンツ"
      className="min-h-64 rounded-bm-dialog border-2 border-dashed border-bm-muted bg-bm-paper p-5 sm:p-8"
    >
      <p className="m-0 text-sm leading-6 text-bm-muted-text">
        表示するデータを準備しています。
      </p>
    </section>
  )
}

export function ExtensionApp({
  bookmarkListPort = emptyBookmarkListPort
}: {
  bookmarkListPort?: BookmarkListPort
}) {
  const routeStore = useHashRouteStore()
  const runtime = useAppRuntime()
  const route = React.useSyncExternalStore(
    routeStore.subscribe,
    routeStore.getSnapshot,
    routeStore.getSnapshot
  )
  const routeKey = getHashRouteKey(route)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  // 再描画に使わない履歴情報はrefに置き、画面表示用の通知だけをstateにします。
  const scrollPositions = React.useRef(new Map<string, number>())
  const pushedRouteKey = React.useRef<string | null>(null)
  const closeOrigin = React.useRef<
    { surface: "labels" | "settings" } | undefined
  >(undefined)
  const previousRouteKey = React.useRef(routeKey)
  const [notice, setNotice] = React.useState<string | null>(null)

  // ブラウザ標準とアプリ独自のスクロール復元が競合しないようにします。
  React.useEffect(() => runtime.setManualScrollRestoration(), [runtime])

  // 新しい画面は先頭へ、戻る・進む操作では保存した位置へ復元します。
  React.useLayoutEffect(() => {
    const positions = scrollPositions.current
    const isNewNavigation = pushedRouteKey.current === routeKey
    const nextScrollTop = isNewNavigation ? 0 : (positions.get(routeKey) ?? 0)

    pushedRouteKey.current = null
    if (previousRouteKey.current !== routeKey) {
      headingRef.current?.focus({ preventScroll: true })
    }
    previousRouteKey.current = routeKey
    runtime.scrollTo(nextScrollTop)
    setNotice(null)

    return () => {
      positions.set(routeKey, runtime.getScrollY())
    }
  }, [routeKey, runtime])

  const navigate = React.useCallback(
    (nextRoute: KnownHashRoute, options?: { replace?: boolean }) => {
      const nextRouteKey = getHashRouteKey(nextRoute)
      const currentSurface =
        route.kind === "labels"
          ? "labels"
          : route.kind === "settings"
            ? "settings"
            : null
      const nextSurface =
        nextRoute.kind === "labels"
          ? "labels"
          : nextRoute.kind === "settings"
            ? "settings"
            : null

      if (nextRouteKey === routeKey) {
        headingRef.current?.focus({ preventScroll: true })
        runtime.scrollTo(0)
        return
      }

      scrollPositions.current.set(routeKey, runtime.getScrollY())
      pushedRouteKey.current = nextRouteKey
      if (nextSurface && nextSurface !== currentSurface) {
        closeOrigin.current = {
          surface: nextSurface
        }
      } else if (!nextSurface) {
        closeOrigin.current = undefined
      }

      if (options?.replace) {
        routeStore.navigate(nextRoute, { replace: true })
      } else {
        routeStore.navigate(nextRoute)
      }
    },
    [route, routeKey, routeStore, runtime]
  )

  const closeSurface = React.useCallback(() => {
    const currentSurface =
      route.kind === "labels"
        ? "labels"
        : route.kind === "settings"
          ? "settings"
          : null

    // アプリ内から開いた全画面は履歴を戻し、直接開いた場合はホームへ置き換えます。
    if (currentSurface && closeOrigin.current?.surface === currentSurface) {
      closeOrigin.current = undefined
      routeStore.back()
      return
    }

    navigate({ kind: "home" }, { replace: true })
  }, [navigate, route.kind, routeStore])

  const copy = getRouteCopy(route)

  if (route.kind === "welcome") {
    return (
      <WelcomeScreen
        description={copy.description}
        heading={copy.heading}
        headingRef={headingRef}
        navigate={navigate}
      />
    )
  }

  const tone = route.kind === "labels" ? "accent" : "paper"

  return (
    <AppShell
      description={copy.description}
      eyebrow={copy.eyebrow}
      header={
        <RouteHeader
          closeSurface={closeSurface}
          navigate={navigate}
          onUnavailable={setNotice}
          route={route}
        />
      }
      heading={copy.heading}
      headingVisuallyHidden={
        route.kind === "home" || route.kind === "bookmarks"
      }
      headingRef={headingRef}
      tone={tone}
    >
      {notice ? (
        <p
          className="mb-4 mt-0 rounded-bm-field border-2 border-bm-border bg-bm-paper px-4 py-3 text-sm"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <RouteBody
        bookmarkListPort={bookmarkListPort}
        headingRef={headingRef}
        navigate={navigate}
        onUnavailable={setNotice}
        route={route}
        runtime={runtime}
      />
    </AppShell>
  )
}
