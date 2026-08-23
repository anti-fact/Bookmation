import { render, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ClassificationHost } from "./ClassificationHost"

describe("ClassificationHost", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("claims a job, classifies against returned labels, and applies tag IDs", async () => {
    const prompt = vi.fn(async () =>
      JSON.stringify({ outcome: "SUCCEEDED", tagIds: ["tag-ts"] })
    )
    const destroy = vi.fn()
    vi.stubGlobal("LanguageModel", {
      availability: vi.fn(async () => "available" as const),
      create: vi.fn(async () => ({ destroy, prompt }))
    })
    const sendMessage = vi.fn(async (message: unknown) => {
      const request = message as { action: string; requestId: string }
      if (request.action === "claim-classification-job") {
        return {
          requestId: request.requestId,
          ok: true,
          data: {
            job: { id: "job-1" },
            bookmark: {
              revision: 1,
              title: "TypeScript handbook",
              normalizedUrl: "https://typescriptlang.org/docs/"
            },
            labels: [
              { id: "category-dev", kind: "CATEGORY", name: "Development" },
              {
                id: "tag-ts",
                kind: "TAG",
                name: "TypeScript",
                parentCategoryId: "category-dev"
              }
            ]
          }
        }
      }
      return { requestId: request.requestId, ok: true, data: {} }
    })
    vi.stubGlobal("chrome", { runtime: { sendMessage } })

    const view = render(<ClassificationHost />)

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "apply-classification-result",
          payload: expect.objectContaining({
            jobId: "job-1",
            outcome: "SUCCEEDED",
            tagIds: ["tag-ts"]
          }),
          source: "ai-host"
        })
      )
    )
    expect(prompt).toHaveBeenCalledWith(
      expect.stringContaining('"id":"tag-ts"'),
      expect.any(Object)
    )
    expect(destroy).toHaveBeenCalledTimes(1)
    view.unmount()
  })
})
