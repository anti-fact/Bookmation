import type { ExtensionCommand } from "~/extension/commands"
import type { PopupSaveFeedbackStatus } from "~/extension/popup-save-feedback"

export type PopupShortcuts = Record<ExtensionCommand, string | null>

export type PopupSaveResult = Readonly<{
  status: "saved" | "duplicate"
}>
/**
 * popup画面とChrome API／Service Workerの境界です。
 * Webプレビューとcomponent testでは、このPortをfakeへ差し替えます。
 */
export interface PopupPort {
  getShortcuts(): Promise<PopupShortcuts>
  getPendingSaveFeedback(): Promise<PopupSaveFeedbackStatus | null>
  clearSaveFeedback(): Promise<void>
  onSaveFeedbackChanged(
    listener: (status: PopupSaveFeedbackStatus) => void,
  ): () => void
  openHome(): Promise<void>
  openShortcutSettings(): Promise<void>
  saveCurrentPage(): Promise<PopupSaveResult>
}

export class PopupPortError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "PopupPortError"
  }
}
