import type { BookmarkTagOption } from "./bookmark-form-port"

export type BookmarkViewMode = "GRID" | "LIST"

export type BookmarkLabelFilter =
  | { id: string; kind: "category" }
  | { id: string; kind: "tag" }
  | { categoryId: string; kind: "category-tag"; tagId: string }

export type BookmarkListFilter =
  | { kind: "recent" }
  | BookmarkLabelFilter

export type BookmarkListCursor = {
  id: string
  savedAt: number
}

export type BookmarkListLabel = {
  id: string
  name: string
}

export type BookmarkListItem = {
  categories: BookmarkListLabel[]
  /** 拡張機能内 Blob または同梱ロゴのみ。外部 https URL は含めない。 */
  faviconSrc: string
  id: string
  revision: number
  savedAt: number
  siteName: string | null
  tags: BookmarkTagOption[]
  /** 拡張機能内 Blob または同梱ロゴのみ。外部 https URL は含めない。 */
  thumbnailSrc: string
  title: string
  url: string
}

export type BookmarkListPageResult = {
  items: BookmarkListItem[]
  nextCursor: BookmarkListCursor | null
  requestId: string
  totalCount: number
}

export type LoadBookmarkPageInput = {
  cursor: BookmarkListCursor | null
  filter: BookmarkListFilter
  limit?: number
  requestId: string
}

export interface BookmarkListPort {
  getViewMode(): Promise<BookmarkViewMode>
  loadPage(input: LoadBookmarkPageInput): Promise<BookmarkListPageResult>
  setViewMode(mode: BookmarkViewMode): Promise<void>
}

export const emptyBookmarkListPort: BookmarkListPort = {
  getViewMode: async () => "GRID",
  loadPage: async ({ requestId }) => ({
    items: [],
    nextCursor: null,
    requestId,
    totalCount: 0
  }),
  setViewMode: async () => undefined
}
