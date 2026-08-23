/**
 * 型付きのURLルートを共通ヘッダーと画面の土台へ結び付け、
 * 画面遷移時のフォーカスとスクロール位置を管理するアプリ本体です。
 */
import * as React from "react"
import { ArchiveIcon, GearIcon, Share2Icon } from "@radix-ui/react-icons"

import { AppHeader } from "~/ui/components/AppHeader"
import { AppShell } from "~/ui/components/AppShell"
import { AiAgentPopup } from "~/ui/features/ai-assistant/AiAgentPopup"
import {
  emptyAiAssistantPort,
  type AiAssistantPort
} from "~/ui/features/ai-assistant/ai-assistant-port"
import { BookmarkListPage } from "~/ui/features/bookmarks/BookmarkListPage"
import {
  BookmarkDialog,
  type BookmarkDialogMode
} from "~/ui/features/bookmarks/BookmarkDialog"
import {
  emptyBookmarkFormPort,
  type BookmarkFormPort
} from "~/ui/features/bookmarks/bookmark-form-port"
import {
  emptyBookmarkListPort,
  type BookmarkListPort
} from "~/ui/features/bookmarks/bookmark-list-port"
import {
  LabelsPage,
  type LabelsCreateRequest
} from "~/ui/features/labels/LabelsPage"
import {
  emptyLabelManagementPort,
  type LabelManagementPort
} from "~/ui/features/labels/label-management-port"
import { OnboardingCategoriesPage } from "~/ui/features/onboarding/OnboardingCategoriesPage"
import {
  emptyOnboardingPort,
  type OnboardingPort
} from "~/ui/features/onboarding/onboarding-port"
import { GeneralSettingsSection } from "~/ui/features/settings/GeneralSettingsSection"
import { ArchiveSettingsSection } from "~/ui/features/settings/ArchiveSettingsSection"
import {
  emptyArchiveSettingsPort,
  type ArchiveSettingsPort
} from "~/ui/features/settings/archive-settings-port"
import {
  emptyGeneralSettingsPort,
  type GeneralSettingsPort
} from "~/ui/features/settings/general-settings-port"
import { ShareSettingsSection } from "~/ui/features/settings/ShareSettingsSection"
import {
  emptyShareSettingsPort,
  type ShareSettingsPort
} from "~/ui/features/settings/share-settings-port"
import { SearchBox } from "~/ui/features/search/SearchBox"
import { SearchResultsPage } from "~/ui/features/search/SearchResultsPage"
import {
  emptySearchPort,
  type SearchPort,
  type SearchSuggestion
} from "~/ui/features/search/search-port"
import {
  emptyVisitReminderPort,
  type VisitReminderPort
} from "~/ui/features/visit-reminder/visit-reminder-port"
import { VisitReminderDialog } from "~/ui/features/visit-reminder/VisitReminderDialog"
import { Button } from "~/ui/primitives"
import { joinClassNames } from "~/ui/primitives/class-names"

import { useAppRuntime, useHashRouteStore } from "./AppProviders"
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

// 説明とメニューを同じ左レールに置き、項目ごとのpaddingを共用します。
const settingsRailClass =
  "-ml-4 w-[calc(100%+1rem)] sm:-ml-8 sm:w-[calc(100%+2rem)] lg:-ml-[4.5rem] lg:w-[calc(100%+4.5rem)] min-[1440px]:ml-[calc(-4.5rem-(100vw-90rem)/2)] min-[1440px]:w-[calc(100%+4.5rem+(100vw-90rem)/2)]"
const settingsRailPaddingClass = "pl-8 pr-2 sm:pl-10 sm:pr-4 lg:pl-14"

const welcomeDescription = [
  "Bookmationはブックマークを簡単に整理できる拡張機能です。",
  "かんたんな初期設定を終わらせて、さっそくはじめましょう。"
] as const

const onboardingCategoriesDescription = [
  "あなたのブックマークにぴったりのカテゴリを作りましょう。",
  "カテゴリは後から設定で変更できます。"
] as const

