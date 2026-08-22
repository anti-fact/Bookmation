export const DASHBOARD_ENTRY = "tabs/index.html"
export const DASHBOARD_HOME_ROUTE = "#/home"
export const DASHBOARD_WELCOME_ROUTE = "#/welcome"

export function buildDashboardUrl(
  entryUrl: string,
  route: string = DASHBOARD_HOME_ROUTE
): string {
  return `${entryUrl}${route}`
}
