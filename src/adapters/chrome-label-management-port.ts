import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageAction
} from "~/extension/messages"
import type { BookmarkCategoryOption } from "~/ui/features/bookmarks/bookmark-form-port"
import type {
  CategoryEditDetail,
  LabelManagementPort,
  ManagedCategory,
  ManagedTag
} from "~/ui/features/labels/label-management-port"

type SendMessage = (message: unknown) => Promise<unknown>

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function request(
  sendMessage: SendMessage,
  action: ExtensionMessageAction,
  payload: Record<string, unknown>,
  requestId: string = crypto.randomUUID()
): Promise<Record<string, unknown>> {
  const response = record(
    await sendMessage({
      action,
      payload,
      requestId,
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      source: "dashboard"
    })
  )
  if (!response || response.requestId !== requestId || response.ok !== true) {
    const error = record(response?.error)
    throw new Error(
      typeof error?.code === "string" ? error.code : "INVALID_RESPONSE"
    )
  }
  const data = record(response.data)
  if (!data) throw new Error("INVALID_RESPONSE")
  return data
}

function category(value: unknown): BookmarkCategoryOption | null {
  const item = record(value)
  return item &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.revision === "number"
    ? { id: item.id, name: item.name, revision: item.revision }
    : null
}

function tag(value: unknown): ManagedTag | null {
  const item = record(value)
  return item &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.parentCategoryId === "string" &&
    typeof item.parentCategoryName === "string" &&
    typeof item.revision === "number"
    ? {
        id: item.id,
        name: item.name,
        origin: typeof item.origin === "string" ? item.origin : "USER",
        parentCategoryId: item.parentCategoryId,
        parentCategoryName: item.parentCategoryName,
        revision: item.revision,
        usageCount: typeof item.usageCount === "number" ? item.usageCount : 0
      }
    : null
}

export function createChromeLabelManagementPort(
  sendMessage: SendMessage = (message) => chrome.runtime.sendMessage(message)
): LabelManagementPort {
  return {
    async list() {
      const data = await request(sendMessage, "list-label-candidates", {
        keyword: "",
        limit: 1000
      })
      if (!Array.isArray(data.items)) throw new Error("INVALID_RESPONSE")
      const categories: ManagedCategory[] = []
      for (const item of data.items) {
        const raw = record(item)
        const option = category(item)
        if (option && raw?.kind === "CATEGORY") {
          categories.push({
            ...option,
            origin: typeof raw.origin === "string" ? raw.origin : "USER",
            tags: []
          })
        }
      }
      const tags = data.items
        .map(tag)
        .filter((item): item is ManagedTag => item !== null)
      for (const item of tags)
        categories
          .find((candidate) => candidate.id === item.parentCategoryId)
          ?.tags.push(item)
      return categories
    },
    async createCategory({ name, requestId }) {
      const data = await request(
        sendMessage,
        "create-category",
        { name },
        requestId
      )
      const result = category({
        id: data.categoryId,
        name: data.name,
        revision: data.revision
      })
      if (!result) throw new Error("INVALID_RESPONSE")
      return result
    },
    async updateCategory({ category: current, name }) {
      const data = await request(sendMessage, "update-category", {
        categoryId: current.id,
        expectedRevision: current.revision,
        name
      })
      const result = category({
        id: data.categoryId,
        name: data.name,
        revision: data.revision
      })
      if (!result) throw new Error("INVALID_RESPONSE")
      return result
    },
    async createTag({ category: parent, name, requestId }) {
      const data = await request(
        sendMessage,
        "create-tag",
        {
          expectedParentRevision: parent.revision,
          name,
          parentCategoryId: parent.id
        },
        requestId
      )
      const result = tag({
        id: data.tagId,
        name: data.name,
        origin: "USER",
        parentCategoryId: data.parentCategoryId,
        parentCategoryName: parent.name,
        revision: data.revision,
        usageCount: 0
      })
      if (!result) throw new Error("INVALID_RESPONSE")
      return result
    },
    async searchCategories(keyword) {
      const data = await request(sendMessage, "list-label-candidates", {
        keyword,
        kind: "CATEGORY",
        limit: 8
      })
      if (!Array.isArray(data.items)) throw new Error("INVALID_RESPONSE")
      return data.items
        .map(category)
        .filter((item): item is BookmarkCategoryOption => item !== null)
    },
    async updateTag({ category: parent, name, requestId, tag: current }) {
      await request(sendMessage, "update-tag", {
        expectedParentRevision: parent.revision,
        expectedTagRevision: current.revision,
        name,
        parentCategoryId: parent.id,
        requestId,
        tagId: current.id
      })
    },
    async deleteTag({ id, revision }) {
      await request(sendMessage, "delete-tag", {
        expectedRevision: revision,
        tagId: id
      })
    },
    async getCategoryDetail(id) {
      const data = await request(sendMessage, "get-category-edit-detail", {
        categoryId: id
      })
      const resultCategory = category(data.category)
      if (
        !resultCategory ||
        !Array.isArray(data.activeTags) ||
        typeof data.activeTagCount !== "number" ||
        typeof data.referencedActiveBookmarkCount !== "number" ||
        typeof data.impactFingerprint !== "string"
      )
        throw new Error("INVALID_RESPONSE")
      return {
        category: resultCategory,
        activeTags: data.activeTags
          .map(category)
          .filter((item): item is BookmarkCategoryOption => item !== null),
        activeTagCount: data.activeTagCount,
        referencedActiveBookmarkCount: data.referencedActiveBookmarkCount,
        impactFingerprint: data.impactFingerprint
      } satisfies CategoryEditDetail
    },
    async deleteCategory({ detail, requestId }) {
      await request(sendMessage, "delete-category-cascade", {
        categoryId: detail.category.id,
        expectedCategoryRevision: detail.category.revision,
        expectedImpactFingerprint: detail.impactFingerprint,
        requestId,
        warningAcknowledged: true
      })
    }
  }
}