// ルートごとの見出しと説明を一か所へ集め、画面本体との表記ずれを防ぎます。
function getRouteCopy(route: HashRoute): RouteCopy {
  switch (route.kind) {
    case "welcome":
      return {
        description: welcomeDescription.join("\n"),
        heading: "Bookmationへようこそ"
      }
    case "onboarding":
      return {
        description: onboardingCategoriesDescription.join("\n"),
        heading: "あなたにあったカテゴリを選ぶ"
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
  onBookmarkAddClick: () => void
  onLabelsCreate: (kind: "category" | "tag") => void
  onLabelsManageToggle: () => void
  onUnavailable: (message: string) => void
  route: HashRoute
  searchPort: SearchPort
}

// URLの種類から3種類の共通ヘッダーを選び、未実装操作は状態通知へつなぎます。
function RouteHeader({
  closeSurface,
  navigate,
  onBookmarkAddClick,
  onLabelsCreate,
  onLabelsManageToggle,
  onUnavailable,
  route,
  searchPort
}: RouteHeaderProps) {
  const commonProps = {
    logoSrc: bookmationLogo,
    onLogoClick: () => navigate({ kind: "home" })
  }
  const onSuggestionSelect = (item: SearchSuggestion) => {
    if (item.entityType === "LABEL" && item.labelKind) {
      navigate({
        filter: {
          id: item.entityId,
          kind: item.labelKind === "CATEGORY" ? "category" : "tag"
        },
        kind: "bookmarks"
      })
      return
    }
    navigate({ kind: "search", query: item.displayText })
  }
  const searchSlot = (
    <SearchBox
      initialQuery={route.kind === "search" ? route.query : ""}
      onSelect={onSuggestionSelect}
      onSubmit={(query) => navigate({ kind: "search", query })}
      port={searchPort}
    />
  )

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
          onBookmarkAddClick={onBookmarkAddClick}
          searchSlot={searchSlot}
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
          searchSlot={searchSlot}
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
          onCreateCategoryClick={() => onLabelsCreate("category")}
          onCreateTagClick={() => onLabelsCreate("tag")}
          onManageClick={onLabelsManageToggle}
          searchSlot={searchSlot}
          variant="labels"
        />
      )
    case "settings":
      return (
        <AppHeader {...commonProps} onClose={closeSurface} variant="settings" />
      )
    case "welcome":
    case "onboarding":
    case "not-found":
      return null
  }
}

type RouteBodyProps = {
  archiveSettingsPort: ArchiveSettingsPort
  bookmarkListRevision: number
  bookmarkListPort: BookmarkListPort
  generalSettingsPort: GeneralSettingsPort
  headingRef: React.RefObject<HTMLHeadingElement>
  labelCreateRequest: LabelsCreateRequest
  labelManagementPort: LabelManagementPort
  labelsManageMode: boolean
  navigate: NavigateRoute
  onLabelCreateRequestHandled: () => void
  onEditBookmark: (
    bookmark: Parameters<
      React.ComponentProps<typeof BookmarkListPage>["onEdit"]
    >[0]
  ) => void
  route: HashRoute
  runtime: ReturnType<typeof useAppRuntime>
  searchPort: SearchPort
  shareSettingsPort: ShareSettingsPort
}

type WelcomeScreenProps = {
  description: string
  heading: string
  headingRef: React.Ref<HTMLHeadingElement>
  onStart: () => Promise<void>
}

// Figma「メイン画面」の初期画面を、通常画面のヘッダーやカードから独立して再現します。
function WelcomeScreen({
  description,
  heading,
  headingRef,
  onStart
}: WelcomeScreenProps) {
  const [startState, setStartState] = React.useState<
    "idle" | "saving" | "error"
  >("idle")

  const start = async () => {
    setStartState("saving")
    try {
      await onStart()
    } catch {
      setStartState("error")
    }
  }

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
            loading={startState === "saving"}
            onClick={() => void start()}
          >
            {startState === "saving" ? "準備しています" : "ここからはじめる"}
          </Button>
          {startState === "error" ? (
            <p className="mb-0 mt-4 text-sm text-bm-error" role="alert">
              初期設定を開始できませんでした。もう一度お試しください。
            </p>
          ) : null}
        </section>
      </main>
    </div>
  )
}

