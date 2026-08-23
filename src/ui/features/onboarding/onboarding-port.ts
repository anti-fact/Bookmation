import type { OnboardingState } from "~/extension/onboarding"
import type { OnboardingReconcileResult } from "~/extension/onboarding-draft"

import type { CategoryPresetSelection } from "./OnboardingCategoriesPage"

export interface OnboardingPort {
  complete(selection: CategoryPresetSelection): Promise<OnboardingState>
  load(): Promise<OnboardingState | null>
  loadWithMeta(): Promise<OnboardingReconcileResult | null>
  saveSelection(selection: CategoryPresetSelection): Promise<OnboardingState>
  skip(): Promise<OnboardingState>
  start(): Promise<OnboardingState>
}

const now = () => Date.now()
const fallback = (status: OnboardingState["status"]): OnboardingState => ({
  catalogVersion: undefined,
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
  loadWithMeta: async () => null,
  saveSelection: async () => fallback("IN_PROGRESS"),
  skip: async () => fallback("COMPLETED"),
  start: async () => fallback("IN_PROGRESS")
}
