import { buildDashboardUrl, DASHBOARD_ENTRY, DASHBOARD_WELCOME_ROUTE } from "./paths"

export const INSTALL_STATE_KEY = "bookmation.install-state-v1"

export type InstallStorage = {
  get(key: string): Promise<Record<string, unknown>>
  set(value: Record<string, unknown>): Promise<void>
}

export type InstallRuntime = Pick<typeof chrome.runtime, "getURL">
export type InstallTabs = Pick<typeof chrome.tabs, "create">
export type InstallReason = "install" | "update" | "chrome_update" | "shared_module_update"

function isInitialized(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).schemaVersion === 1
  )
}

/** INSTALL の一度だけ初回状態を保存し、welcome を開く。update/startup では何もしない。 */
export async function initializeOnInstall(
  reason: InstallReason,
  storage: InstallStorage,
  runtime: InstallRuntime,
  tabs: InstallTabs,
): Promise<void> {
  if (reason !== "install") {
    return
  }

  const existing = await storage.get(INSTALL_STATE_KEY)
  if (isInitialized(existing[INSTALL_STATE_KEY])) {
    return
  }

  await storage.set({
    [INSTALL_STATE_KEY]: { schemaVersion: 1, initializedAt: Date.now() },
  })
  await tabs.create({
    url: buildDashboardUrl(runtime.getURL(DASHBOARD_ENTRY), DASHBOARD_WELCOME_ROUTE),
  })
}
