import { describe, expect, it } from "vitest"
import {
  GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildClassificationPromptInput,
  policyFromGranularity,
} from "~/domain"

describe("GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT", () => {
  it("uses promptVersion v6, forbids Tag CREATE, and requires the full valid tag list", () => {
    expect(PROMPT_VERSION).toBe("gemini-nano-tag-classifier-v6")
    expect(GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT).toContain(
      '"action":"REUSE"',
    )
    expect(GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "TagのCREATEは禁止する",
    )
    expect(GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "CREATEを返さない",
    )
    expect(GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "ページ上の根拠文字列を優先する",
    )
    expect(GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "有効なTagの完全な一覧",
    )
    expect(GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "先頭Categoryを既定値にしない",
    )
  })
})

describe("buildClassificationPromptInput", () => {
  it("attaches the valid tag list to every category, not only the first", () => {
    const input = buildClassificationPromptInput({
      policy: policyFromGranularity(2),
      bookmark: {
        title: "YouTube で音楽を聴く",
        normalizedUrl: "https://www.youtube.com/watch?v=example",
      },
      categories: [
        { id: "cat-tools", name: "ツール", revision: 1 },
        { id: "cat-hobby", name: "趣味", revision: 1 },
      ],
      existingTags: [
        {
          id: "tag-github",
          name: "GitHub",
          origin: "USER",
          revision: 1,
          parentCategoryId: "cat-tools",
          parentCategoryRevision: 1,
        },
        {
          id: "tag-youtube",
          name: "YouTube",
          origin: "USER",
          revision: 1,
          parentCategoryId: "cat-hobby",
          parentCategoryRevision: 1,
        },
      ],
      retryContext: null,
    })

    expect(input.categories.map((c) => c.id)).toEqual([
      "cat-hobby",
      "cat-tools",
    ])
    expect(input.categories[0]?.tags).toEqual([
      {
        id: "tag-youtube",
        name: "YouTube",
        origin: "USER",
        revision: 1,
      },
    ])
    expect(input.categories[1]?.tags).toEqual([
      {
        id: "tag-github",
        name: "GitHub",
        origin: "USER",
        revision: 1,
      },
    ])
    expect(input.existingTags.map((t) => t.id).sort()).toEqual([
      "tag-github",
      "tag-youtube",
    ])
  })
})
