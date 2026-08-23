export const POPUP_SAVE_FEEDBACK_STORAGE_KEY = "bookmation.popup-save-feedback-v1"

export type PopupSaveFeedbackStatus = "saved" | "duplicate"

export type PopupSaveFeedbackRecord = Readonly<{
  status: PopupSaveFeedbackStatus
  recordedAt: number
}>

export type PopupSaveFeedbackStorage = Readonly<{
  get(keys: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string): Promise<void>
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isPopupSaveFeedbackRecord(value: unknown): value is PopupSaveFeedbackRecord {
  if (!isRecord(value)) {
    return false
  }
  return (
    (value.status === "saved" || value.status === "duplicate") &&
    typeof value.recordedAt === "number"
  )
}

export async function recordPopupSaveFeedback(
  storage: PopupSaveFeedbackStorage,
  status: PopupSaveFeedbackStatus,
): Promise<void> {
  await storage.set({
    [POPUP_SAVE_FEEDBACK_STORAGE_KEY]: {
      status,
      recordedAt: Date.now(),
    },
  })
}

export async function readPopupSaveFeedback(
  storage: PopupSaveFeedbackStorage,
): Promise<PopupSaveFeedbackStatus | null> {
  const result = await storage.get(POPUP_SAVE_FEEDBACK_STORAGE_KEY)
  const record = result[POPUP_SAVE_FEEDBACK_STORAGE_KEY]
  if (!isPopupSaveFeedbackRecord(record)) {
    return null
  }
  return record.status
}

export async function clearPopupSaveFeedback(storage: PopupSaveFeedbackStorage): Promise<void> {
  await storage.remove(POPUP_SAVE_FEEDBACK_STORAGE_KEY)
}
