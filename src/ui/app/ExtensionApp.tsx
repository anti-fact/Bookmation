/**
 * 型付きのURLルートを共通ヘッダーと画面の土台へ結び付け、
 * 画面遷移時のフォーカスとスクロール位置を管理するアプリ本体です。
 */
import * as React from "react"

import { AppHeader } from "~/ui/components/AppHeader"
import { AppShell } from "~/ui/components/AppShell"
import { Button } from "~/ui/primitives"

import { useAppRuntime, useHashRouteStore } from "./AppProviders"
import {
  getHashRouteKey,
  type HashRoute,
  type KnownHashRoute,
  type SettingsSection
} from "./hash-route"

// モジュール相対URLにすることで、ビルド時に画像を拡張機能へ同梱できます。
const aiTelescopeIcon = new URL("../assets/ai-telescope.svg", import.meta.url)
  .href
const bookmationLogo = new URL("../assets/bookmation-logo.png", import.meta.url)
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

// ルートごとの見出しと説明を一か所へ集め、画面本体との表記ずれを防ぎます。
function getRouteCopy(route: HashRoute): RouteCopy {
  switch (route.kind) {
    case "welcome":
      return {
        description:
          "保存したページをカテゴリとタグで整理し、あとから見つけ直せます。",
        eyebrow: "Welcome",
        heading: "Bookmationへようこそ"
      }
    case "home":
      return {
        description: "最近追加したブックマークを表示するホームです。",
        eyebrow: "Home",
        heading: "最近追加したブックマーク"
      }
    case "bookmarks":
      return {
        description: `${
          route.filter.kind === "category" ? "カテゴリ" : "タグ"
        } ID「${route.filter.id}」で絞り込む一覧です。`,
        eyebrow: "Bookmarks",
        heading: "ブックマーク一覧"
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
    case "search":
      return (
        <AppHeader
          {...commonProps}
          aiIcon={<img alt="" className="size-6" src={aiTelescopeIcon} />}
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
          aiIcon={<img alt="" className="size-6" src={aiTelescopeIcon} />}
          manageAction={
            <Button
              className="min-w-[5.3125rem]"
              onClick={() => onUnavailable("管理モードは現在準備中です。")}
            >
              管理
            </Button>
          }
          newAction={
            <Button
              onClick={() =>
                onUnavailable("カテゴリ・タグ作成は現在準備中です。")
              }
            >
              新規作成
            </Button>
          }
          onAiSearchClick={() => onUnavailable("AI検索は現在準備中です。")}
          onClose={closeSurface}
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
  navigate: NavigateRoute
  route: HashRoute
}

// UI-02では画面遷移の骨組みを実装し、後続機能の領域はプレースホルダーにします。
function RouteBody({ navigate, route }: RouteBodyProps) {
  if (route.kind === "welcome") {
    return (
      <div className="grid max-w-2xl gap-4 rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-5 shadow-bm-header sm:p-8">
        <img
          alt="Bookmation"
          className="h-auto w-[9.9375rem]"
          height={48}
          src={bookmationLogo}
          width={159}
        />
        <p className="m-0 text-sm leading-6 text-bm-muted-text">
          保存したページをカテゴリとタグで整理し、あとから見つけ直せます。
        </p>
        <div>
          <Button onClick={() => navigate({ kind: "home" })} variant="solid">
            ホームを開く
          </Button>
        </div>
      </div>
    )
  }

  if (route.kind === "settings") {
    return (
      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav
          aria-label="設定メニュー"
          className="flex flex-wrap content-start gap-2 md:flex-col"
        >
          {(["general", "archive", "share"] as const).map((section) => (
            <Button
              aria-current={route.section === section ? "page" : undefined}
              className="w-full justify-start"
              key={section}
              onClick={() =>
                navigate({ kind: "settings", section }, { replace: true })
              }
              size="compact"
              variant={route.section === section ? "solid" : "outline"}
            >
              {settingsLabels[section]}
            </Button>
          ))}
        </nav>
        <section
          aria-label={`${settingsLabels[route.section]}設定の内容`}
          className="min-h-64 rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-5 sm:p-8"
        >
          <p className="m-0 text-sm leading-6 text-bm-muted-text">
            この設定項目は現在準備中です。
          </p>
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
        <Button
          className="mt-5"
          onClick={() => navigate({ kind: "home" })}
          variant="solid"
        >
          ホームへ移動
        </Button>
      </div>
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

export function ExtensionApp() {
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
  const tone =
    route.kind === "labels" || route.kind === "welcome" ? "accent" : "paper"

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
      <RouteBody navigate={navigate} route={route} />
    </AppShell>
  )
}
