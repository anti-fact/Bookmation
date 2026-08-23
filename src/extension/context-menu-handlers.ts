import { saveFromContextMenuClick } from "~/application/save-context-menu-bookmark"
import type { SaveContextMenuBookmarkDeps } from "~/application/save-context-menu-bookmark"

export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  deps: SaveContextMenuBookmarkDeps,
): Promise<void> {
  await saveFromContextMenuClick(info, deps)
}
