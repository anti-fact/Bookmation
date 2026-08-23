/**
 * Gemini Nano ClassificationProvider の決定的モック試験
 */
import { describe, expect, it, vi } from "vitest"
import {
  buildClassificationPromptInput,
  GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT,
  policyFromGranularity,
} from "~/domain"
import { createGeminiNanoClassificationProvider } from "./gemini-nano-classification-provider"
import type { LanguageModelApi, LanguageModelSession } from "./types"

function mockLanguageModel(args: {
  availability?: "available" | "unavailable" | "downloadable"
  promptResult?: string
  createError?: Error
}): LanguageModelApi {
  const session: LanguageModelSession = {
    prompt: vi.fn().mockResolvedValue(
      args.promptResult ??
        JSON.stringify({
          outcome: "CLASSIFIED",
          categoryId: "cat-tech",
          tagDecisions: [
            {
              action: "CREATE",
              name: "Vitest",
              importance: "CORE",
              evidenceText: "Vitest",
              confidence: 0.9,
            },
          ],
          reviewReasonCode: "NONE",
        }),
    ),
    destroy: vi.fn(),
  }
  return {
    availability: vi
      .fn()
      .mockResolvedValue(args.availability ?? "available"),
    create: args.createError
      ? vi.fn().mockRejectedValue(args.createError)
      : vi.fn().mockResolvedValue(session),
  }
}

describe("createGeminiNanoClassificationProvider", () => {
  it("reports AVAILABLE when LanguageModel is ready", async () => {
    const lm = mockLanguageModel({})
    const provider = createGeminiNanoClassificationProvider({ languageModel: lm })
    await expect(provider.capability()).resolves.toEqual({
      state: "AVAILABLE",
      providerModel: "chrome-prompt-api",
    })
  })

  it("calls Prompt API with fixed system prompt and canonical user JSON", async () => {
    const lm = mockLanguageModel({})
    const provider = createGeminiNanoClassificationProvider({ languageModel: lm })
    const input = buildClassificationPromptInput({
      policy: policyFromGranularity(2),
      bookmark: {
        title: "Vitest Unit Testing Guide",
        normalizedUrl: "https://example.test/docs/vitest-guide",
      },
      categories: [
        { id: "cat-tech", name: "Technology", revision: 1 },
        { id: "cat-life", name: "Lifestyle", revision: 1 },
      ],
      existingTags: [
        {
          id: "tag-vitest",
          name: "Vitest",
          origin: "USER",
          revision: 1,
          parentCategoryId: "cat-tech",
          parentCategoryRevision: 1,
        },
        {
          id: "tag-recipe",
          name: "Recipe",
          origin: "USER",
          revision: 1,
          parentCategoryId: "cat-life",
          parentCategoryRevision: 1,
        },
      ],
      retryContext: null,
    })

    const output = await provider.classify(input)
    expect(lm.create).toHaveBeenCalled()
    const createArg = (lm.create as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(createArg.initialPrompts[0].role).toBe("system")
    expect(createArg.initialPrompts[0].content).toBe(
      GEMINI_NANO_TAG_CLASSIFIER_SYSTEM_PROMPT,
    )

    const session = await (lm.create as ReturnType<typeof vi.fn>).mock.results[0]!
      .value
    expect(session.prompt).toHaveBeenCalled()
    const [userMessage, options] = session.prompt.mock.calls[0]!
    expect(userMessage).toContain('"promptVersion"')
    expect(userMessage).toContain("gemini-nano-tag-classifier-v6")
    expect(userMessage).toContain('"name":"Technology"')
    expect(userMessage).toContain('"name":"Vitest"')
    expect(userMessage).toContain('"name":"Lifestyle"')
    expect(userMessage).toContain('"name":"Recipe"')
    expect(options.responseConstraint.required).toContain("outcome")
    expect(output.parsed).toMatchObject({ outcome: "CLASSIFIED" })
    expect(session.destroy).toHaveBeenCalled()
  })

  it("maps create failure to PROMPT_SESSION_FAILED", async () => {
    const lm = mockLanguageModel({ createError: new Error("boom") })
    const provider = createGeminiNanoClassificationProvider({ languageModel: lm })
    const input = buildClassificationPromptInput({
      policy: policyFromGranularity(2),
      bookmark: { title: "t", normalizedUrl: "https://example.test/x" },
      categories: [{ id: "c", name: "C", revision: 1 }],
      existingTags: [],
      retryContext: null,
    })
    await expect(provider.classify(input)).rejects.toMatchObject({
      code: "PROMPT_SESSION_FAILED",
    })
  })
})
