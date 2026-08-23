import { describe, expect, it, vi } from "vitest"

import {
  classifyBookmarkWithLocalPrompt,
  parseLocalClassificationResult
} from "./chrome-prompt-classifier"

describe("chrome prompt classifier", () => {
  it("accepts only candidate tag IDs and removes duplicates", () => {
    expect(
      parseLocalClassificationResult(
        { outcome: "SUCCEEDED", tagIds: ["tag-ts", "tag-ts"] },
        new Set(["tag-ts"])
      )
    ).toEqual({ outcome: "SUCCEEDED", tagIds: ["tag-ts"] })
    expect(
      parseLocalClassificationResult(
        { outcome: "SUCCEEDED", tagIds: ["unknown"] },
        new Set(["tag-ts"])
      )
    ).toBeNull()
  })

  it("passes active candidates to Prompt API and destroys the session", async () => {
    const destroy = vi.fn()
    const prompt = vi.fn(async () =>
      JSON.stringify({ outcome: "SUCCEEDED", tagIds: ["tag-ts"] })
    )
    const promptApi = {
      availability: vi.fn(async () => "available" as const),
      create: vi.fn(async () => ({ destroy, prompt }))
    }

    await expect(
      classifyBookmarkWithLocalPrompt(promptApi, {
        title: "TypeScript handbook",
        normalizedUrl: "https://typescriptlang.org/docs/",
        tags: [
          {
            id: "tag-ts",
            name: "TypeScript",
            parentCategoryId: "category-dev",
            parentCategoryName: "Development"
          }
        ]
      })
    ).resolves.toEqual({ outcome: "SUCCEEDED", tagIds: ["tag-ts"] })
    expect(prompt).toHaveBeenCalledWith(
      expect.stringContaining('"id":"tag-ts"'),
      expect.objectContaining({ responseConstraint: expect.any(Object) })
    )
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
