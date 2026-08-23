import { describe, expect, it, vi } from "vitest"

import { ONBOARDING_STATE_KEY } from "~/extension/onboarding"
import { OnboardingPortError } from "~/extension/onboarding-errors"
import type { BookmarkFormPort } from "~/ui/features/bookmarks/bookmark-form-port"

import { createChromeOnboardingPort } from "./chrome-onboarding-port"

function createStorage(initial: Record<string, unknown> = {}) {
  const values = { ...initial }
  return {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (next: Record<string, unknown>) => {
      Object.assign(values, next)
    }),
    values
  }
}

function createBookmarkPort(
  overrides: Partial<BookmarkFormPort> = {}
): BookmarkFormPort {
  return {
    createCategory: vi.fn(async ({ name }) => ({
      id: "category-created",
      name,
      revision: 1
    })),
    createTag: vi.fn(async ({ category, name }) => ({
      id: "tag-created",
      name,
      parentCategoryId: category.id,
      parentCategoryName: category.name,
      revision: 1
    })),
    deleteBookmark: vi.fn(),
    saveBookmark: vi.fn(),
    searchCategories: vi.fn(async () => []),
    searchTags: vi.fn(async () => []),
    updateBookmark: vi.fn(),
    ...overrides
  }
}

describe("createChromeOnboardingPort", () => {
  it("persists progress and only creates explicitly selected presets", async () => {
    const storage = createStorage()
    const bookmarkFormPort = createBookmarkPort()
    const port = createChromeOnboardingPort({ bookmarkFormPort, storage })

    await port.start()
    await port.saveSelection({ "study.lecture": ["授業ページ"] })
    expect(storage.values[ONBOARDING_STATE_KEY]).toMatchObject({
      catalogVersion: "2026-08-23",
      categorySelection: { "study.lecture": ["授業ページ"] }
    })
    const completed = await port.complete({
      "study.lecture": ["授業ページ"]
    })

    expect(bookmarkFormPort.createCategory).toHaveBeenCalledWith({
      name: "授業・講義",
      requestId: expect.stringMatching(
        /^onboarding:.*:category:study_lecture$/
      )
    })
    expect(bookmarkFormPort.createTag).toHaveBeenCalledWith({
      category: { id: "category-created", name: "授業・講義", revision: 1 },
      name: "授業ページ",
      requestId: expect.stringMatching(/^onboarding:.*:tag:study_lecture:0$/)
    })
    expect(completed).toMatchObject({
      categorySelection: {},
      currentStepId: null,
      status: "COMPLETED"
    })
    expect(storage.values[ONBOARDING_STATE_KEY]).toEqual(completed)
  })

  it("reuses the persisted apply request id when a partial apply is retried", async () => {
    const storage = createStorage()
    let createdCategory = false
    const createTag = vi
      .fn<BookmarkFormPort["createTag"]>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({
        id: "tag-created",
        name: "授業ページ",
        parentCategoryId: "category-created",
        parentCategoryName: "授業・講義",
        revision: 1
      })
    const bookmarkFormPort = createBookmarkPort({
      createCategory: vi.fn(async ({ name }) => {
        createdCategory = true
        return { id: "category-created", name, revision: 1 }
      }),
      createTag,
      searchCategories: vi.fn(async () =>
        createdCategory
          ? [{ id: "category-created", name: "授業・講義", revision: 1 }]
          : []
      )
    })
    const port = createChromeOnboardingPort({ bookmarkFormPort, storage })
    const selection = { "study.lecture": ["授業ページ"] }

    await expect(port.complete(selection)).rejects.toThrow("temporary")
    const firstRequestId = vi.mocked(createTag).mock.calls[0]?.[0].requestId
    await expect(port.complete(selection)).resolves.toMatchObject({
      status: "COMPLETED"
    })
    expect(vi.mocked(createTag).mock.calls[1]?.[0].requestId).toBe(
      firstRequestId
    )
  })

  it("keeps the draft when a globally identical tag belongs to another category", async () => {
    const storage = createStorage()
    const bookmarkFormPort = createBookmarkPort({
      searchCategories: vi.fn(async () => [
        { id: "category-study", name: "授業・講義", revision: 1 }
      ]),
      searchTags: vi.fn(async () => [
        {
          id: "tag-existing",
          name: "授業ページ",
          parentCategoryId: "category-other",
          parentCategoryName: "別カテゴリ",
          revision: 1
        }
      ])
    })
    const port = createChromeOnboardingPort({ bookmarkFormPort, storage })

    const error = await port
      .complete({ "study.lecture": ["授業ページ"] })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(OnboardingPortError)
    expect((error as OnboardingPortError).code).toBe("ONBOARDING_TAG_CONFLICT")
    expect(await port.load()).toMatchObject({
      categorySelection: { "study.lecture": ["授業ページ"] },
      status: "IN_PROGRESS"
    })
  })

  it("skips onboarding without creating labels", async () => {
    const storage = createStorage()
    const bookmarkFormPort = createBookmarkPort()
    const port = createChromeOnboardingPort({ bookmarkFormPort, storage })

    await port.start()
    await port.saveSelection({ "study.lecture": ["授業ページ"] })
    const skipped = await port.skip()

    expect(bookmarkFormPort.createCategory).not.toHaveBeenCalled()
    expect(bookmarkFormPort.createTag).not.toHaveBeenCalled()
    expect(skipped).toMatchObject({
      categorySelection: {},
      currentStepId: null,
      status: "COMPLETED"
    })
  })

  it("clears a stale draft when the catalog version changes", async () => {
    const storage = createStorage({
      [ONBOARDING_STATE_KEY]: {
        applyRequestId: "apply-1",
        catalogVersion: "old-version",
        categorySelection: { "study.lecture": ["授業ページ"] },
        currentStepId: "categories",
        initializedBy: "INSTALL",
        schemaVersion: 1,
        status: "IN_PROGRESS",
        updatedAt: 1
      }
    })
    const port = createChromeOnboardingPort({
      bookmarkFormPort: createBookmarkPort(),
      storage
    })

    const result = await port.loadWithMeta()

    expect(result?.catalogMismatch).toBe(true)
    expect(result?.state.categorySelection).toEqual({})
    expect(storage.values[ONBOARDING_STATE_KEY]).toMatchObject({
      catalogVersion: "2026-08-23",
      categorySelection: {}
    })
  })
})
