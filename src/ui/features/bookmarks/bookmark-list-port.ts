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
  faviconUrl: string | null
  id: string
  savedAt: number
  siteName: string | null
  tags: BookmarkListLabel[]
  thumbnailUrl: string | null
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
