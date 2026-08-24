import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { ShareSettingsSection } from "./ShareSettingsSection"

describe("ShareSettingsSection", () => {
  it("filters individual bookmarks by title and description while typing", async () => {
    const user = userEvent.setup()
    render(
      <ShareSettingsSection
        port={{
          connectDrive: vi.fn(),
          exportBookmarks: vi.fn(),
          load: vi.fn().mockResolvedValue({
            drive: null,
            items: [
              {
                bookmarkIds: ["bookmark-react"],
                description: "react.dev",
                id: "bookmark-react",
                kind: "BOOKMARK",
                label: "React Reference"
              },
              {
                bookmarkIds: ["bookmark-ts"],
                description: "typescriptlang.org",
                id: "bookmark-ts",
                kind: "BOOKMARK",
                label: "TypeScript Handbook"
              }
            ]
          }),
          openQrReader: vi.fn()
        }}
      />
    )

    const search = await screen.findByRole("searchbox", {
      name: "共有対象を検索"
    })
    await user.type(search, "typescriptlang")

    expect(screen.queryByText("React Reference")).toBeNull()
    expect(screen.getByText("TypeScript Handbook")).not.toBeNull()
  })

  it("deduplicates bookmark ids and preserves selection when QR capacity is exceeded", async () => {
    const user = userEvent.setup()
    const exportBookmarks = vi
      .fn()
      .mockResolvedValue({ status: "QR_CAPACITY_EXCEEDED" })
    render(
      <ShareSettingsSection
        port={{
          connectDrive: vi.fn(),
          exportBookmarks,
          load: vi.fn().mockResolvedValue({
            drive: null,
            items: [
              {
                bookmarkIds: ["a", "b"],
                id: "category",
                kind: "CATEGORY",
                label: "開発"
              },
              { bookmarkIds: ["b"], id: "tag", kind: "TAG", label: "React" }
            ]
          }),
          openQrReader: vi.fn()
        }}
      />
    )

    const search = await screen.findByRole("searchbox", {
      name: "共有対象を検索"
    })
    expect(search.className).toContain("h-10")
    expect(search.className).toContain("max-w-md")

    await user.click(await screen.findByRole("checkbox", { name: /開発/ }))
    await user.click(screen.getByRole("checkbox", { name: /React/ }))
    expect(screen.getByText("重複を除いた選択: 2件")).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "QRコードを生成" }))

    await waitFor(() =>
      expect(exportBookmarks).toHaveBeenCalledWith(["a", "b"], "QR")
    )
    expect(screen.getByRole("alert").textContent).toContain(
      "容量を超えています"
    )
    expect(screen.getByText("重複を除いた選択: 2件")).not.toBeNull()
  })
})
