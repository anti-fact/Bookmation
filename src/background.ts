import { ChromeCategoryTemplateReceiptStore } from "~adapters"
import { createLibraryApplication } from "~application"
import { createSaveBookmarkMessageApplication } from "~application/save-bookmark-message-application"
import { LocalDataLayer } from "~/adapters"
import { ChromeLocalSettingsStore } from "~/adapters/chrome-local-settings-store"
import { safeLogError, safeLogInfo, safeLogWarning } from "~/adapters/security/log-redaction"
import { handleExtensionCommand } from "~extension/command-handlers"
import { handleContextMenuClick } from "~extension/context-menu-handlers"
import { registerContextMenuLifecycle } from "~extension/context-menu-lifecycle"
import {
  registerVisitReminderLifecycle,
} from "~extension/visit-reminder-lifecycle"
import { isExtensionCommand } from "~extension/commands"
import { initializeOnInstall } from "~extension/install-handler"
import { createExtensionMessageRouter } from "~extension/message-router"

const saveDeps = {
  action: chrome.action,
  tabs: chrome.tabs,
}

const contextMenuDeps = {
  settingsStore: new ChromeLocalSettingsStore(),
  sessionStorage: chrome.storage.session,
  action: chrome.action,
}

const messageRouter = createExtensionMessageRouter(
  chrome.runtime.id,
  createLibraryApplication(
    createSaveBookmarkMessageApplication(saveDeps),
    new ChromeCategoryTemplateReceiptStore(chrome.storage.local),
  ),
)

void LocalDataLayer.open()
  .then(async (layer) => {
    try {
      const recovered = await layer.recoverStaleClassificationJobs()
      if (recovered > 0) {
        safeLogInfo("Classification job recovery", `recovered ${recovered} stale job(s)`)
      }
    } finally {
      await layer.close()
    }
  })
  .catch((error: unknown) => {
    safeLogError("Classification job recovery", error)
  })

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void messageRouter.handle(message, sender).then(sendResponse)
  return true
})

chrome.runtime.onInstalled.addListener((details) => {
  void initializeOnInstall(details.reason, chrome.storage.local, chrome.runtime, chrome.tabs).catch(
    (error: unknown) => {
      safeLogError("Install initialization", error)
    },
  )
  void new ChromeLocalSettingsStore().get().catch((error: unknown) => {
    safeLogError("Local settings initialization", error)
  })
})

registerContextMenuLifecycle(chrome.runtime, chrome.storage)

registerVisitReminderLifecycle(chrome)

chrome.contextMenus.onClicked.addListener((info) => {
  void handleContextMenuClick(info, contextMenuDeps).catch((error: unknown) => {
    safeLogError("Context menu click", error)
  })
})

chrome.commands.onCommand.addListener((command) => {
  if (!isExtensionCommand(command)) {
    safeLogWarning("Command handler", `ignored unknown command: ${command}`)
    return
  }

  void handleExtensionCommand(
    command,
    chrome.runtime,
    chrome.tabs,
    chrome.windows,
    saveDeps,
  ).catch((error: unknown) => {
    safeLogError(`Command handler (${command})`, error)
  })
})

export {}
