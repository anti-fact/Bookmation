import { handleExtensionCommand } from "~extension/command-handlers"
import { handleExtensionMessage } from "~extension/message-handler"
import { isExtensionCommand } from "~extension/commands"
import {
  initializeOnboardingIfMissing,
} from "~extension/onboarding"
import { openDashboardWelcome } from "~extension/open-dashboard-tab"

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    void (async () => {
      await initializeOnboardingIfMissing()
      await openDashboardWelcome(chrome.runtime, chrome.tabs)
    })().catch((error: unknown) => {
      console.error("[Bookmation] Install handler failed:", error)
    })
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleExtensionMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      console.error("[Bookmation] Message handler failed:", error)
      sendResponse({
        ok: false,
        requestId: "unknown",
        code: "UNKNOWN",
        message: "処理に失敗しました。",
      })
    })
  return true
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
  ).catch((error: unknown) => {
    console.error("[Bookmation] Command handler failed:", command, error)
  })
})

export {}
