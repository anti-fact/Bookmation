import * as React from "react"

import "~/style.css"

import { createChromeBookmarkFormPort } from "~/adapters/chrome-bookmark-form-port"
import { createChromeGeneralSettingsPort } from "~/adapters/chrome-general-settings-port"
import { createIndexedDbBookmarkListPort } from "~/adapters/indexeddb-bookmark-list-port"
import { AppProviders } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"

export default function DashboardTab() {
  const bookmarkFormPort = React.useMemo(
    () => createChromeBookmarkFormPort(),
    []
  )
  const bookmarkListPort = React.useMemo(
    () =>
      createIndexedDbBookmarkListPort({
        storage: chrome.storage.local
      }),
    []
  )
  const generalSettingsPort = React.useMemo(
    () => createChromeGeneralSettingsPort(chrome),
    []
  )

  return (
    <AppProviders>
      <AppErrorBoundary>
        <ExtensionApp
          bookmarkFormPort={bookmarkFormPort}
          bookmarkListPort={bookmarkListPort}
          generalSettingsPort={generalSettingsPort}
        />
      </AppErrorBoundary>
    </AppProviders>
  )
}
