import { EXTENSION_COMMANDS, type ExtensionCommand } from "./commands"
import {
  buildDashboardUrl,
  DASHBOARD_ENTRY,
  DASHBOARD_HOME_ROUTE
} from "./paths"

type CommandRuntime = Pick<typeof chrome.runtime, "getURL">
type CommandTabs = Pick<typeof chrome.tabs, "create">

export async function handleExtensionCommand(
  command: ExtensionCommand,
  runtime: CommandRuntime,
  tabs: CommandTabs
): Promise<void> {
  switch (command) {
    case EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME:
      await tabs.create({
        url: buildDashboardUrl(
          runtime.getURL(DASHBOARD_ENTRY),
          DASHBOARD_HOME_ROUTE
        )
      })
      return
    case EXTENSION_COMMANDS.SAVE_CURRENT_PAGE:
      // TASK-004 wires SaveCurrentPage and shared use cases.
      return
  }
}
