import * as React from "react"

import { createBrowserHashRouteStore, type HashRouteStore } from "./hash-route"

export type AppRuntimeKind = "extension" | "web-preview"

export type AppRuntime = {
  getScrollY: () => number
  kind: AppRuntimeKind
  scrollTo: (top: number) => void
  setManualScrollRestoration: () => () => void
}

export function createBrowserAppRuntime(
  browserWindow: Window,
  kind: AppRuntimeKind = "extension"
): AppRuntime {
  return {
    getScrollY: () => browserWindow.scrollY,
    kind,
    scrollTo: (top) => browserWindow.scrollTo({ behavior: "auto", top }),
    setManualScrollRestoration: () => {
      const previous = browserWindow.history.scrollRestoration
      browserWindow.history.scrollRestoration = "manual"

      return () => {
        browserWindow.history.scrollRestoration = previous
      }
    }
  }
}

type AppServices = {
  routeStore: HashRouteStore
  runtime: AppRuntime
}

const AppServicesContext = React.createContext<AppServices | null>(null)

export type AppProvidersProps = React.PropsWithChildren<{
  routeStore?: HashRouteStore
  runtime?: AppRuntime
}>

export function AppProviders({
  children,
  routeStore,
  runtime
}: AppProvidersProps) {
  const services = React.useMemo<AppServices>(() => {
    if (runtime && routeStore) {
      return { routeStore, runtime }
    }

    if (typeof window === "undefined") {
      throw new Error(
        "AppProviders requires injected services outside a browser"
      )
    }

    return {
      routeStore: routeStore ?? createBrowserHashRouteStore(window),
      runtime: runtime ?? createBrowserAppRuntime(window)
    }
  }, [routeStore, runtime])

  return (
    <AppServicesContext.Provider value={services}>
      {children}
    </AppServicesContext.Provider>
  )
}

export function useAppRuntime(): AppRuntime {
  const services = React.useContext(AppServicesContext)

  if (!services) {
    throw new Error("useAppRuntime must be used within AppProviders")
  }

  return services.runtime
}

export function useHashRouteStore(): HashRouteStore {
  const services = React.useContext(AppServicesContext)

  if (!services) {
    throw new Error("useHashRouteStore must be used within AppProviders")
  }

  return services.routeStore
}
