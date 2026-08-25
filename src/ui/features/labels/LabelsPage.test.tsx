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
    updateCategory: vi.fn(async ({ category, name }) => ({
      ...category,
      name,
      revision: category.revision + 1
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

    const category = await screen.findByRole("button", { name: "#開発" })
    const tag = screen.getByRole("button", { name: "#TypeScript" })
    const categoryClassNames = category.className.split(" ")
    expect(category.style.clipPath).toContain("calc(100% - 29px)")
    expect(categoryClassNames).toContain("h-[63px]")
    expect(categoryClassNames).toContain("pl-[41px]")
    expect(categoryClassNames).toContain("pr-[41px]")
    expect(categoryClassNames).toContain("bg-bm-black")
    expect(categoryClassNames).toContain("text-bm-paper")
    expect(categoryClassNames).not.toContain("w-full")
    expect(categoryClassNames).toContain("text-2xl")
    expect(tag.parentElement?.className).not.toContain("bg-bm-paper")
    expect(tag.className).toContain("bg-bm-accent")
    expect(tag.className).toContain("hover:bg-bm-ink")

    await user.click(category)
    await user.click(tag)
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
    const categoryDelete = within(dialog).getByRole("button", {
      name: "カテゴリと子タグを削除"
    })
    expect(categoryDelete.className).toContain("bg-bm-danger")
    expect(categoryDelete.className).toContain("text-bm-paper")
    const categoryName = within(dialog).getByRole("textbox", { name: "名前" })
    await user.clear(categoryName)
    await user.type(categoryName, "ソフトウェア開発")
    await user.click(within(dialog).getByRole("button", { name: "保存する" }))
    await waitFor(() =>
      expect(port.updateCategory).toHaveBeenCalledWith({
        category: catalog[0],
        name: "ソフトウェア開発"
      })
    )

    await user.click(screen.getByRole("button", { name: "#TypeScript" }))
    const tagDialog = await screen.findByRole("dialog", {
      name: "#TypeScriptを編集"
    })
    const tagDelete = within(tagDialog).getByRole("button", {
      name: "タグを削除"
    })
    expect(tagDelete.className).toContain("bg-bm-danger")
    expect(tagDelete.className).toContain("text-bm-paper")

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

  it("deletes a category only after showing and confirming its impact", async () => {
    const user = userEvent.setup()
    const port = createPort()
    render(
      <LabelsPage
        createRequest={null}
        manageMode
        onCreateRequestHandled={vi.fn()}
        onNavigate={vi.fn()}
        port={port}
      />
    )

    await user.click(await screen.findByRole("button", { name: "#開発" }))
    const editor = await screen.findByRole("dialog", { name: "#開発を管理" })
    const deleteButton = within(editor).getByRole("button", {
      name: "カテゴリと子タグを削除"
    })
    await waitFor(() =>
      expect((deleteButton as HTMLButtonElement).disabled).toBe(false)
    )
    await user.click(deleteButton)

    const warning = await screen.findByRole("alertdialog", {
      name: "カテゴリ「#開発」を削除しますか？"
    })
    expect(port.deleteCategory).not.toHaveBeenCalled()
    expect(within(warning).getByText("1件", { selector: "dd" })).not.toBeNull()
    expect(within(warning).getByText("4件", { selector: "dd" })).not.toBeNull()
    expect(within(warning).getByText("#TypeScript")).not.toBeNull()

    await user.click(
      within(warning).getByRole("button", { name: "キャンセル" })
    )
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
      expect(document.activeElement).toBe(deleteButton)
    })
    expect(port.deleteCategory).not.toHaveBeenCalled()

    await user.click(deleteButton)
    const reopenedWarning = await screen.findByRole("alertdialog")
    await user.click(
      within(reopenedWarning).getByRole("button", { name: "削除する" })
    )

    await waitFor(() =>
      expect(port.deleteCategory).toHaveBeenCalledWith({
        detail: expect.objectContaining({
          impactFingerprint: "impact",
          referencedActiveBookmarkCount: 4
        }),
        requestId: expect.stringMatching(/^category-delete:/)
      })
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  })

  it("refreshes a stale category deletion preview before allowing retry", async () => {
    const user = userEvent.setup()
    const port = createPort()
    const firstDetail = {
      activeTagCount: 1,
      activeTags: [{ id: "tag-ts", name: "TypeScript", revision: 3 }],
      category: { id: "category-dev", name: "開発", revision: 2 },
      impactFingerprint: "impact-before",
      referencedActiveBookmarkCount: 4
    }
    const latestDetail = {
      activeTagCount: 2,
      activeTags: [
        { id: "tag-ts", name: "TypeScript", revision: 3 },
        { id: "tag-react", name: "React", revision: 1 }
      ],
      category: { id: "category-dev", name: "開発", revision: 3 },
      impactFingerprint: "impact-after",
      referencedActiveBookmarkCount: 6
    }
    vi.mocked(port.getCategoryDetail)
      .mockResolvedValueOnce(firstDetail)
      .mockResolvedValueOnce(latestDetail)
    vi.mocked(port.deleteCategory)
      .mockRejectedValueOnce(new Error("CATEGORY_DELETE_PREVIEW_STALE"))
      .mockResolvedValueOnce(undefined)

    render(
      <LabelsPage
        createRequest={null}
        manageMode
        onCreateRequestHandled={vi.fn()}
        onNavigate={vi.fn()}
        port={port}
      />
    )

    await user.click(await screen.findByRole("button", { name: "#開発" }))
    const editor = await screen.findByRole("dialog", { name: "#開発を管理" })
    const deleteButton = within(editor).getByRole("button", {
      name: "カテゴリと子タグを削除"
    })
    await waitFor(() =>
      expect((deleteButton as HTMLButtonElement).disabled).toBe(false)
    )
    await user.click(deleteButton)
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "削除する"
      })
    )

    const warning = await screen.findByRole("alertdialog")
    expect(
      await within(warning).findByText(
        "削除対象が更新されました。最新の内容を確認して、もう一度削除してください"
      )
    ).not.toBeNull()
    expect(within(warning).getByText("2件", { selector: "dd" })).not.toBeNull()
    expect(within(warning).getByText("6件", { selector: "dd" })).not.toBeNull()
    expect(within(warning).getByText("#React")).not.toBeNull()
    expect(port.deleteCategory).toHaveBeenCalledOnce()

    await user.click(within(warning).getByRole("button", { name: "削除する" }))

    await waitFor(() => expect(port.deleteCategory).toHaveBeenCalledTimes(2))
    const firstRequest = vi.mocked(port.deleteCategory).mock.calls[0]?.[0]
    const secondRequest = vi.mocked(port.deleteCategory).mock.calls[1]?.[0]
    expect(firstRequest?.detail).toEqual(firstDetail)
    expect(secondRequest?.detail).toEqual(latestDetail)
    expect(secondRequest?.requestId).not.toBe(firstRequest?.requestId)
  })

  it("keeps tag deletion immediate without opening a warning dialog", async () => {
    const user = userEvent.setup()
    const port = createPort()
    render(
      <LabelsPage
        createRequest={null}
        manageMode
        onCreateRequestHandled={vi.fn()}
        onNavigate={vi.fn()}
        port={port}
      />
    )

    await user.click(await screen.findByRole("button", { name: "#TypeScript" }))
    const editor = await screen.findByRole("dialog", {
      name: "#TypeScriptを編集"
    })
    await user.click(within(editor).getByRole("button", { name: "タグを削除" }))

    await waitFor(() =>
      expect(port.deleteTag).toHaveBeenCalledWith({
        id: "tag-ts",
        revision: 3
      })
    )
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })
})
