import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { LabelsPage } from "./LabelsPage"
import type {
  LabelManagementPort,
  ManagedCategory
} from "./label-management-port"

const catalog: ManagedCategory[] = [
  {
    id: "category-dev",
    name: "開発",
    origin: "USER",
    revision: 2,
    tags: [
      {
        id: "tag-ts",
        name: "TypeScript",
        origin: "USER",
        parentCategoryId: "category-dev",
        parentCategoryName: "開発",
        revision: 3,
        usageCount: 4
      }
    ]
  }
]

function createPort(): LabelManagementPort {
  return {
    createCategory: vi.fn(async ({ name }) => ({
      id: "new",
      name,
      revision: 1
    })),
    createTag: vi.fn(async ({ category, name }) => ({
      id: "new-tag",
      name,
      origin: "USER",
      parentCategoryId: category.id,
      parentCategoryName: category.name,
      revision: 1,
      usageCount: 0
    })),
    deleteCategory: vi.fn(async () => undefined),
    deleteTag: vi.fn(async () => undefined),
    getCategoryDetail: vi.fn(async () => ({
      activeTagCount: 1,
      activeTags: [{ id: "tag-ts", name: "TypeScript", revision: 3 }],
      category: { id: "category-dev", name: "開発", revision: 2 },
      impactFingerprint: "impact",
      referencedActiveBookmarkCount: 4
    })),
    list: vi.fn(async () => catalog),
    searchCategories: vi.fn(async () => catalog),
    updateTag: vi.fn(async () => undefined)
  }
}

describe("LabelsPage", () => {
  it("navigates by category and tag in view mode", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <LabelsPage
        createRequest={null}
        manageMode={false}
        onCreateRequestHandled={vi.fn()}
        onNavigate={onNavigate}
        port={createPort()}
      />
    )

    await user.click(await screen.findByRole("button", { name: "#開発" }))
    await user.click(screen.getByRole("button", { name: "#TypeScript" }))
    expect(onNavigate).toHaveBeenNthCalledWith(1, {
      id: "category-dev",
      kind: "category"
    })
    expect(onNavigate).toHaveBeenNthCalledWith(2, { id: "tag-ts", kind: "tag" })
  })

  it("opens management details and creates categories continuously", async () => {
    const user = userEvent.setup()
    const port = createPort()
    const { rerender } = render(
      <LabelsPage
        createRequest={null}
        manageMode
        onCreateRequestHandled={vi.fn()}
        onNavigate={vi.fn()}
        port={port}
      />
    )

    await user.click(await screen.findByRole("button", { name: "#開発" }))
    const dialog = await screen.findByRole("dialog", { name: "#開発を管理" })
    expect(within(dialog).getByText("関連ブックマーク: 4件")).not.toBeNull()
    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }))

    rerender(
      <LabelsPage
        createRequest={{ id: 1, kind: "category" }}
        manageMode
        onCreateRequestHandled={vi.fn()}
        onNavigate={vi.fn()}
        port={port}
      />
    )
    await user.type(
      await screen.findByRole("textbox", { name: "名前" }),
      "仕事"
    )
    await user.click(screen.getByRole("button", { name: "作成して続ける" }))
    await waitFor(() =>
      expect(port.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: "仕事" })
      )
    )
    expect(
      screen.getByRole("dialog", { name: "カテゴリを作成" })
    ).not.toBeNull()
  })
})
