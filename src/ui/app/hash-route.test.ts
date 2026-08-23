/**
 * URLの解析と復元、不正URLの保持、hashchange・replace・backの契約を
 * 確認するテストです。
 */
import { describe, expect, it, vi } from "vitest"

import {
  createBrowserHashRouteStore,
  getAppHeaderVariant,
  getHashRouteKey,
  isKnownHashRoute,
  parseHashRoute,
  serializeHashRoute,
  type HashRoute,
  type KnownHashRoute
} from "./hash-route"

describe("parseHashRoute", () => {
  it.each<[string, HashRoute]>([
    ["#/welcome", { kind: "welcome" }],
    [
      "#/onboarding/categories",
      { kind: "onboarding", step: "categories" }
    ],
    ["#/home", { kind: "home" }],
    [
      "#/bookmarks?category=category-1",
      {
        kind: "bookmarks",
        filter: { kind: "category", id: "category-1" }
      }
    ],
    [
      "#/bookmarks?tag=tag-1",
      { kind: "bookmarks", filter: { kind: "tag", id: "tag-1" } }
    ],
    [
      "#/bookmarks?category=category-1&tag=tag-1",
      {
        kind: "bookmarks",
        filter: {
          categoryId: "category-1",
          kind: "category-tag",
          tagId: "tag-1"
        }
      }
    ],
    [
      "#/search?q=%E6%97%A5%E6%9C%AC%E8%AA%9E+query",
      { kind: "search", query: "日本語 query" }
    ],
    ["#/labels", { kind: "labels" }],
    ["#/settings/general", { kind: "settings", section: "general" }],
    ["#/settings/archive", { kind: "settings", section: "archive" }],
    ["#/settings/share", { kind: "settings", section: "share" }]
  ])("parses %s", (hash, expected) => {
    expect(parseHashRoute(hash)).toEqual(expected)
  })

  it.each([
    "",
    "#",
    "#/",
    "/home",
    "#/unknown",
    "#/home?extra=value",
    "#/labels?",
    "#/settings/general?extra=value",
    "#/settings/other",
    "#/bookmarks",
    "#/bookmarks?category=",
    "#/bookmarks?tag=+++",
    "#/bookmarks?category=one&category=two",
    "#/bookmarks?category=one&tag=two&extra=three",
    "#/bookmarks?folder=one",
    "#/search",
    "#/search?q=",
    "#/search?q=%",
    "#/search?q=one&q=two",
    "#/search?q=one&extra=two"
  ])("returns an explicit not-found result for %s", (hash) => {
    const route = parseHashRoute(hash)

    expect(route).toMatchObject({ kind: "not-found", attemptedHash: hash })
  })

  it("does not mutate the supplied hash while parsing an invalid route", () => {
    const hash = "#/bookmarks?category=one&category=two"

    parseHashRoute(hash)

    expect(hash).toBe("#/bookmarks?category=one&category=two")
  })
})

describe("serializeHashRoute", () => {
  it.each<KnownHashRoute>([
    { kind: "welcome" },
    { kind: "onboarding", step: "categories" },
    { kind: "home" },
    {
      kind: "bookmarks",
      filter: { kind: "category", id: "仕事 & 資料" }
    },
    { kind: "bookmarks", filter: { kind: "tag", id: "調査/AI" } },
    {
      kind: "bookmarks",
      filter: {
        categoryId: "仕事 & 資料",
        kind: "category-tag",
        tagId: "調査/AI"
      }
    },
    { kind: "search", query: "日本語 query & notes" },
    { kind: "labels" },
    { kind: "settings", section: "general" },
    { kind: "settings", section: "archive" },
    { kind: "settings", section: "share" }
  ])("round-trips $kind routes with canonical URL encoding", (route) => {
    const serialized = serializeHashRoute(route)

    expect(parseHashRoute(serialized)).toEqual(route)
    expect(serialized).not.toContain(" ")
  })

  it("uses stable keys and maps routes to the shared header variants", () => {
    const searchRoute: KnownHashRoute = { kind: "search", query: "資料" }
    const notFoundRoute = parseHashRoute("#/not-here")

    expect(getHashRouteKey(searchRoute)).toBe("#/search?q=%E8%B3%87%E6%96%99")
    expect(getHashRouteKey(notFoundRoute)).toBe("not-found:#/not-here")
    expect(getAppHeaderVariant(searchRoute)).toBe("default")
    expect(getAppHeaderVariant({ kind: "labels" })).toBe("labels")
    expect(getAppHeaderVariant({ kind: "settings", section: "general" })).toBe(
      "settings"
    )
    expect(getAppHeaderVariant({ kind: "welcome" })).toBeNull()
    expect(
      getAppHeaderVariant({ kind: "onboarding", step: "categories" })
    ).toBeNull()
    expect(getAppHeaderVariant(notFoundRoute)).toBeNull()
    expect(isKnownHashRoute(searchRoute)).toBe(true)
    expect(isKnownHashRoute(notFoundRoute)).toBe(false)
  })

  it("refuses to serialize empty bookmark filters and search queries", () => {
    expect(() =>
      serializeHashRoute({
        kind: "bookmarks",
        filter: { kind: "category", id: "  " }
      })
    ).toThrow("category id must not be empty")
    expect(() =>
      serializeHashRoute({
        kind: "bookmarks",
        filter: { categoryId: "資料", kind: "category-tag", tagId: "  " }
      })
    ).toThrow("tag id must not be empty")
    expect(() => serializeHashRoute({ kind: "search", query: "" })).toThrow(
      "search query must not be empty"
    )
  })
})

describe("createBrowserHashRouteStore", () => {
  it("publishes programmatic and external hash changes without duplicate updates", () => {
    window.history.replaceState(null, "", "/#/home")
    const store = createBrowserHashRouteStore(window)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    expect(store.getSnapshot()).toEqual({ kind: "home" })

    store.navigate({ kind: "labels" })
    expect(window.location.hash).toBe("#/labels")
    expect(store.getSnapshot()).toEqual({ kind: "labels" })
    expect(listener).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new HashChangeEvent("hashchange"))
    expect(listener).toHaveBeenCalledTimes(1)

    window.location.hash = "#/settings/archive"
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    expect(store.getSnapshot()).toEqual({
      kind: "settings",
      section: "archive"
    })
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    window.location.hash = "#/home"
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("supports replace navigation, no-op navigation, and browser back", () => {
    window.history.replaceState({ source: "test" }, "", "/#/home")
    const store = createBrowserHashRouteStore(window)
    const listener = vi.fn()
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    store.subscribe(listener)

    store.navigate({ kind: "home" })
    expect(listener).not.toHaveBeenCalled()

    store.navigate({ kind: "search", query: "あとで読む" }, { replace: true })
    expect(window.location.hash).toBe(
      "#/search?q=%E3%81%82%E3%81%A8%E3%81%A7%E8%AA%AD%E3%82%80"
    )
    expect(window.history.state).toEqual({ source: "test" })
    expect(listener).toHaveBeenCalledTimes(1)

    store.back()
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })

  it("exposes an invalid current hash without replacing or redirecting it", () => {
    window.history.replaceState(null, "", "/#/bookmarks?tag=")

    const route = createBrowserHashRouteStore(window).getSnapshot()

    expect(route).toEqual({
      kind: "not-found",
      attemptedHash: "#/bookmarks?tag=",
      reason: "invalid-query"
    })
    expect(window.location.hash).toBe("#/bookmarks?tag=")
  })
})
