import {
  saveCurrentTabBookmark,
  type SaveBookmarkMessageApplicationDeps,
} from "~/application/save-bookmark-message-application"
import { EXTENSION_COMMANDS, type ExtensionCommand } from "./commands"
import { openOrFocusDashboardHome } from "./open-dashboard-tab"

type CommandRuntime = Pick<typeof chrome.runtime, "getURL">
type CommandTabs = Pick<typeof chrome.tabs, "query" | "create" | "update">
type CommandWindows = Pick<typeof chrome.windows, "update">

export async function handleExtensionCommand(
  command: ExtensionCommand,
  runtime: CommandRuntime,
  tabs: CommandTabs,
  windows: CommandWindows,
  saveDeps: SaveBookmarkMessageApplicationDeps,
): Promise<void> {
  switch (command) {
    case EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME:
      await openOrFocusDashboardHome(runtime, tabs, windows)
      return
    case EXTENSION_COMMANDS.SAVE_CURRENT_PAGE:
      await saveCurrentTabBookmark(saveDeps, {
        creationRequestId: `command-save:${crypto.randomUUID()}`,
      })
      return
  }
}
