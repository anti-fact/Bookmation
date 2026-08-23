import type { DomainErrorCode } from "~/domain"
import { toSafeMessage } from "~/domain"

export type BookmarkCategoryOption = {
  id: string
  name: string
  revision: number
}

export type BookmarkTagOption = {
  id: string
  name: string
  parentCategoryId: string
  parentCategoryName: string
  revision: number
}

export type SaveBookmarkFormInput = {
  requestId: string
  tagIds: string[]
  title: string
  url: string
}

export type UpdateBookmarkFormInput = {
  bookmarkId: string
  expectedRevision: number
  tagIds: string[]
  title: string
  url: string
}

export type BookmarkFormErrorCode =
  | DomainErrorCode
  | "ACTION_NOT_AVAILABLE"
  | "INTERNAL_ERROR"
  | "INVALID_MESSAGE"
  | "UNAUTHORIZED_SENDER"
  | "INVALID_RESPONSE"

export class BookmarkFormPortError extends Error {
  constructor(readonly code: BookmarkFormErrorCode) {
    super(code)
    this.name = "BookmarkFormPortError"
  }
}

export function bookmarkFormErrorMessage(error: unknown): string {
  if (error instanceof BookmarkFormPortError) {
    switch (error.code) {
      case "ACTION_NOT_AVAILABLE":
        return "この操作は現在利用できません"
      case "INVALID_MESSAGE":
      case "INVALID_RESPONSE":
        return "データの形式が正しくありません。画面を開き直してください"
      case "UNAUTHORIZED_SENDER":
        return "この画面からは操作できません"
      case "INTERNAL_ERROR":
        return "処理に失敗しました。入力内容を保ったまま再試行できます"
      default:
        return toSafeMessage(error.code)
    }
  }

  return "処理に失敗しました。入力内容を保ったまま再試行できます"
}

export interface BookmarkFormPort {
  createCategory(input: {
    name: string
    requestId: string
  }): Promise<BookmarkCategoryOption>
  createTag(input: {
    category: BookmarkCategoryOption
    name: string
    requestId: string
  }): Promise<BookmarkTagOption>
  deleteBookmark(input: {
    bookmarkId: string
    expectedRevision: number
  }): Promise<void>
  saveBookmark(input: SaveBookmarkFormInput): Promise<{ duplicate: boolean }>
  searchCategories(keyword: string): Promise<BookmarkCategoryOption[]>
  searchTags(keyword: string): Promise<BookmarkTagOption[]>
  updateBookmark(input: UpdateBookmarkFormInput): Promise<void>
}

function unavailable(): never {
  throw new BookmarkFormPortError("ACTION_NOT_AVAILABLE")
}

export const emptyBookmarkFormPort: BookmarkFormPort = {
  createCategory: async () => unavailable(),
  createTag: async () => unavailable(),
  deleteBookmark: async () => unavailable(),
  saveBookmark: async () => unavailable(),
  searchCategories: async () => [],
  searchTags: async () => [],
  updateBookmark: async () => unavailable()
}
