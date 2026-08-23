import * as React from "react"

import "~/style.css"

import { createBrowserAiAssistantPort } from "~/adapters/browser-ai-assistant-port"
import { createChromeBookmarkFormPort } from "~/adapters/chrome-bookmark-form-port"
import { createChromeGeneralSettingsPort } from "~/adapters/chrome-general-settings-port"
import { createChromeLabelManagementPort } from "~/adapters/chrome-label-management-port"
import { createIndexedDbBookmarkListPort } from "~/adapters/indexeddb-bookmark-list-port"
import { createChromeSearchPort } from "~/adapters/chrome-search-port"
import { AppProviders } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"

export default function DashboardTab() {
  const aiAssistantPort = React.useMemo(
    () => createBrowserAiAssistantPort(),
    []
  )
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
  const labelManagementPort = React.useMemo(
    () => createChromeLabelManagementPort(),
    []
  )
  const searchPort = React.useMemo(() => createChromeSearchPort(), [])

  return (
    <AppProviders>
      <AppErrorBoundary>
        <ExtensionApp
          aiAssistantPort={aiAssistantPort}
          bookmarkFormPort={bookmarkFormPort}
          bookmarkListPort={bookmarkListPort}
          generalSettingsPort={generalSettingsPort}
          labelManagementPort={labelManagementPort}
          searchPort={searchPort}
        />
      </AppErrorBoundary>
    </AppProviders>
  )
}
