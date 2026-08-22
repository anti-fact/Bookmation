import * as React from "react"

import { AppProviders, createBrowserAppRuntime } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"
import { createBrowserHashRouteStore } from "~/ui/app/hash-route"

const fixtureRoutes = [
  ["ホーム", "#/home"],
  ["カテゴリ一覧", "#/labels"],
  ["一般設定", "#/settings/general"],
  ["アーカイブ設定", "#/settings/archive"],
  ["共有設定", "#/settings/share"],
  ["検索結果", "#/search?q=あとで読む"],
  ["初回画面", "#/welcome"],
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

  return (
    <AppProviders routeStore={routeStore} runtime={runtime}>
      <AppErrorBoundary>
        <ExtensionApp />
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
                className="rounded-bm-field border border-bm-border bg-bm-paper px-2 py-1 text-bm-ink outline-none hover:bg-bm-accent focus-visible:ring-2 focus-visible:ring-bm-focus"
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
              UI-04 bookmarks
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
