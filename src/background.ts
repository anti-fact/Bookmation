import { handleExtensionCommand } from "~extension/command-handlers"
import { isExtensionCommand } from "~extension/commands"

chrome.commands.onCommand.addListener((command) => {
  if (!isExtensionCommand(command)) {
    console.warn("[Bookmation] Ignored unknown command:", command)
    return
  }

  void handleExtensionCommand(command, chrome.runtime, chrome.tabs).catch(
    (error: unknown) => {
      console.error("[Bookmation] Command handler failed:", command, error)
    }
  )
})

export {}
