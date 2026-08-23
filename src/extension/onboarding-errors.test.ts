import { describe, expect, it } from "vitest"

import { parseExtensionMessage } from "./messages"
import { toOnboardingRequestToken } from "./onboarding-errors"

describe("onboarding request ids", () => {
  it("replaces dots so message-router accepts preset-based ids", () => {
    expect(toOnboardingRequestToken("study.lecture")).toBe("study_lecture")

    const requestId = `onboarding:${crypto.randomUUID()}:tag:study_lecture:0`
    expect(
      parseExtensionMessage({
        action: "create-tag",
        payload: {
          expectedParentRevision: 1,
          name: "授業ページ",
          parentCategoryId: "category-id"
        },
        requestId,
        schemaVersion: 1,
        source: "dashboard"
      })
    ).not.toBeNull()
  })
})
