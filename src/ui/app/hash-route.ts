/**
 * URLのhashと画面状態を相互変換する唯一の場所です。
 * 不正なURLは自動修正せず、not-foundとして入力内容を保持します。
 */
import type { BookmarkLabelFilter } from "~/ui/features/bookmarks/bookmark-list-port"

export const SETTINGS_SECTIONS = ["general", "archive", "share"] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export type KnownHashRoute =
  | { kind: "welcome" }
  | { kind: "home" }
  | {
      kind: "bookmarks"
      filter: BookmarkLabelFilter
    }
  | { kind: "search"; query: string }
  | { kind: "labels" }
  | { kind: "settings"; section: SettingsSection }

export type NotFoundHashRoute = {
  kind: "not-found"
  attemptedHash: string
  reason: "missing-hash" | "unknown-path" | "invalid-query"
}

export type HashRoute = KnownHashRoute | NotFoundHashRoute

export type AppHeaderVariant = "default" | "labels" | "settings"

export type HashRouteNavigationOptions = {
  replace?: boolean
}

export type HashRouteStore = {
  back: () => void
  getSnapshot: () => HashRoute
  navigate: (
    route: KnownHashRoute,
    options?: HashRouteNavigationOptions
  ) => void
  subscribe: (listener: () => void) => () => void
}

type HashRouteBrowser = Pick<
  Window,
  "addEventListener" | "history" | "location" | "removeEventListener"
>

function notFound(
  attemptedHash: string,
  reason: NotFoundHashRoute["reason"]
): NotFoundHashRoute {
  return { kind: "not-found", attemptedHash, reason }
}

// 値の重複や余分な項目を許さず、期待したquery parameterを1個だけ読み取ります。
function parseSingleQueryParameter(
  rawQuery: string | null,
  expectedName: string
): string | null {
  if (rawQuery === null || rawQuery.length === 0) {
    return null
  }

  try {
    decodeURIComponent(rawQuery.replaceAll("+", " "))
  } catch {
    return null
  }

  const entries = Array.from(new URLSearchParams(rawQuery).entries())
  if (entries.length !== 1 || entries[0]?.[0] !== expectedName) {
    return null
  }

  const value = entries[0][1]
  return value.trim().length > 0 ? value : null
}

function parseBookmarkFilter(rawQuery: string): BookmarkLabelFilter | null {
  try {
    decodeURIComponent(rawQuery.replaceAll("+", " "))
  } catch {
    return null
  }

  const entries = Array.from(new URLSearchParams(rawQuery).entries())
  if (entries.length < 1 || entries.length > 2) {
    return null
  }

  const categoryValues = entries
    .filter(([name]) => name === "category")
    .map(([, value]) => value)
  const tagValues = entries
    .filter(([name]) => name === "tag")
    .map(([, value]) => value)
  if (
    categoryValues.length > 1 ||
    tagValues.length > 1 ||
    categoryValues.length + tagValues.length !== entries.length
  ) {
    return null
  }

  const categoryId = categoryValues[0]?.trim()
  const tagId = tagValues[0]?.trim()
  if (categoryId && tagId) {
    return { categoryId, kind: "category-tag", tagId }
  }
  if (categoryId) {
    return { id: categoryId, kind: "category" }
  }
  if (tagId) {
    return { id: tagId, kind: "tag" }
  }
  return null
}

function hasNoQuery(rawQuery: string | null): boolean {
  return rawQuery === null
}

function requireNonEmptyRouteValue(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new TypeError(`${name} must not be empty`)
  }

  return value
}

export function isKnownHashRoute(route: HashRoute): route is KnownHashRoute {
  return route.kind !== "not-found"
}

