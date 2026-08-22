export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"

export interface OnboardingState {
  schemaVersion: 1
  status: OnboardingStatus
  currentStepId: string | null
  initializedBy: "INSTALL"
  updatedAt: number
}

const STORAGE_KEY = "bookmation_onboarding_state"

type StorageLocal = Pick<typeof chrome.storage.local, "get" | "set">

export async function getOnboardingState(
  storage: StorageLocal = chrome.storage.local,
): Promise<OnboardingState | null> {
  const result = await storage.get(STORAGE_KEY)
  const raw = result[STORAGE_KEY]
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return null
  }
  return raw as OnboardingState
}

export async function initializeOnboardingIfMissing(
  storage: StorageLocal = chrome.storage.local,
  now: number = Date.now(),
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
    updatedAt: now,
  }
  await storage.set({ [STORAGE_KEY]: created })
  return created
}
