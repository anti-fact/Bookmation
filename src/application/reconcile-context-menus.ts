import type { ContextMenuPort } from "~/ports/context-menu-port"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"

export async function reconcileContextMenusFromSettings(
  settingsStore: LocalSettingsStore,
  contextMenus: ContextMenuPort,
): Promise<void> {
  const settings = await settingsStore.get()
  await contextMenus.reconcile(settings.contextMenuBookmarkEnabled)
}
