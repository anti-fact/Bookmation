/**
 * ルーティングとスクロール処理を、拡張機能・Webプレビュー・テストで
 * 差し替えるための依存注入層です。
 */
import * as React from "react"

import { createBrowserHashRouteStore, type HashRouteStore } from "./hash-route"

export type AppRuntimeKind = "extension" | "web-preview"

export type AppRuntime = {
  getScrollY: () => number
  kind: AppRuntimeKind
  scrollTo: (top: number) => void
  setManualScrollRestoration: () => () => void
}

// Window API を小さな共通インターフェースで包み、画面から実行環境の違いを隠します。
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

// 初期値を null にしておくことで、Provider 外での誤使用を専用フックから検出できます。
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
  // 注入された値を優先するため、テストやWebプレビューではブラウザ実装を置き換えられます。
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
