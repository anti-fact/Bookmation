import { DomainError, toSafeMessage } from "~/domain"
import { SaveBookmarkUseCase, type SaveBookmarkResult } from "~/application/save-bookmark"
import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import type {
  ExtensionMessage,
  ExtensionResponse,
  SaveBookmarkResponse,
} from "~/extension/messages"
import {
  isExtensionMessage,
  MANIFEST_COMMAND_NAMES,
} from "~/extension/messages"
import { scheduleBookmarkMetadataFetch, showDuplicateBadge } from "~/extension/save-side-effects"

let dataLayerPromise: Promise<LocalDataLayer> | null = null

async function getDataLayer(): Promise<LocalDataLayer> {
  if (!dataLayerPromise) {
    dataLayerPromise = LocalDataLayer.open()
  }
  return dataLayerPromise
}

function errorResponse(
  requestId: string,
  error: unknown,
): ExtensionResponse {
  if (error instanceof DomainError) {
    return {
      ok: false,
      requestId,
      code: error.code,
      message: toSafeMessage(error.code),
    }
  }
  return {
    ok: false,
    requestId,
    code: "UNKNOWN",
    message: "処理に失敗しました。",
  }
}

function saveResponse(
  requestId: string,
  result: SaveBookmarkResult,
): SaveBookmarkResponse {
  return {
    ok: true,
    requestId,
    bookmarkId: result.bookmarkId,
    title: result.title,
    duplicate: result.duplicate,
    savedAt: result.savedAt,
  }
}

async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

export async function handleExtensionMessage(
  message: unknown,
): Promise<ExtensionResponse> {
  if (!isExtensionMessage(message)) {
    return {
      ok: false,
      requestId: "unknown",
      code: "INVALID_MESSAGE",
      message: "不正なメッセージです。",
    }
  }

  const requestId = message.requestId

  try {
    switch (message.action) {
      case "GET_COMMAND_SHORTCUTS": {
        const commands = await chrome.commands.getAll()
        const shortcuts = MANIFEST_COMMAND_NAMES.map((commandName) => {
          const entry = commands.find((item) => item.name === commandName)
          const shortcut = entry?.shortcut?.trim()
          return {
            command: commandName,
            shortcut: shortcut && shortcut.length > 0 ? shortcut : "未割り当て",
          }
        })
        return { ok: true, requestId, shortcuts }
      }

      case "LIST_RECENT_BOOKMARKS": {
        const data = await getDataLayer()
        const page = await data.listRecentBookmarks(null, message.limit ?? 8)
        return {
          ok: true,
          requestId,
          items: page.items.map((item) => ({
            id: item.id,
            title: item.title,
            normalizedUrl: item.normalizedUrl,
            savedAt: item.savedAt,
          })),
        }
      }

      case "SAVE_CURRENT_TAB": {
        const tab = await queryActiveTab()
        if (!tab?.url) {
          return {
            ok: false,
            requestId,
            code: "NO_ACTIVE_TAB",
            message: "保存できるページが見つかりません。",
          }
        }

        const data = await getDataLayer()
        const useCase = new SaveBookmarkUseCase(data)
        const result = await useCase.saveCurrentTab({
          rawUrl: tab.url,
          title: tab.title ?? "",
          faviconUrl: tab.favIconUrl,
          creationRequestId: requestId,
        })

        if (result.duplicate) {
          await showDuplicateBadge(chrome.action)
        } else {
          scheduleBookmarkMetadataFetch(data, result, {
            rawUrl: tab.url,
            faviconUrl: tab.favIconUrl,
            source: "CURRENT_TAB",
          })
        }

        return saveResponse(requestId, result)
      }

      case "SAVE_BOOKMARK_BY_URL": {
        const data = await getDataLayer()
        const useCase = new SaveBookmarkUseCase(data)
        const result = await useCase.saveByUrl({
          rawUrl: message.rawUrl,
          title: message.title,
          creationRequestId: requestId,
        })

        if (!result.duplicate) {
          scheduleBookmarkMetadataFetch(data, result, {
            rawUrl: message.rawUrl,
            source: "MANUAL_URL",
          })
        }

        return saveResponse(requestId, result)
      }
    }
  } catch (error: unknown) {
    return errorResponse(requestId, error)
  }
}

export async function saveCurrentTabFromCommand(
  requestId: string = crypto.randomUUID(),
): Promise<SaveBookmarkResult> {
  const response = await handleExtensionMessage({
    schemaVersion: 1,
    action: "SAVE_CURRENT_TAB",
    requestId,
  })
  if (!response.ok || !("bookmarkId" in response)) {
    throw new Error("message" in response ? response.message : "保存に失敗しました")
  }
  return {
    bookmarkId: response.bookmarkId,
    title: response.title,
    normalizedUrl: "",
    duplicate: response.duplicate,
    savedAt: response.savedAt,
    revision: 1,
  }
}

export function resetDataLayerForTests(): void {
  dataLayerPromise = null
}
