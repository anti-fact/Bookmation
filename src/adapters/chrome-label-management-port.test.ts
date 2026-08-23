import { describe, expect, it, vi } from "vitest"

import { createChromeLabelManagementPort } from "./chrome-label-management-port"

describe("createChromeLabelManagementPort", () => {
  it("updates a category with optimistic revision control", async () => {
    const sendMessage = vi.fn(async (message: unknown) => {
      const request = message as { requestId: string }
      return {
        data: {
          categoryId: "category-dev",
          name: "ソフトウェア開発",
          revision: 3
        },
        ok: true,
        requestId: request.requestId
      }
    })
    const port = createChromeLabelManagementPort(sendMessage)

    await expect(
      port.updateCategory({
        category: { id: "category-dev", name: "開発", revision: 2 },
        name: "ソフトウェア開発"
      })
    ).resolves.toEqual({
      id: "category-dev",
      name: "ソフトウェア開発",
      revision: 3
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update-category",
        payload: {
          categoryId: "category-dev",
          expectedRevision: 2,
          name: "ソフトウェア開発"
        },
        schemaVersion: 1,
        source: "dashboard"
      })
    )
  })
})
