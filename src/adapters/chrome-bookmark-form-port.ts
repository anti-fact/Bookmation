import { DomainErrorCode } from "~/domain"
import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageAction
} from "~/extension/messages"
import {
  BookmarkFormPortError,
  type BookmarkCategoryOption,
  type BookmarkFormErrorCode,
  type BookmarkFormPort,
  type BookmarkTagOption
} from "~/ui/features/bookmarks/bookmark-form-port"

type SendMessage = (message: unknown) => Promise<unknown>

type ChromeBookmarkFormPortOptions = {
  sendMessage?: SendMessage
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

const domainErrorCodes = new Set<string>(Object.values(DomainErrorCode))
const boundaryErrorCodes = new Set<string>([
  "ACTION_NOT_AVAILABLE",
  "INTERNAL_ERROR",
  "INVALID_MESSAGE",
  "UNAUTHORIZED_SENDER"
])

function formErrorCode(value: unknown): BookmarkFormErrorCode {
  if (
    typeof value === "string" &&
    (domainErrorCodes.has(value) || boundaryErrorCodes.has(value))
  ) {
    return value as BookmarkFormErrorCode
  }
  return "INVALID_RESPONSE"
}

async function sendRequest(
  sendMessage: SendMessage,
  action: ExtensionMessageAction,
  payload: Record<string, unknown>,
  requestId: string = crypto.randomUUID()
): Promise<Record<string, unknown>> {
  let rawResponse: unknown
  try {
    rawResponse = await sendMessage({
      action,
      payload,
      requestId,
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      source: "dashboard"
    })
  } catch {
    throw new BookmarkFormPortError("INTERNAL_ERROR")
  }

  const response = record(rawResponse)
  if (!response || response.requestId !== requestId) {
    throw new BookmarkFormPortError("INVALID_RESPONSE")
  }
  if (response.ok !== true) {
    const error = record(response.error)
    throw new BookmarkFormPortError(formErrorCode(error?.code))
  }

  const data = record(response.data)
  if (!data) {
    throw new BookmarkFormPortError("INVALID_RESPONSE")
  }
  return data
}

function categoryOption(value: unknown): BookmarkCategoryOption | null {
  const candidate = record(value)
  if (
    !candidate ||
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.revision !== "number"
  ) {
    return null
  }
  return {
    id: candidate.id,
    name: candidate.name,
    revision: candidate.revision
  }
}

function tagOption(value: unknown): BookmarkTagOption | null {
  const candidate = record(value)
  if (
    !candidate ||
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.parentCategoryId !== "string" ||
    typeof candidate.parentCategoryName !== "string" ||
    typeof candidate.revision !== "number"
  ) {
    return null
  }
  return {
    id: candidate.id,
    name: candidate.name,
    parentCategoryId: candidate.parentCategoryId,
    parentCategoryName: candidate.parentCategoryName,
    revision: candidate.revision
  }
}

export function createChromeBookmarkFormPort({
  sendMessage = (message) => chrome.runtime.sendMessage(message)
}: ChromeBookmarkFormPortOptions = {}): BookmarkFormPort {
  return {
    async createCategory({ name, requestId }) {
      const data = await sendRequest(
        sendMessage,
        "create-category",
        { name },
        requestId
      )
      const option = categoryOption({
        id: data.categoryId,
        name: data.name,
        revision: data.revision
      })
      if (!option) throw new BookmarkFormPortError("INVALID_RESPONSE")
      return option
    },

    async createTag({ category, name, requestId }) {
      const data = await sendRequest(
        sendMessage,
        "create-tag",
        {
          expectedParentRevision: category.revision,
          name,
          parentCategoryId: category.id
        },
        requestId
      )
      const option = tagOption({
        id: data.tagId,
        name: data.name,
        parentCategoryId: data.parentCategoryId,
        parentCategoryName: category.name,
        revision: data.revision
      })
      if (!option) throw new BookmarkFormPortError("INVALID_RESPONSE")
      return option
    },

    async deleteBookmark({ bookmarkId, expectedRevision }) {
      await sendRequest(sendMessage, "delete-bookmark", {
        bookmarkId,
        expectedRevision
      })
    },

    async saveBookmark({ requestId, tagIds, title, url }) {
      const data = await sendRequest(
        sendMessage,
        "save-bookmark-by-url",
        {
          tagIds,
          ...(title.trim() ? { title: title.trim() } : {}),
          url
        },
        requestId
      )
      if (typeof data.duplicate !== "boolean") {
        throw new BookmarkFormPortError("INVALID_RESPONSE")
      }
      return { duplicate: data.duplicate }
    },

    async searchCategories(keyword) {
      const data = await sendRequest(sendMessage, "list-label-candidates", {
        keyword,
        kind: "CATEGORY",
        limit: 8
      })
      if (!Array.isArray(data.items)) {
        throw new BookmarkFormPortError("INVALID_RESPONSE")
      }
      return data.items
        .map(categoryOption)
        .filter((item): item is BookmarkCategoryOption => item !== null)
        .slice(0, 8)
    },

    async searchTags(keyword) {
      const data = await sendRequest(sendMessage, "list-label-candidates", {
        keyword,
        kind: "TAG",
        limit: 8
      })
      if (!Array.isArray(data.items)) {
        throw new BookmarkFormPortError("INVALID_RESPONSE")
      }
      return data.items
        .map(tagOption)
        .filter((item): item is BookmarkTagOption => item !== null)
        .slice(0, 8)
    },

    async updateBookmark({
      bookmarkId,
      expectedRevision,
      tagIds,
      title,
      url
    }) {
      await sendRequest(sendMessage, "update-bookmark", {
        bookmarkId,
        expectedRevision,
        rawUrl: url,
        tagIds,
        title
      })
    }
  }
}
