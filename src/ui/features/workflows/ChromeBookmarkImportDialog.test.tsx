import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { ChromeBookmarkImportDialog } from "./ChromeBookmarkImportDialog"

describe("ChromeBookmarkImportDialog", () => {
  it("does not request a preview until the user starts and requires a parent for a new tag", async () => {
    const user = userEvent.setup()
    const prepare = vi.fn().mockResolvedValue({
      categories: [{ id: "category-dev", name: "開発", revision: 1 }],
      groups: [
        {
          bookmarks: [
            { id: "bookmark-1", title: "React", url: "https://react.dev/" }
          ],
          folderName: "Frontend",
          id: "group-1",
          resolution: {
            kind: "NEW",
            parentCategoryId: null,
            tagName: "Frontend"
          },
          sourcePath: "Work / Frontend"
        }
      ]
    })
    const confirm = vi
      .fn()
      .mockResolvedValue({ failed: [], importedCount: 1, skippedCount: 0 })
    render(
      <ChromeBookmarkImportDialog
        port={{ createCategory: vi.fn(), prepare, confirm }}
      />
    )

    expect(prepare).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole("button", { name: "Chromeブックマークを取り込む" })
    )
    expect(
      await screen.findByText(
        "新規タグを取り込むには親カテゴリを選択してください。"
      )
    ).not.toBeNull()
    expect(
      screen.getByRole("button", { name: "取り込む" }).hasAttribute("disabled")
    ).toBe(true)

    await user.click(
      screen.getByRole("combobox", { name: "Frontendの親カテゴリ" })
    )
    await user.click(screen.getByRole("option", { name: "開発" }))
    await user.click(screen.getByRole("button", { name: "取り込む" }))

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        groups: [
          { groupId: "group-1", parentCategoryId: "category-dev", skip: false }
        ]
      })
    )
    expect(await screen.findByText("1件を取り込みました。")).not.toBeNull()
  })
})
