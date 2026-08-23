import { EXTENSION_MESSAGE_SCHEMA_VERSION } from "~/extension/messages"
import type {
  SearchPort,
  SearchResult,
  SearchSuggestion
} from "~/ui/features/search/search-port"

type SendMessage = (message: unknown) => Promise<unknown>
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

async function send(
  sendMessage: SendMessage,
  keyword: string,
  mode: "SEARCH" | "SUGGEST"
) {
  const requestId = crypto.randomUUID()
  const response = record(
    await sendMessage({
      action: "search-library",
      payload: { keyword, mode },
      requestId,
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      source: "dashboard"
    })
  )
  if (!response || response.ok !== true || response.requestId !== requestId)
    throw new Error("SEARCH_FAILED")
  const data = record(response.data)
  if (!data) throw new Error("INVALID_RESPONSE")
  return data
}

export function createChromeSearchPort(
  sendMessage: SendMessage = (message) => chrome.runtime.sendMessage(message)
): SearchPort {
  return {
    async suggest(keyword) {
      const data = await send(sendMessage, keyword, "SUGGEST")
      if (!Array.isArray(data.items)) throw new Error("INVALID_RESPONSE")
      return data.items
        .flatMap((value): SearchSuggestion[] => {
          const item = record(value)
          if (
            !item ||
            typeof item.entityId !== "string" ||
            typeof item.entityRevision !== "number" ||
            typeof item.displayText !== "string" ||
            (item.entityType !== "LABEL" && item.entityType !== "BOOKMARK")
          )
            return []
          return [
            {
              displayText: item.displayText,
              entityId: item.entityId,
              entityRevision: item.entityRevision,
              entityType: item.entityType,
              labelKind:
                item.labelKind === "CATEGORY" || item.labelKind === "TAG"
                  ? item.labelKind
                  : null,
              parentCategoryId:
                typeof item.parentCategoryId === "string"
                  ? item.parentCategoryId
                  : null
            }
          ]
        })
        .slice(0, 8)
    },
    async search(keyword) {
      const data = await send(sendMessage, keyword, "SEARCH")
      if (!Array.isArray(data.labels) || !Array.isArray(data.bookmarks))
        throw new Error("INVALID_RESPONSE")
      const labels = data.labels.flatMap((value): SearchResult["labels"] => {
        const item = record(value)
        if (
          !item ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.revision !== "number" ||
          (item.kind !== "CATEGORY" && item.kind !== "TAG")
        )
          return []
        return [
          {
            id: item.id,
            kind: item.kind,
            name: item.name,
            parentCategoryId:
              typeof item.parentCategoryId === "string"
                ? item.parentCategoryId
                : null,
            revision: item.revision
          }
        ]
      })
      const bookmarks = data.bookmarks.flatMap(
        (value): SearchResult["bookmarks"] => {
          const item = record(value)
          return item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.normalizedUrl === "string" &&
            typeof item.revision === "number"
            ? [
                {
                  id: item.id,
                  normalizedUrl: item.normalizedUrl,
                  revision: item.revision,
                  title: item.title
                }
              ]
            : []
        }
      )
      return {
        bookmarks,
        labels,
        source: data.source === "AI" ? "AI" : "LEXICAL_FALLBACK"
      }
    }
  }
}
