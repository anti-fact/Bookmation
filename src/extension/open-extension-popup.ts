import { safeLogWarning } from "~/adapters/security/log-redaction"

export type ExtensionPopupAction = Pick<typeof chrome.action, "openPopup">

export async function openExtensionPopup(action: ExtensionPopupAction): Promise<void> {
  try {
    await action.openPopup()
  } catch (error: unknown) {
    safeLogWarning(
      "Extension popup",
      error instanceof Error ? error.message : "openPopup failed",
    )
  }
}