// UI-02では画面遷移の骨組みを実装し、後続機能の領域はプレースホルダーにします。
function RouteBody({
  archiveSettingsPort,
  bookmarkListRevision,
  bookmarkListPort,
  headingRef,
  labelCreateRequest,
  labelManagementPort,
  labelsManageMode,
  navigate,
  onLabelCreateRequestHandled,
  onEditBookmark,
  generalSettingsPort,
  route,
  runtime,
  searchPort,
  shareSettingsPort
}: RouteBodyProps) {
  if (route.kind === "labels") {
    return (
      <LabelsPage
        createRequest={labelCreateRequest}
        manageMode={labelsManageMode}
        onCreateRequestHandled={onLabelCreateRequestHandled}
        onNavigate={(filter) => navigate({ filter, kind: "bookmarks" })}
        port={labelManagementPort}
      />
    )
  }

  if (route.kind === "search") {
    return (
      <SearchResultsPage
        onLabelSelect={(filter) => navigate({ filter, kind: "bookmarks" })}
        port={searchPort}
        query={route.query}
      />
    )
  }
  if (route.kind === "settings") {
    return (
      <div className="grid grid-cols-[clamp(7rem,28vw,13rem)_0.125rem_minmax(0,1fr)] gap-2 sm:gap-4 lg:gap-6">
        <nav
          aria-label="設定メニュー"
          className={joinClassNames(settingsRailClass, "self-start")}
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
                      "group relative flex min-h-12 w-full items-center whitespace-nowrap text-left text-base no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset sm:text-lg lg:text-xl",
                      settingsRailPaddingClass,
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
            <GeneralSettingsSection port={generalSettingsPort} />
          )}
          {route.section === "archive" && (
            <ArchiveSettingsSection port={archiveSettingsPort} />
          )}
          {route.section === "share" && (
            <ShareSettingsSection port={shareSettingsPort} />
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
        key={bookmarkListRevision}
        onClearFilter={() => navigate({ kind: "home" })}
        onEdit={onEditBookmark}
        onNavigateToFilter={(nextFilter) =>
          navigate({ filter: nextFilter, kind: "bookmarks" })
        }
        port={bookmarkListPort}
        runtime={runtime}
      />
    )

    return bookmarkList
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
  aiAssistantPort = emptyAiAssistantPort,
  archiveSettingsPort = emptyArchiveSettingsPort,
  bookmarkFormPort = emptyBookmarkFormPort,
  bookmarkListPort = emptyBookmarkListPort,
  generalSettingsPort = emptyGeneralSettingsPort,
  labelManagementPort = emptyLabelManagementPort,
  onboardingPort = emptyOnboardingPort,
  searchPort = emptySearchPort,
  shareSettingsPort = emptyShareSettingsPort,
  visitReminderPort = emptyVisitReminderPort
}: {
  aiAssistantPort?: AiAssistantPort
  archiveSettingsPort?: ArchiveSettingsPort
  bookmarkFormPort?: BookmarkFormPort
  bookmarkListPort?: BookmarkListPort
  generalSettingsPort?: GeneralSettingsPort
  labelManagementPort?: LabelManagementPort
  onboardingPort?: OnboardingPort
  searchPort?: SearchPort
  shareSettingsPort?: ShareSettingsPort
  visitReminderPort?: VisitReminderPort
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
  const [bookmarkDialogMode, setBookmarkDialogMode] =
    React.useState<BookmarkDialogMode | null>(null)
  const [bookmarkListRevision, setBookmarkListRevision] = React.useState(0)
  const [labelCreateRequest, setLabelCreateRequest] =
    React.useState<LabelsCreateRequest>(null)
  const [labelsManageMode, setLabelsManageMode] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [onboardingState, setOnboardingState] =
    React.useState<Awaited<ReturnType<OnboardingPort["load"]>>>(null)
  const [visitReminderOpen, setVisitReminderOpen] = React.useState(false)
  const [pendingVisitReminder, setPendingVisitReminder] =
    React.useState<Awaited<ReturnType<VisitReminderPort["getPending"]>>>(null)

  React.useEffect(() => {
    let cancelled = false
    void visitReminderPort.getPending().then((pending) => {
      if (!cancelled && pending) {
        setPendingVisitReminder(pending)
        setVisitReminderOpen(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [visitReminderPort])

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

  React.useEffect(() => {
    let active = true
    void onboardingPort.load().then((state) => {
      if (!active || !state) return
      setOnboardingState(state)
      if (route.kind !== "home" || state.status === "COMPLETED") return
      navigate(
        state.status === "NOT_STARTED"
          ? { kind: "welcome" }
          : { kind: "onboarding", step: "categories" },
        { replace: true }
      )
    })
    return () => {
      active = false
    }
  }, [navigate, onboardingPort, route.kind])

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
        onStart={async () => {
          const state = await onboardingPort.start()
          setOnboardingState(state)
          navigate({ kind: "onboarding", step: "categories" })
        }}
      />
    )
  }

  if (route.kind === "onboarding") {
    return (
      <OnboardingCategoriesPage
        description={copy.description}
        heading={copy.heading}
        headingRef={headingRef}
        initialSelection={onboardingState?.categorySelection}
        onSelectionChange={async (selection) => {
          setOnboardingState(await onboardingPort.saveSelection(selection))
        }}
        onSubmit={async (selection) => {
          setOnboardingState(await onboardingPort.complete(selection))
          navigate({ kind: "home" })
        }}
      />
    )
  }

  const tone = route.kind === "labels" ? "accent" : "paper"

  return (
    <>
      <AppShell
        description={copy.description}
        eyebrow={copy.eyebrow}
        header={
          <RouteHeader
            closeSurface={closeSurface}
            navigate={navigate}
            onBookmarkAddClick={() => setBookmarkDialogMode({ kind: "add" })}
            onLabelsCreate={(kind) =>
              setLabelCreateRequest({ id: Date.now(), kind })
            }
            onLabelsManageToggle={() => setLabelsManageMode((value) => !value)}
            onUnavailable={setNotice}
            route={route}
            searchPort={searchPort}
          />
        }
        heading={copy.heading}
        introClassName={
          route.kind === "settings"
            ? joinClassNames(settingsRailClass, settingsRailPaddingClass)
            : undefined
        }
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
          archiveSettingsPort={archiveSettingsPort}
          bookmarkListPort={bookmarkListPort}
          bookmarkListRevision={bookmarkListRevision}
          generalSettingsPort={generalSettingsPort}
          headingRef={headingRef}
          labelCreateRequest={labelCreateRequest}
          labelManagementPort={labelManagementPort}
          labelsManageMode={labelsManageMode}
          navigate={navigate}
          onLabelCreateRequestHandled={() => setLabelCreateRequest(null)}
          onEditBookmark={(bookmark) =>
            setBookmarkDialogMode({ bookmark, kind: "edit" })
          }
          route={route}
          runtime={runtime}
          searchPort={searchPort}
          shareSettingsPort={shareSettingsPort}
        />
      </AppShell>
      <BookmarkDialog
        mode={bookmarkDialogMode ?? { kind: "add" }}
        onComplete={(message) => {
          setBookmarkListRevision((revision) => revision + 1)
          setBookmarkDialogMode(null)
          setNotice(message)
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setBookmarkDialogMode(null)
        }}
        open={bookmarkDialogMode !== null}
        port={bookmarkFormPort}
      />
      {route.kind === "home" ||
      route.kind === "bookmarks" ||
      route.kind === "labels" ? (
        <AiAgentPopup
          onLabelSelect={(filter) => navigate({ filter, kind: "bookmarks" })}
          onSearch={(query) => navigate({ kind: "search", query })}
          port={aiAssistantPort}
        />
      ) : null}
      <VisitReminderDialog
        onClose={() => {
          setVisitReminderOpen(false)
          setPendingVisitReminder(null)
        }}
        onSaved={() => {
          setBookmarkListRevision((revision) => revision + 1)
        }}
        open={visitReminderOpen}
        pending={pendingVisitReminder}
        port={visitReminderPort}
      />
    </>
  )
}
