import { LocalDataLayer } from "~/adapters"
import type { ExtensionMessageResponse } from "~/extension/messages"
import { isDomainError } from "~/domain"

import { handleClassificationJobMessage } from "./classification-job-application"
import type { ExtensionMessageApplication } from "./extension-message-application"

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isCursor(value: unknown): value is { savedAt: number; id: string } {
  const cursor = record(value)
  return !!cursor && typeof cursor.savedAt === "number" && typeof cursor.id === "string"
}

function invalid(requestId: string): ExtensionMessageResponse {
  return { requestId, ok: false, error: { code: "INVALID_MESSAGE" } }
}

/** BE-04/05 actionをChrome境界からApplicationへ集約する。 */
export function createLibraryApplication(
  save: ExtensionMessageApplication,
): ExtensionMessageApplication {
  return {
    async handle(request): Promise<ExtensionMessageResponse> {
      if (request.action === "save-current-tab" || request.action === "save-bookmark-by-url") {
        return save.handle(request)
      }
    const payload = record(request.payload)
    if (!payload) return invalid(request.requestId)
    const layer = await LocalDataLayer.open()
    try {
      if (request.action === "create-category" && typeof payload.name === "string") {
        const category = await layer.createCategory({
          id: crypto.randomUUID(),
          name: payload.name,
          creationRequestId: request.requestId,
        })
        return {
          requestId: request.requestId,
          ok: true,
          data: { categoryId: category.id, revision: category.revision },
        }
      }

      if (
        request.action === "create-tag" &&
        typeof payload.name === "string" &&
        typeof payload.parentCategoryId === "string" &&
        typeof payload.expectedParentRevision === "number"
      ) {
        const tag = await layer.createTag({
          id: crypto.randomUUID(),
          name: payload.name,
          parentCategoryId: payload.parentCategoryId,
          expectedParentRevision: payload.expectedParentRevision,
          creationRequestId: request.requestId,
        })
        return {
          requestId: request.requestId,
          ok: true,
          data: { tagId: tag.id, revision: tag.revision, parentCategoryId: tag.parentCategoryId },
        }
      }

      if (
        request.action === "update-tag" &&
        typeof payload.tagId === "string" &&
        typeof payload.expectedTagRevision === "number" &&
        typeof payload.name === "string" &&
        typeof payload.parentCategoryId === "string" &&
        typeof payload.expectedParentRevision === "number" &&
        typeof payload.requestId === "string" &&
        payload.requestId.startsWith("tag-update:")
      ) {
        const result = await layer.updateTag({
          tagId: payload.tagId,
          expectedTagRevision: payload.expectedTagRevision,
          name: payload.name,
          parentCategoryId: payload.parentCategoryId,
          expectedParentRevision: payload.expectedParentRevision,
          requestId: payload.requestId as `tag-update:${string}`,
        })
        return {
          requestId: request.requestId,
          ok: true,
          data: {
            tagId: result.tagId,
            resultTagRevision: result.resultTagRevision,
            affectedBookmarkCount: result.affectedBookmarkCount,
          },
        }
      }

      if (request.action === "update-bookmark" && typeof payload.bookmarkId === "string" && typeof payload.expectedRevision === "number" && typeof payload.title === "string" && typeof payload.rawUrl === "string" && Array.isArray(payload.tagIds) && payload.tagIds.every((id) => typeof id === "string")) {
        const bookmark = await layer.updateBookmark({ bookmarkId: payload.bookmarkId, expectedRevision: payload.expectedRevision, title: payload.title, rawUrl: payload.rawUrl, tagIds: payload.tagIds })
        return { requestId: request.requestId, ok: true, data: { bookmarkId: bookmark.id, revision: bookmark.revision } }
      }
      if (request.action === "delete-bookmark" && typeof payload.bookmarkId === "string" && typeof payload.expectedRevision === "number") { await layer.softDeleteBookmark(payload.bookmarkId, payload.expectedRevision); return { requestId: request.requestId, ok: true, data: { deleted: true } } }
      if (request.action === "delete-tag" && typeof payload.tagId === "string" && typeof payload.expectedRevision === "number") { await layer.softDeleteTag(payload.tagId, payload.expectedRevision); return { requestId: request.requestId, ok: true, data: { deleted: true } } }
      if (request.action === "delete-category-cascade" && typeof payload.categoryId === "string" && typeof payload.expectedCategoryRevision === "number" && typeof payload.expectedImpactFingerprint === "string" && typeof payload.requestId === "string" && payload.requestId.startsWith("category-delete:") && payload.warningAcknowledged === true) {
        const result = await layer.deleteCategoryCascade({ categoryId: payload.categoryId, expectedCategoryRevision: payload.expectedCategoryRevision, expectedImpactFingerprint: payload.expectedImpactFingerprint, requestId: payload.requestId as `category-delete:${string}`, warningAcknowledged: true })
        return { requestId: request.requestId, ok: true, data: { alreadyCompleted: result.alreadyCompleted, affectedBookmarkCount: result.affectedBookmarkCount, jobsCreated: result.jobsCreated } }
      }
      if (request.action === "list-label-candidates" && typeof payload.keyword === "string") {
        const kind = payload.kind === "CATEGORY" || payload.kind === "TAG" ? payload.kind : undefined
        const limit = typeof payload.limit === "number" ? payload.limit : undefined
        const items = await layer.listLabelCandidates(payload.keyword, kind, limit)
        return { requestId: request.requestId, ok: true, data: { items: items.map((item) => ({ id: item.id, name: item.name, kind: item.kind, parentCategoryId: item.parentCategoryId, revision: item.revision, origin: item.origin, usageCount: item.usageCount })) } }
      }
      if (request.action === "get-category-edit-detail" && typeof payload.categoryId === "string") {
        const detail = await layer.getCategoryEditDetail(payload.categoryId)
        return {
          requestId: request.requestId,
          ok: true,
          data: {
            category: detail.category,
            activeTags: detail.activeTags,
            activeTagCount: detail.activeTagCount,
            referencedActiveBookmarkCount: detail.referencedActiveBookmarkCount,
            impactFingerprint: detail.impactFingerprint,
          },
        }
      }
      if (request.action === "list-bookmarks") {
        const cursor = isCursor(payload.cursor) ? payload.cursor : null
        const limit = typeof payload.limit === "number" ? payload.limit : undefined
        const result = typeof payload.labelId === "string" ? await layer.listBookmarksByLabel(payload.labelId, cursor, limit) : await layer.listRecentBookmarks(cursor, limit)
        const totalCount = "totalCount" in result && typeof result.totalCount === "number" ? result.totalCount : result.items.length
        return { requestId: request.requestId, ok: true, data: { items: result.items.map((item) => ({ id: item.id, title: item.title, normalizedUrl: item.normalizedUrl, savedAt: item.savedAt, revision: item.revision })), nextCursor: result.nextCursor ? { savedAt: result.nextCursor.savedAt, id: result.nextCursor.id } : null, totalCount } }
      }

      const classificationResponse = await handleClassificationJobMessage(layer, request)
      if (classificationResponse) {
        return classificationResponse
      }

      return { requestId: request.requestId, ok: false, error: { code: "ACTION_NOT_AVAILABLE" } }
    } catch (error: unknown) {
      if (isDomainError(error)) {
        console.error("[Bookmation] Library action failed:", error.code, error.message)
      } else {
        console.error("[Bookmation] Library action failed:", error)
      }
      return { requestId: request.requestId, ok: false, error: { code: "INTERNAL_ERROR" } }
    } finally { await layer.close() }
  } }
}
