import type { BookmarkCategoryOption } from "~/ui/features/bookmarks/bookmark-form-port"

export type ManagedTag = {
  id: string
  name: string
  origin: string
  parentCategoryId: string
  parentCategoryName: string
  revision: number
  usageCount: number
}

export type ManagedCategory = BookmarkCategoryOption & {
  origin: string
  tags: ManagedTag[]
}

export type CategoryEditDetail = {
  category: BookmarkCategoryOption
  activeTags: Array<{ id: string; name: string; revision: number }>
  activeTagCount: number
  referencedActiveBookmarkCount: number
  impactFingerprint: string
}

export interface LabelManagementPort {
  createCategory(input: {
    name: string
    requestId: string
  }): Promise<BookmarkCategoryOption>
  updateCategory(input: {
    category: BookmarkCategoryOption
    name: string
  }): Promise<BookmarkCategoryOption>
  createTag(input: {
    category: BookmarkCategoryOption
    name: string
    requestId: string
  }): Promise<ManagedTag>
  deleteCategory(input: {
    detail: CategoryEditDetail
    requestId: string
  }): Promise<void>
  deleteTag(input: { id: string; revision: number }): Promise<void>
  getCategoryDetail(id: string): Promise<CategoryEditDetail>
  list(): Promise<ManagedCategory[]>
  searchCategories(keyword: string): Promise<BookmarkCategoryOption[]>
  updateTag(input: {
    category: BookmarkCategoryOption
    name: string
    requestId: `tag-update:${string}`
    tag: ManagedTag
  }): Promise<void>
}

const unavailable = async (): Promise<never> => {
  throw new Error("ACTION_NOT_AVAILABLE")
}

export const emptyLabelManagementPort: LabelManagementPort = {
  createCategory: unavailable,
  updateCategory: unavailable,
  createTag: unavailable,
  deleteCategory: unavailable,
  deleteTag: unavailable,
  getCategoryDetail: unavailable,
  list: async () => [],
  searchCategories: async () => [],
  updateTag: unavailable
}
