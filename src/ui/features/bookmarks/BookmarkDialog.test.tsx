import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import {
  BookmarkFormPortError,
  type BookmarkCategoryOption,
  type BookmarkFormPort,
  type BookmarkTagOption
} from "./bookmark-form-port"
import { BookmarkDialog, type BookmarkDialogMode } from "./BookmarkDialog"

const development: BookmarkCategoryOption = {
  id: "category-development",
  name: "開発",
  revision: 2
}

const reading: BookmarkTagOption = {
  id: "tag-reading",
  name: "Reading",
  parentCategoryId: development.id,
  parentCategoryName: development.name,
  revision: 3
}

function createPort(overrides: Partial<BookmarkFormPort> = {}) {
  const categories = [development]
  const tags = [reading]
  const port: BookmarkFormPort = {
    createCategory: vi.fn(async ({ name }) => {
      const created = { id: "category-new", name, revision: 1 }
      categories.push(created)
      return created
    }),
    createTag: vi.fn(async ({ category, name }) => {
      const created = {
        id: "tag-new",
        name,
        parentCategoryId: category.id,
        parentCategoryName: category.name,
        revision: 1
      }
      tags.push(created)
      return created
    }),
    deleteBookmark: vi.fn().mockResolvedValue(undefined),
    saveBookmark: vi.fn().mockResolvedValue({ duplicate: false }),
    searchCategories: vi.fn(async (keyword) =>
      categories.filter((category) =>
        category.name.toLowerCase().includes(keyword.trim().toLowerCase())
      )
    ),
    searchTags: vi.fn(async (keyword) =>
      tags.filter((tag) =>
        tag.name.toLowerCase().includes(keyword.trim().toLowerCase())
      )
    ),
    updateBookmark: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
  return port
}

function renderDialog(mode: BookmarkDialogMode, port = createPort()) {
  const onComplete = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <BookmarkDialog
      mode={mode}
      onComplete={onComplete}
      onOpenChange={onOpenChange}
      open
      port={port}
    />
  )
  return { onComplete, onOpenChange, port }
}

