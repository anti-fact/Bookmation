export type SearchSuggestion = {
  displayText: string
  entityId: string
  entityRevision: number
  entityType: "LABEL" | "BOOKMARK"
  labelKind: "CATEGORY" | "TAG" | null
  parentCategoryId: string | null
}

export type SearchResult = {
  bookmarks: Array<{
    id: string
    normalizedUrl: string
    revision: number
    title: string
  }>
  labels: Array<{
    id: string
    kind: "CATEGORY" | "TAG"
    name: string
    parentCategoryId: string | null
    revision: number
  }>
  source: "AI" | "LEXICAL_FALLBACK"
}

export interface SearchPort {
  search(keyword: string): Promise<SearchResult>
  suggest(keyword: string): Promise<SearchSuggestion[]>
}

export const emptySearchPort: SearchPort = {
  search: async () => ({
    bookmarks: [],
    labels: [],
    source: "LEXICAL_FALLBACK"
  }),
  suggest: async () => []
}
