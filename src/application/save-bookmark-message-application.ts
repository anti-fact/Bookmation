import { isDomainError, type JsonValue } from "~/domain"
import { safeLogError } from "~/adapters/security/log-redaction"
import { SaveBookmarkUseCase, type SaveBookmarkResult } from "~/application/save-bookmark"
import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import type {
  ExtensionMessageRequest,
  ExtensionMessageResponse,
  SaveCurrentTabPayload,
} from "~/extension/messages"
import { scheduleBookmarkMetadataFetch, showDuplicateBadge } from "~/extension/save-side-effects"

import {
  successResponse,
  type ExtensionMessageApplication,
} from "./extension-message-application"

type SaveBookmarkTabs = Pick<typeof chrome.tabs, "query">

type SaveBookmarkAction = Pick<
  typeof chrome.action,
  "setBadgeText" | "setBadgeBackgroundColor"
>

export type SaveBookmarkMessageApplicationDeps = Readonly<{
  tabs: SaveBookmarkTabs
  action: SaveBookmarkAction
}>

let dataLayerPromise: Promise<LocalDataLayer> | null = null
let activeDataLayer: LocalDataLayer | null = null

async function getDataLayer(): Promise<LocalDataLayer> {
  if (!dataLayerPromise) {
    dataLayerPromise = LocalDataLayer.open()
      .then((layer) => {
        activeDataLayer = layer
        return layer
      })
      .catch((error: unknown) => {
        dataLayerPromise = null
        activeDataLayer = null
        throw error
      })
  }
  return dataLayerPromise
}

function isIdbConnectionError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false
  }
  return (
    error.name === "InvalidStateError" ||
    error.name === "AbortError" ||
    error.name === "TransactionInactiveError"
  )
}

async function withDataLayer<T>(
  operation: (data: LocalDataLayer) => Promise<T>,
): Promise<T> {
  try {
    const data = await getDataLayer()
    return await operation(data)
  } catch (error: unknown) {
    if (isIdbConnectionError(error)) {
      await resetSaveBookmarkDataLayerCache()
      const data = await getDataLayer()
      return await operation(data)
    }
    throw error
  }
}

export async function resetSaveBookmarkDataLayerCache(): Promise<void> {
  dataLayerPromise = null
  if (activeDataLayer) {
    await activeDataLayer.close()
    activeDataLayer = null
  }
}

function saveResultData(result: SaveBookmarkResult): JsonValue {
  return {
    status: result.duplicate ? "duplicate" : "saved",
    bookmarkId: result.bookmarkId,
    title: result.title,
    normalizedUrl: result.normalizedUrl,
    duplicate: result.duplicate,
    savedAt: result.savedAt,
  }
}

async function queryActiveTab(tabs: SaveBookmarkTabs): Promise<chrome.tabs.Tab | undefined> {
  const found = await tabs.query({ active: true, lastFocusedWindow: true })
  return found[0]
}

async function resolveCurrentTabContext(
  tabs: SaveBookmarkTabs,
  payload: SaveCurrentTabPayload,
): Promise<{
  rawUrl: string
  title: string
  faviconUrl?: string | null
} | null> {
  if (payload.rawUrl) {
    return {
      rawUrl: payload.rawUrl,
      title: payload.title ?? "",
      faviconUrl: payload.faviconUrl ?? null,
    }
  }

  const tab = await queryActiveTab(tabs)
  if (!tab?.url) {
    return null
  }

  return {
    rawUrl: tab.url,
    title: tab.title ?? "",
    faviconUrl: tab.favIconUrl ?? null,
  }
}

async function persistCurrentTabSave(
  deps: SaveBookmarkMessageApplicationDeps,
  input: {
    rawUrl: string
    title: string
    faviconUrl?: string | null
    creationRequestId: string
  },
): Promise<SaveBookmarkResult> {
  const result = await withDataLayer(async (data) => {
    const useCase = new SaveBookmarkUseCase(data)
    return useCase.saveCurrentTab({
      rawUrl: input.rawUrl,
      title: input.title,
      faviconUrl: input.faviconUrl,
      creationRequestId: input.creationRequestId,
    })
  })

  if (result.duplicate) {
    await showDuplicateBadge(deps.action)
  } else {
    const data = await getDataLayer()
    scheduleBookmarkMetadataFetch(data, result, {
      rawUrl: input.rawUrl,
      faviconUrl: input.faviconUrl,
      source: "CURRENT_TAB",
    })
  }

  return result
}

export async function saveCurrentTabBookmark(
  deps: SaveBookmarkMessageApplicationDeps,
  input: {
    payload?: SaveCurrentTabPayload
    creationRequestId: string
  },
): Promise<SaveBookmarkResult> {
  const tabContext = await resolveCurrentTabContext(deps.tabs, input.payload ?? {})
  if (!tabContext) {
    throw new Error("NO_ACTIVE_TAB")
  }

  return persistCurrentTabSave(deps, {
    ...tabContext,
    creationRequestId: input.creationRequestId,
  })
}

export function createSaveBookmarkMessageApplication(
  deps: SaveBookmarkMessageApplicationDeps,
): ExtensionMessageApplication {
  return {
    async handle(request: ExtensionMessageRequest): Promise<ExtensionMessageResponse> {
      try {
        switch (request.action) {
          case "save-current-tab": {
            const result = await saveCurrentTabBookmark(deps, {
              payload: request.payload,
              creationRequestId: request.requestId,
            })
            return successResponse(request.requestId, saveResultData(result))
          }

          case "save-bookmark-by-url": {
            const result = await withDataLayer(async (data) => {
              const useCase = new SaveBookmarkUseCase(data)
              return useCase.saveByUrl({
                rawUrl: request.payload.url,
                title: request.payload.title,
                creationRequestId: request.requestId,
              })
            })

            if (!result.duplicate) {
              const data = await getDataLayer()
              scheduleBookmarkMetadataFetch(data, result, {
                rawUrl: request.payload.url,
                source: "MANUAL_URL",
              })
            }

            return successResponse(request.requestId, saveResultData(result))
          }

          case "list-bookmarks": {
            const page = await withDataLayer((data) =>
              data.listRecentBookmarks(null, request.payload.limit ?? 8),
            )
            return successResponse(request.requestId, {
              items: page.items.map((item) => ({
                id: item.id,
                title: item.title,
                normalizedUrl: item.normalizedUrl,
                savedAt: item.savedAt,
              })),
            })
          }

          default:
            return {
              requestId: request.requestId,
              ok: false,
              error: { code: "ACTION_NOT_AVAILABLE" },
            }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message === "NO_ACTIVE_TAB") {
          return {
            requestId: request.requestId,
            ok: false,
            error: { code: "ACTION_NOT_AVAILABLE" },
          }
        }
        if (isDomainError(error)) {
          safeLogError("Save request rejected", error)
        } else {
          safeLogError("Save request failed", error)
        }
        return {
          requestId: request.requestId,
          ok: false,
          error: { code: "INTERNAL_ERROR" },
        }
      }
    },
  }
}
