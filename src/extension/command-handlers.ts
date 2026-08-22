import { EXTENSION_COMMANDS, type ExtensionCommand } from "./commands"
import {
  buildDashboardUrl,
  DASHBOARD_ENTRY,
  DASHBOARD_HOME_ROUTE,
} from "./paths"
import { saveCurrentTabFromCommand } from "./message-handler"
import { openOrFocusDashboardHome } from "./open-dashboard-tab"

type CommandRuntime = Pick<typeof chrome.runtime, "getURL">
type CommandTabs = Pick<typeof chrome.tabs, "query" | "create" | "update">
type CommandWindows = Pick<typeof chrome.windows, "update">

export async function handleExtensionCommand(
  command: ExtensionCommand,
  runtime: CommandRuntime,
  tabs: CommandTabs,
  windows: CommandWindows,
): Promise<void> {
  switch (command) {
    case EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME:
      await openOrFocusDashboardHome(runtime, tabs, windows)
      return
    case EXTENSION_COMMANDS.SAVE_CURRENT_PAGE:
      await saveCurrentTabFromCommand()
      return
  }
}

export function buildHomeUrl(runtime: CommandRuntime): string {
  return buildDashboardUrl(runtime.getURL(DASHBOARD_ENTRY), DASHBOARD_HOME_ROUTE)
}
