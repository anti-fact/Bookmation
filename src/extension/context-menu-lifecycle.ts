import { ChromeContextMenuAdapter, createChromeContextMenusApi } from "~/adapters/chrome-context-menu"
import {
  ChromeLocalSettingsStore,
  LOCAL_SETTINGS_STORAGE_KEY,
} from "~/adapters/chrome-local-settings-store"
import { reconcileContextMenusFromSettings } from "~/application/reconcile-context-menus"
import { safeLogError, safeLogInfo } from "~/adapters/security/log-redaction"
import type { ContextMenuPort } from "~/ports/context-menu-port"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"

type InstallReason = "install" | "update" | "chrome_update" | "shared_module_update"

type RuntimeInstalled = {
  onInstalled: {
    addListener(listener: (details: { reason: InstallReason }) => void): void
  }
  onStartup: {
    addListener(listener: () => void): void
  }
}

type StorageChanged = {
  onChanged: {
    addListener(
      listener: (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => void,
    ): void
  }
}

export type ContextMenuLifecycleDeps = Readonly<{
  settingsStore: LocalSettingsStore
  contextMenus: ContextMenuPort
}>

export function createDefaultContextMenuLifecycleDeps(): ContextMenuLifecycleDeps {
  return {
    settingsStore: new ChromeLocalSettingsStore(),
    contextMenus: new ChromeContextMenuAdapter(createChromeContextMenusApi(chrome.contextMenus)),
  }
}

export function registerContextMenuLifecycle(
  runtime: RuntimeInstalled,
  storage: StorageChanged,
  deps: ContextMenuLifecycleDeps = createDefaultContextMenuLifecycleDeps(),
): void {
  const reconcile = (): void => {
    void reconcileContextMenusFromSettings(deps.settingsStore, deps.contextMenus)
      .then(async () => {
        const settings = await deps.settingsStore.get()
        safeLogInfo(
          "Context menu reconcile",
          settings.contextMenuBookmarkEnabled ? "menus enabled" : "menus disabled",
        )
      })
      .catch((error: unknown) => {
        safeLogError("Context menu reconcile", error)
      })
  }

  runtime.onInstalled.addListener(() => {
    reconcile()
  })

  runtime.onStartup.addListener(() => {
    reconcile()
  })

  storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !(LOCAL_SETTINGS_STORAGE_KEY in changes)) {
      return
    }
    reconcile()
  })

  reconcile()
}
