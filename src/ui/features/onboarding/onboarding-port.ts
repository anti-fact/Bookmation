import type { OnboardingState } from "~/extension/onboarding"

import type { CategoryPresetSelection } from "./OnboardingCategoriesPage"

export interface OnboardingPort {
  complete(selection: CategoryPresetSelection): Promise<OnboardingState>
  load(): Promise<OnboardingState | null>
  saveSelection(selection: CategoryPresetSelection): Promise<OnboardingState>
  start(): Promise<OnboardingState>
}

const now = () => Date.now()
const fallback = (status: OnboardingState["status"]): OnboardingState => ({
  categorySelection: {},
  currentStepId: status === "COMPLETED" ? null : "categories",
  initializedBy: "INSTALL",
  schemaVersion: 1,
  status,
  updatedAt: now()
})

export const emptyOnboardingPort: OnboardingPort = {
  complete: async () => fallback("COMPLETED"),
  load: async () => null,
  saveSelection: async () => fallback("IN_PROGRESS"),
  start: async () => fallback("IN_PROGRESS")
}
