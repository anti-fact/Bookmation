import { createLibraryApplication } from "~application"
import { createSaveBookmarkMessageApplication } from "~application/save-bookmark-message-application"
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
  ),
)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void messageRouter.handle(message, sender).then(sendResponse)
  return true
})

chrome.runtime.onInstalled.addListener((details) => {
  void initializeOnInstall(details.reason, chrome.storage.local, chrome.runtime, chrome.tabs).catch(
    (error: unknown) => {
      console.error("[Bookmation] Install initialization failed:", error)
    },
  )
})

chrome.commands.onCommand.addListener((command) => {
  if (!isExtensionCommand(command)) {
    console.warn("[Bookmation] Ignored unknown command:", command)
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
    console.error("[Bookmation] Command handler failed:", command, error)
  })
})

export {}