describe("BookmarkDialog", () => {
  it("adds resolved tags one at a time and saves the add draft", async () => {
    const user = userEvent.setup()
    const { onComplete, port } = renderDialog({ kind: "add" })

    await user.type(
      screen.getByRole("textbox", { name: "URL" }),
      "https://example.com/article"
    )
    await user.type(
      screen.getByRole("textbox", { name: "タイトル（任意）" }),
      "読み物"
    )
    const tagInput = screen.getByRole("combobox", { name: "タグ" })
    await user.type(tagInput, "Reading")
    const option = await screen.findByRole("option", { name: /Reading/ })
    expect(option.textContent).toContain("カテゴリ: 開発")
    expect(option.className).toContain("hover:bg-bm-ink")
    expect(option.className).toContain("hover:text-bm-paper")
    expect(option.className).toContain("aria-selected:bg-bm-ink")
    expect(option.className).toContain("aria-selected:text-bm-paper")
    await user.click(option)
    await user.click(screen.getByRole("button", { name: "追加" }))

    expect(
      screen.getByRole("button", { name: "現在のタグ1件を隠す" })
    ).not.toBeNull()
    const selectedTag = screen.getByRole("button", {
      name: "タグ「Reading」を解除"
    })
    expect(selectedTag.className).toContain("bg-bm-ink")
    expect(selectedTag.className).toContain("text-bm-paper")
    expect(screen.getByText("#開発")).not.toBeNull()
    expect((tagInput as HTMLInputElement).value).toBe("")
    expect(document.activeElement).toBe(tagInput)

    await user.click(screen.getByRole("button", { name: "保存する" }))
    await waitFor(() => expect(port.saveBookmark).toHaveBeenCalledOnce())
    expect(port.saveBookmark).toHaveBeenCalledWith({
      requestId: expect.any(String),
      tagIds: [reading.id],
      title: "読み物",
      url: "https://example.com/article"
    })
    expect(onComplete).toHaveBeenCalledWith("ブックマークを保存しました")
  })

  it("ignores Enter during IME composition and reports unknown free text", async () => {
    const user = userEvent.setup()
    renderDialog({ kind: "add" })
    const input = screen.getByRole("combobox", { name: "タグ" })

    await user.type(input, "Reading")
    await screen.findByRole("option", { name: /Reading/ })
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    expect(
      screen.getByRole("button", { name: "現在のタグ0件を隠す" })
    ).not.toBeNull()
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: "Enter" })
    expect(
      screen.getByRole("button", { name: "現在のタグ1件を隠す" })
    ).not.toBeNull()

    await user.type(input, "存在しないタグ")
    await user.click(screen.getByRole("button", { name: "追加" }))
    expect(screen.getByRole("alert").textContent).toContain(
      "既存のタグを候補から選択してください"
    )
  })

  it("keeps the bookmark and tag drafts through category and tag side views", async () => {
    const user = userEvent.setup()
    const port = createPort({
      searchCategories: vi.fn().mockResolvedValue([])
    })
    const { onComplete } = renderDialog({ kind: "add" }, port)

    await user.type(
      screen.getByRole("textbox", { name: "URL" }),
      "https://example.com/new"
    )
    await user.type(
      screen.getByRole("textbox", { name: "タイトル（任意）" }),
      "保持するタイトル"
    )
    await user.type(
      screen.getByRole("combobox", { name: "タグ" }),
      "新しいタグ"
    )
    await user.click(screen.getByRole("button", { name: "新規作成" }))

    expect(
      screen.getByRole("dialog", { name: "タグを新規作成" })
    ).not.toBeNull()
    expect(
      (screen.getByRole("textbox", { name: "タグ名" }) as HTMLInputElement)
        .value
    ).toBe("新しいタグ")
    await user.type(
      screen.getByRole("combobox", { name: "親カテゴリ" }),
      "新カテゴリ"
    )
    await user.click(screen.getByRole("button", { name: "新規作成" }))

    expect(
      screen.getByRole("dialog", { name: "カテゴリを新規作成" })
    ).not.toBeNull()
    expect(
      (screen.getByRole("textbox", { name: "カテゴリ名" }) as HTMLInputElement)
        .value
    ).toBe("新カテゴリ")
    await user.click(screen.getByRole("button", { name: "カテゴリを作成" }))

    expect(
      await screen.findByRole("dialog", { name: "タグを新規作成" })
    ).not.toBeNull()
    expect(
      (screen.getByRole("textbox", { name: "タグ名" }) as HTMLInputElement)
        .value
    ).toBe("新しいタグ")
    expect(screen.getByText("選択中: #新カテゴリ")).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "タグを作成" }))

    expect(
      await screen.findByRole("dialog", { name: "ブックマークを追加" })
    ).not.toBeNull()
    expect(
      (screen.getByRole("textbox", { name: "URL" }) as HTMLInputElement).value
    ).toBe("https://example.com/new")
    expect(
      (
        screen.getByRole("textbox", {
          name: "タイトル（任意）"
        }) as HTMLInputElement
      ).value
    ).toBe("保持するタイトル")
    expect(
      (screen.getByRole("combobox", { name: "タグ" }) as HTMLInputElement).value
    ).toBe("新しいタグ")
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "タグ" })
    )
    expect(
      screen.getByRole("button", { name: "現在のタグ0件を隠す" })
    ).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "追加" }))
    expect(
      screen.getByRole("button", { name: "タグ「新しいタグ」を解除" })
    ).not.toBeNull()

    expect(port.createCategory).toHaveBeenCalledWith({
      name: "新カテゴリ",
      requestId: expect.any(String)
    })
    expect(port.createTag).toHaveBeenCalledWith({
      category: { id: "category-new", name: "新カテゴリ", revision: 1 },
      name: "新しいタグ",
      requestId: expect.any(String)
    })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("starts add mode at the URL field and restores tag focus after returning", async () => {
    const user = userEvent.setup()
    renderDialog({ kind: "add" })

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "URL" })
    )
    await user.click(screen.getByRole("button", { name: "新規作成" }))
    await user.click(screen.getByRole("button", { name: "戻る" }))

    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "タグ" })
    )
  })

  it("edits the shared draft and soft-deletes without a confirmation surface", async () => {
    const user = userEvent.setup()
    const bookmark = {
      categories: [{ id: development.id, name: development.name }],
      faviconSrc: "data:image/png;base64,AA==",
      id: "bookmark-one",
      revision: 7,
      savedAt: 1_000,
      siteName: "example.com",
      tags: [reading],
      thumbnailSrc: "data:image/png;base64,AA==",
      title: "編集前",
      url: "https://example.com/before"
    }
    const first = renderDialog({ bookmark, kind: "edit" })

    expect(
      screen.getByRole("button", { name: "タグ「Reading」を解除" })
    ).not.toBeNull()
    expect(screen.getByText("#開発")).not.toBeNull()
    await user.click(
      screen.getByRole("button", { name: "タグ「Reading」を解除" })
    )
    const titleInput = screen.getByRole("textbox", { name: "タイトル" })
    await user.clear(titleInput)
    await user.type(titleInput, "編集後")
    await user.click(screen.getByRole("button", { name: "保存する" }))

    await waitFor(() =>
      expect(first.port.updateBookmark).toHaveBeenCalledOnce()
    )
    expect(first.port.updateBookmark).toHaveBeenCalledWith({
      bookmarkId: bookmark.id,
      expectedRevision: 7,
      tagIds: [],
      title: "編集後",
      url: bookmark.url
    })
    expect(first.onComplete).toHaveBeenCalledWith("ブックマークを更新しました")

    const secondPort = createPort()
    renderDialog(
      { bookmark: { ...bookmark, id: "bookmark-two" }, kind: "edit" },
      secondPort
    )
    const dialogs = screen.getAllByRole("dialog", {
      name: "ブックマークを編集"
    })
    const secondDialog = dialogs.at(-1)!
    await user.click(
      within(secondDialog).getByRole("button", { name: "削除する" })
    )
    await waitFor(() =>
      expect(secondPort.deleteBookmark).toHaveBeenCalledOnce()
    )
    expect(secondPort.deleteBookmark).toHaveBeenCalledWith({
      bookmarkId: "bookmark-two",
      expectedRevision: 7
    })
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.queryByText(/取り消|Undo/)).toBeNull()
  })

  it("keeps the edit dialog and draft when deletion conflicts", async () => {
    const user = userEvent.setup()
    const port = createPort({
      deleteBookmark: vi
        .fn()
        .mockRejectedValue(new BookmarkFormPortError("REVISION_CONFLICT"))
    })
    const bookmark = {
      categories: [{ id: development.id, name: development.name }],
      faviconSrc: "data:image/png;base64,AA==",
      id: "bookmark-conflict",
      revision: 4,
      savedAt: 1_000,
      siteName: null,
      tags: [reading],
      thumbnailSrc: "data:image/png;base64,AA==",
      title: "入力を保持",
      url: "https://example.com/conflict"
    }
    renderDialog({ bookmark, kind: "edit" }, port)

    await user.click(screen.getByRole("button", { name: "削除する" }))
    expect((await screen.findByRole("alert")).textContent).toContain(
      "データが更新されています。画面を更新してください"
    )
    expect(
      screen.getByRole("dialog", { name: "ブックマークを編集" })
    ).not.toBeNull()
    expect(
      (screen.getByRole("textbox", { name: "タイトル" }) as HTMLInputElement)
        .value
    ).toBe("入力を保持")
  })
})
