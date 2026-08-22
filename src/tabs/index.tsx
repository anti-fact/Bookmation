import * as React from "react"

import "~/style.css"

import { AppProviders } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"

export default function DashboardTab() {
  return (
    <AppProviders>
      <AppErrorBoundary>
        <ExtensionApp />
      </AppErrorBoundary>
    </AppProviders>
  )
}