// 解析に失敗した場合もredirectせず、原因を持つnot-foundを返します。
export function parseHashRoute(hash: string): HashRoute {
  if (!hash.startsWith("#/") || hash === "#/") {
    return notFound(hash, "missing-hash")
  }

  const questionMarkIndex = hash.indexOf("?")
  const path =
    questionMarkIndex === -1 ? hash.slice(1) : hash.slice(1, questionMarkIndex)
  const rawQuery =
    questionMarkIndex === -1 ? null : hash.slice(questionMarkIndex + 1)

  switch (path) {
    case "/welcome":
      return hasNoQuery(rawQuery)
        ? { kind: "welcome" }
        : notFound(hash, "invalid-query")
    case "/home":
      return hasNoQuery(rawQuery)
        ? { kind: "home" }
        : notFound(hash, "invalid-query")
    case "/bookmarks": {
      if (rawQuery === null) {
        return notFound(hash, "invalid-query")
      }

      const filter = parseBookmarkFilter(rawQuery)
      return filter === null
        ? notFound(hash, "invalid-query")
        : { kind: "bookmarks", filter }
    }
    case "/search": {
      const query = parseSingleQueryParameter(rawQuery, "q")
      return query === null
        ? notFound(hash, "invalid-query")
        : { kind: "search", query }
    }
    case "/labels":
      return hasNoQuery(rawQuery)
        ? { kind: "labels" }
        : notFound(hash, "invalid-query")
    case "/settings/general":
    case "/settings/archive":
    case "/settings/share":
      return hasNoQuery(rawQuery)
        ? {
            kind: "settings",
            section: path.slice("/settings/".length) as SettingsSection
          }
        : notFound(hash, "invalid-query")
    default:
      return notFound(hash, "unknown-path")
  }
}

// 空値を拒否し、URLSearchParamsで常に同じ形式へ安全にencodeします。
export function serializeHashRoute(route: KnownHashRoute): string {
  switch (route.kind) {
    case "welcome":
      return "#/welcome"
    case "home":
      return "#/home"
    case "bookmarks": {
      const params = new URLSearchParams()
      if (route.filter.kind === "category-tag") {
        params.set(
          "category",
          requireNonEmptyRouteValue(route.filter.categoryId, "category id")
        )
        params.set(
          "tag",
          requireNonEmptyRouteValue(route.filter.tagId, "tag id")
        )
      } else {
        params.set(
          route.filter.kind,
          requireNonEmptyRouteValue(
            route.filter.id,
            `${route.filter.kind} id`
          )
        )
      }
      return `#/bookmarks?${params.toString()}`
    }
    case "search": {
      const params = new URLSearchParams({
        q: requireNonEmptyRouteValue(route.query, "search query")
      })
      return `#/search?${params.toString()}`
    }
    case "labels":
      return "#/labels"
    case "settings":
      return `#/settings/${route.section}`
  }
}

export function getHashRouteKey(route: HashRoute): string {
  return isKnownHashRoute(route)
    ? serializeHashRoute(route)
    : `not-found:${route.attemptedHash}`
}

export function getAppHeaderVariant(route: HashRoute): AppHeaderVariant | null {
  switch (route.kind) {
    case "home":
    case "bookmarks":
    case "search":
      return "default"
    case "labels":
      return "labels"
    case "settings":
      return "settings"
    case "welcome":
    case "not-found":
      return null
  }
}

// ReactのuseSyncExternalStoreから購読できる形でhashchangeを公開します。
export function createBrowserHashRouteStore(
  browser: HashRouteBrowser = window
): HashRouteStore {
  let currentHash = browser.location.hash
  let currentRoute = parseHashRoute(currentHash)
  const listeners = new Set<() => void>()

  const syncFromLocation = (): boolean => {
    if (browser.location.hash === currentHash) {
      return false
    }

    currentHash = browser.location.hash
    currentRoute = parseHashRoute(currentHash)
    return true
  }

  const notifyIfChanged = (): void => {
    if (!syncFromLocation()) {
      return
    }

    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void): (() => void) => {
    // 購読者がいる間だけDOM eventを監視し、最後の解除時に後始末します。
    if (listeners.size === 0) {
      browser.addEventListener("hashchange", notifyIfChanged)
    }
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        browser.removeEventListener("hashchange", notifyIfChanged)
      }
    }
  }

  return {
    back: () => browser.history.back(),
    getSnapshot: () => {
      syncFromLocation()
      return currentRoute
    },
    navigate: (route, options = {}) => {
      const nextHash = serializeHashRoute(route)
      if (nextHash === browser.location.hash) {
        return
      }

      if (options.replace) {
        const nextUrl = `${browser.location.pathname}${browser.location.search}${nextHash}`
        browser.history.replaceState(browser.history.state, "", nextUrl)
      } else {
        browser.location.hash = nextHash
      }

      notifyIfChanged()
    },
    subscribe
  }
}
