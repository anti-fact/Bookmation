import { ChromeCategoryTemplateReceiptStore } from "~adapters"
import { createLibraryApplication } from "~application"
import { createSaveBookmarkMessageApplication } from "~application/save-bookmark-message-application"
import { LocalDataLayer } from "~/adapters"
import { safeLogError, safeLogInfo, safeLogWarning } from "~/adapters/security/log-redaction"
import { handleExtensionCommand } from "~extension/command-handlers"
import { isExtensionCommand } from "~extension/commands"
import { initializeOnInstall } from "~extension/install-handler"
import { createExtensionMessageRouter } from "~extension/message-router"

const messageRouter = createExtensionMessageRouter(
  chrome.runtime.id,
  createLibraryApplication(
    createSaveBookmarkMessageApplication({
      action: chrome.action,
      tabs: chrome.tabs,
    }),
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
    {
      action: chrome.action,
      tabs: chrome.tabs,
    },
  ).catch((error: unknown) => {
    safeLogError(`Command handler (${command})`, error)
  })
})

export {}
