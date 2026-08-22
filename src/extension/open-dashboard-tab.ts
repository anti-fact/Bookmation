import {
  buildDashboardUrl,
  DASHBOARD_ENTRY,
  DASHBOARD_HOME_ROUTE,
  DASHBOARD_WELCOME_ROUTE,
} from "./paths"

type TabRuntime = Pick<typeof chrome.tabs, "query" | "create" | "update">
type WindowRuntime = Pick<typeof chrome.windows, "update">
type CommandRuntime = Pick<typeof chrome.runtime, "getURL">

function dashboardBaseUrl(runtime: CommandRuntime): string {
  return runtime.getURL(DASHBOARD_ENTRY)
}

function isDashboardRoute(url: string | undefined, baseUrl: string, route: string): boolean {
  if (!url) {
    return false
  }
  return url.startsWith(baseUrl) && url.includes(route)
}

export async function openOrFocusDashboardHome(
  runtime: CommandRuntime,
  tabs: TabRuntime,
  windows: WindowRuntime,
): Promise<void> {
  const baseUrl = dashboardBaseUrl(runtime)
  const homeUrl = buildDashboardUrl(baseUrl, DASHBOARD_HOME_ROUTE)
  const allTabs = await tabs.query({})
  const existing = allTabs.find((tab) =>
    isDashboardRoute(tab.url, baseUrl, DASHBOARD_HOME_ROUTE),
  )

  if (existing?.id !== undefined) {
    await tabs.update(existing.id, { active: true })
    if (existing.windowId !== undefined) {
      await windows.update(existing.windowId, { focused: true })
    }
    return
  }

  await tabs.create({ url: homeUrl })
}

export async function openDashboardWelcome(
  runtime: CommandRuntime,
  tabs: TabRuntime,
): Promise<void> {
  const url = buildDashboardUrl(dashboardBaseUrl(runtime), DASHBOARD_WELCOME_ROUTE)
  await tabs.create({ url })
}
