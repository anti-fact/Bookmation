import type { ContextMenuPort } from "~/ports/context-menu-port"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"

export class ContextMenuApplicationError extends Error {
  readonly code: "CONTEXT_MENU_SYNC_FAILED"

  constructor(code: "CONTEXT_MENU_SYNC_FAILED") {
    super(code)
    this.name = "ContextMenuApplicationError"
    this.code = code
  }
}

export type UpdateContextMenuSettingResult = Readonly<{
  contextMenuBookmarkEnabled: boolean
}>

export async function updateContextMenuBookmarkEnabled(
  settingsStore: LocalSettingsStore,
  contextMenus: ContextMenuPort,
  enabled: boolean,
): Promise<UpdateContextMenuSettingResult> {
  const previous = await settingsStore.get()
  if (previous.contextMenuBookmarkEnabled === enabled) {
    await contextMenus.reconcile(enabled)
    return { contextMenuBookmarkEnabled: enabled }
  }

  const next = { ...previous, contextMenuBookmarkEnabled: enabled }
  await settingsStore.set(next)

  try {
    await contextMenus.reconcile(enabled)
  } catch {
    await settingsStore.set(previous)
    throw new ContextMenuApplicationError("CONTEXT_MENU_SYNC_FAILED")
  }

  return { contextMenuBookmarkEnabled: enabled }
}
