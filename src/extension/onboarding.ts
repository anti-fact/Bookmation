export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"

export interface OnboardingState {
  schemaVersion: 1
  status: OnboardingStatus
  currentStepId: string | null
  initializedBy: "INSTALL"
  updatedAt: number
  categorySelection?: Record<string, string[]>
  applyRequestId?: string
}

export const ONBOARDING_STATE_KEY = "bookmation_onboarding_state"

export type OnboardingStorage = {
  get(key: string): Promise<Record<string, unknown>>
  set(value: Record<string, unknown>): Promise<void>
}

export async function getOnboardingState(
  storage: OnboardingStorage = chrome.storage.local
): Promise<OnboardingState | null> {
  const result = await storage.get(ONBOARDING_STATE_KEY)
  const raw = result[ONBOARDING_STATE_KEY]
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return null
  }
  const candidate = raw as Record<string, unknown>
  if (
    candidate.schemaVersion !== 1 ||
    (candidate.status !== "NOT_STARTED" &&
      candidate.status !== "IN_PROGRESS" &&
      candidate.status !== "COMPLETED") ||
    (candidate.currentStepId !== null &&
      typeof candidate.currentStepId !== "string") ||
    candidate.initializedBy !== "INSTALL" ||
    typeof candidate.updatedAt !== "number"
  )
    return null
  return candidate as unknown as OnboardingState
}

export async function initializeOnboardingIfMissing(
  storage: OnboardingStorage = chrome.storage.local,
  now: number = Date.now()
): Promise<OnboardingState> {
  const existing = await getOnboardingState(storage)
  if (existing) {
    return existing
  }

  const created: OnboardingState = {
    schemaVersion: 1,
    status: "NOT_STARTED",
    currentStepId: "welcome",
    initializedBy: "INSTALL",
    updatedAt: now
  }
  await storage.set({ [ONBOARDING_STATE_KEY]: created })
  return created
}
