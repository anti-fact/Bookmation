import * as React from "react"

import { AppProviders, createBrowserAppRuntime } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"
import { createBrowserHashRouteStore } from "~/ui/app/hash-route"
import type { LabelManagementPort } from "~/ui/features/labels/label-management-port"

const fixtureRoutes = [
  ["ホーム", "#/home"],
  ["カテゴリ一覧", "#/labels"],
  ["一般設定", "#/settings/general"],
  ["アーカイブ設定", "#/settings/archive"],
  ["共有設定", "#/settings/share"],
  ["検索結果", "#/search?q=あとで読む"],
  ["初回画面", "#/welcome"],
  ["カテゴリ選択", "#/onboarding/categories"],
  ["不正URL", "#/unknown"]
] as const

export function AppShellFixture() {
  const routeStore = React.useMemo(
    () => createBrowserHashRouteStore(window),
    []
  )
  const runtime = React.useMemo(
    () => createBrowserAppRuntime(window, "web-preview"),
    []
  )
  const labelManagementPort = React.useMemo<LabelManagementPort>(() => {
    const categories = [
      {
        id: "category-development",
        name: "開発",
        origin: "USER",
        revision: 1,
        tags: [
          {
            id: "tag-typescript",
            name: "TypeScript",
            origin: "USER",
            parentCategoryId: "category-development",
            parentCategoryName: "開発",
            revision: 1,
            usageCount: 4
          }
        ]
      },
      {
        id: "category-reading",
        name: "あとで読む",
        origin: "USER",
        revision: 1,
        tags: []
      }
    ]
    return {
      createCategory: async ({ name }) => ({
        id: crypto.randomUUID(),
        name,
        revision: 1
      }),
      createTag: async ({ category, name }) => ({
        id: crypto.randomUUID(),
        name,
        origin: "USER",
        parentCategoryId: category.id,
        parentCategoryName: category.name,
        revision: 1,
        usageCount: 0
      }),
      deleteCategory: async () => undefined,
      deleteTag: async () => undefined,
      getCategoryDetail: async (id) => {
        const category =
          categories.find((item) => item.id === id) ?? categories[0]
        return {
          activeTagCount: category.tags.length,
          activeTags: category.tags,
          category,
          impactFingerprint: `fixture:${id}`,
          referencedActiveBookmarkCount: category.tags.reduce(
            (sum, tag) => sum + tag.usageCount,
            0
          )
        }
      },
      list: async () => categories,
      searchCategories: async () => categories,
      updateTag: async () => undefined
    }
  }, [])

  return (
    <AppProviders routeStore={routeStore} runtime={runtime}>
      <AppErrorBoundary>
        <ExtensionApp labelManagementPort={labelManagementPort} />
      </AppErrorBoundary>

      <aside className="fixed bottom-3 right-3 z-bm-toast max-w-[calc(100vw-1.5rem)] rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-3 text-xs shadow-bm-floating">
        <details>
          <summary className="cursor-pointer select-none font-bold uppercase tracking-[0.12em]">
            Test preview / UI-02
          </summary>
          <nav
            aria-label="App Shell fixture切替"
            className="mt-3 flex max-w-xs flex-wrap gap-2"
          >
            {fixtureRoutes.map(([label, hash]) => (
              <a
                className="rounded-bm-field border border-bm-border bg-bm-paper px-2 py-1 text-bm-ink outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus"
                href={hash}
                key={hash}
              >
                {label}
              </a>
            ))}
            <a
              className="rounded-bm-field border border-bm-border bg-bm-panel px-2 py-1 text-bm-on-panel outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
              href="?view=bookmarks&fixture=grid#/home"
            >
              UI-05 bookmarks
            </a>
            <a
              className="rounded-bm-field border border-bm-border bg-bm-panel px-2 py-1 text-bm-on-panel outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
              href="?view=popup&fixture=assigned"
            >
              UI-03 popup
            </a>
            <a
              className="rounded-bm-field border border-bm-border bg-bm-panel px-2 py-1 text-bm-on-panel outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
              href="?view=components"
            >
              UI-01 component sheet
            </a>
          </nav>
        </details>
      </aside>
    </AppProviders>
  )
}
