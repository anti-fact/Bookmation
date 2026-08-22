import * as React from "react"

import "~/style.css"

import { createIndexedDbBookmarkListPort } from "~/adapters/indexeddb-bookmark-list-port"
import { AppProviders } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"

export default function DashboardTab() {
  const bookmarkListPort = React.useMemo(
    () =>
      createIndexedDbBookmarkListPort({
        storage: chrome.storage.local
      }),
    []
  )

  return (
    <AppProviders>
      <AppErrorBoundary>
        <ExtensionApp bookmarkListPort={bookmarkListPort} />
      </AppErrorBoundary>
    </AppProviders>
  )
}
