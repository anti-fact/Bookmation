import * as React from "react"

import "~/style.css"

import { createBrowserAiAssistantPort } from "~/adapters/browser-ai-assistant-port"
import { createChromeBookmarkFormPort } from "~/adapters/chrome-bookmark-form-port"
import { createChromeGeneralSettingsPort } from "~/adapters/chrome-general-settings-port"
import { createChromeLabelManagementPort } from "~/adapters/chrome-label-management-port"
import { createChromeOnboardingPort } from "~/adapters/chrome-onboarding-port"
import { createChromeVisitReminderPort } from "~/adapters/chrome-visit-reminder-port"
import { createIndexedDbBookmarkListPort } from "~/adapters/indexeddb-bookmark-list-port"
import { createChromeSearchPort } from "~/adapters/chrome-search-port"
import { AppProviders } from "~/ui/app/AppProviders"
import { ClassificationHost } from "~/ui/app/ClassificationHost"
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
  const onboardingPort = React.useMemo(
    () => createChromeOnboardingPort({ bookmarkFormPort }),
    [bookmarkFormPort]
  )
  const searchPort = React.useMemo(() => createChromeSearchPort(), [])
  const visitReminderPort = React.useMemo(
    () => createChromeVisitReminderPort({ runtime: chrome.runtime }),
    []
  )

  return (
    <AppProviders>
      <AppErrorBoundary>
        <ClassificationHost />
        <ExtensionApp
          aiAssistantPort={aiAssistantPort}
          bookmarkFormPort={bookmarkFormPort}
          bookmarkListPort={bookmarkListPort}
          generalSettingsPort={generalSettingsPort}
          labelManagementPort={labelManagementPort}
          onboardingPort={onboardingPort}
          searchPort={searchPort}
          visitReminderPort={visitReminderPort}
        />
      </AppErrorBoundary>
    </AppProviders>
  )
}
