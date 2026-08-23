import { LocalDataLayer } from "~/adapters"
import { ChromeContextMenuAdapter, createChromeContextMenusApi } from "~/adapters/chrome-context-menu"
import { ChromeLocalSettingsStore } from "~/adapters/chrome-local-settings-store"
import { createChromeHistoryPort } from "~/adapters/chrome-history-port"
import { createChromeReminderPermissionsPort } from "~/adapters/chrome-reminder-permissions"
import { safeLogError } from "~/adapters/security/log-redaction"
import { CATEGORY_TEMPLATE_CATALOG } from "~/catalogs/category-templates"
import type { ExtensionMessageResponse } from "~/extension/messages"
import { isDomainError, DomainErrorCode } from "~/domain"
import {
  assertLocalSettingsValid,
  type LocalSettings,
} from "~/domain/local-settings"

import { handleClassificationJobMessage } from "./classification-job-application"
import { handleVisitReminder } from "./handle-visit-reminder"
import {
  ReminderSettingsApplicationError,
  updateReminderSettings,
} from "./update-reminder-settings"
import {
  ContextMenuApplicationError,
  updateContextMenuBookmarkEnabled,
} from "./update-context-menu-setting"
import {
  applyCategoryTemplates,
  getCategoryTemplateCatalog,
  type CategoryTemplateReceiptStore,
} from "./category-templates"
import type { ExtensionMessageApplication } from "./extension-message-application"
import { evaluateVisitReminders } from "./evaluate-visit-reminders"
import { toGeneralSettingsSnapshotData } from "./general-settings-snapshot"
import { getPendingVisitReminder } from "./get-pending-visit-reminder"
import {
  commitChromeBookmarkImport,
  previewChromeBookmarkImport,
} from "./chrome-bookmark-import"
import type { ParsedChromeBookmarkEntry } from "~/domain"

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

function parseImportEntries(value: unknown): ParsedChromeBookmarkEntry[] | null {
  if (!Array.isArray(value)) return null
  const entries: ParsedChromeBookmarkEntry[] = []
  for (const item of value) {
    const record = item as Record<string, unknown>
    if (
      typeof record.entryId !== "string" ||
      typeof record.url !== "string" ||
      typeof record.title !== "string" ||
      !(record.sourceFolderName === null || typeof record.sourceFolderName === "string")
    ) {
      return null
    }
    entries.push({
      entryId: record.entryId,
      url: record.url,
      title: record.title,
      sourceFolderName: record.sourceFolderName,
    })
  }
  return entries
}

function parseFolderResolutions(value: unknown) {
  if (!Array.isArray(value)) return null
  const resolutions = []
  for (const item of value) {
    const record = item as Record<string, unknown>
    if (record.mode === "REUSE") {
      if (
        typeof record.sourceFolderKey !== "string" ||
        typeof record.tagId !== "string" ||
        typeof record.expectedTagRevision !== "number"
      ) {
        return null
      }
      resolutions.push({
        mode: "REUSE" as const,
        sourceFolderKey: record.sourceFolderKey,
        tagId: record.tagId,
        expectedTagRevision: record.expectedTagRevision,
      })
      continue
    }
    if (record.mode === "UNCLASSIFIED") {
      if (typeof record.sourceFolderKey !== "string") {
        return null
      }
      resolutions.push({
        mode: "UNCLASSIFIED" as const,
        sourceFolderKey: record.sourceFolderKey,
      })
      continue
    }
    if (record.mode === "SKIP") {
      if (typeof record.sourceFolderKey !== "string") return null
      resolutions.push({
        mode: "SKIP" as const,
        sourceFolderKey: record.sourceFolderKey,
      })
      continue
    }
    return null
  }
  return resolutions
}

/** BE-04/05 actionをChrome境界からApplicationへ集約する。 */
export function createLibraryApplication(
  save: ExtensionMessageApplication,
  categoryTemplateReceipts: CategoryTemplateReceiptStore,
): ExtensionMessageApplication {
  return {
    async handle(request): Promise<ExtensionMessageResponse> {
      if (request.action === "save-current-tab" || request.action === "save-bookmark-by-url") {
        return save.handle(request)
      }

      if (request.action === "get-general-settings-snapshot") {
        const settings = await new ChromeLocalSettingsStore().get()
        return {
          requestId: request.requestId,
          ok: true,
          data: toGeneralSettingsSnapshotData(settings),
        }
      }

      if (request.action === "update-reminder-settings") {
        const reminderPayload = record(request.payload)
        if (!reminderPayload) {
          return invalid(request.requestId)
        }
        const patch: {
          frequentVisitReminderEnabled?: boolean
          frequentVisitWindow?: "LAST_7_DAYS" | "LAST_30_DAYS" | "LAST_365_DAYS" | null
          frequentVisitDayThreshold?: number | null
        } = {}
        if (typeof reminderPayload.frequentVisitReminderEnabled === "boolean") {
          patch.frequentVisitReminderEnabled = reminderPayload.frequentVisitReminderEnabled
        }
        if (
          reminderPayload.frequentVisitWindow === null ||
          reminderPayload.frequentVisitWindow === "LAST_7_DAYS" ||
          reminderPayload.frequentVisitWindow === "LAST_30_DAYS" ||
          reminderPayload.frequentVisitWindow === "LAST_365_DAYS"
        ) {
          if (reminderPayload.frequentVisitWindow !== undefined) {
            patch.frequentVisitWindow = reminderPayload.frequentVisitWindow
          }
        } else if (reminderPayload.frequentVisitWindow !== undefined) {
          return invalid(request.requestId)
        }
        if (reminderPayload.frequentVisitDayThreshold === null) {
          patch.frequentVisitDayThreshold = null
        } else if (typeof reminderPayload.frequentVisitDayThreshold === "number") {
          patch.frequentVisitDayThreshold = reminderPayload.frequentVisitDayThreshold
        }
        try {
          const settings = await updateReminderSettings(
            new ChromeLocalSettingsStore(),
            createChromeReminderPermissionsPort(chrome.permissions),
            patch,
          )
          return {
            requestId: request.requestId,
            ok: true,
            data: toGeneralSettingsSnapshotData(settings),
          }
        } catch (error: unknown) {
          if (error instanceof ReminderSettingsApplicationError) {
            return {
              requestId: request.requestId,
              ok: false,
              error: { code: "REMINDER_PERMISSION_DENIED" },
            }
          }
          if (
            isDomainError(error) &&
            (error.code === DomainErrorCode.SETTINGS_FREQUENT_VISIT_DAY_THRESHOLD_INVALID ||
              error.code === DomainErrorCode.SETTINGS_FREQUENT_VISIT_WINDOW_INVALID)
          ) {
            return {
              requestId: request.requestId,
              ok: false,
              error: { code: "REMINDER_CONFIG_INVALID" },
            }
          }
          throw error
        }
      }

      if (request.action === "update-general-settings") {
        const updatePayload = record(request.payload)
        if (!updatePayload) return invalid(request.requestId)
        const allowedKeys = new Set([
          "autoArchiveEnabled",
          "archiveAfterDays",
          "aiGranularity",
        ])
        if (Object.keys(updatePayload).some((key) => !allowedKeys.has(key))) {
          return invalid(request.requestId)
        }
        if (
          updatePayload.autoArchiveEnabled === true &&
          !(await chrome.permissions.contains({ permissions: ["history"] }))
        ) {
          return {
            requestId: request.requestId,
            ok: false,
            error: { code: "ARCHIVE_HISTORY_PERMISSION_REQUIRED" },
          }
        }
        const store = new ChromeLocalSettingsStore()
        const current = await store.get()
        const next = { ...current, ...updatePayload } as LocalSettings
        try {
          assertLocalSettingsValid(next)
        } catch {
          return invalid(request.requestId)
        }
        await store.set(next)
        return {
          requestId: request.requestId,
          ok: true,
          data: toGeneralSettingsSnapshotData(next),
        }
      }

      if (request.action === "get-pending-visit-reminder") {
        try {
          await evaluateVisitReminders({
            settingsStore: new ChromeLocalSettingsStore(),
            history: createChromeHistoryPort(chrome.history),
          })
        } catch (error: unknown) {
          safeLogError("Visit reminder evaluation", error)
        }
        const pending = await getPendingVisitReminder()
        return {
          requestId: request.requestId,
          ok: true,
          data: pending,
        }
      }

      if (request.action === "handle-visit-reminder") {
        const reminderPayload = record(request.payload)
        if (
          !reminderPayload ||
          typeof reminderPayload.reminderId !== "string" ||
          (reminderPayload.response !== "yes" &&
            reminderPayload.response !== "no" &&
            reminderPayload.response !== "dismissed")
        ) {
          return invalid(request.requestId)
        }
        try {
          const result = await handleVisitReminder({
            reminderId: reminderPayload.reminderId,
            response: reminderPayload.response,
            suppressFuture: reminderPayload.suppressFuture === true,
          })
          return {
            requestId: request.requestId,
            ok: true,
            data: result,
          }
        } catch {
          return {
            requestId: request.requestId,
            ok: false,
            error: { code: "INTERNAL_ERROR" },
          }
        }
      }

      if (request.action === "set-context-menu-bookmark-enabled") {
        const togglePayload = record(request.payload)
        if (!togglePayload || typeof togglePayload.enabled !== "boolean") {
          return invalid(request.requestId)
        }
        try {
          await updateContextMenuBookmarkEnabled(
            new ChromeLocalSettingsStore(),
            new ChromeContextMenuAdapter(createChromeContextMenusApi(chrome.contextMenus)),
            togglePayload.enabled,
          )
          const settings = await new ChromeLocalSettingsStore().get()
          return {
            requestId: request.requestId,
            ok: true,
            data: toGeneralSettingsSnapshotData(settings),
          }
        } catch (error: unknown) {
          if (error instanceof ContextMenuApplicationError) {
            return {
              requestId: request.requestId,
              ok: false,
              error: { code: "INTERNAL_ERROR" },
            }
          }
          throw error
        }
      }

    const payload = record(request.payload)
    if (!payload) return invalid(request.requestId)
    const layer = await LocalDataLayer.open()
    try {
      if (request.action === "get-category-template-catalog") {
        const catalog = getCategoryTemplateCatalog(CATEGORY_TEMPLATE_CATALOG)
        return {
          requestId: request.requestId,
          ok: true,
          data: {
            version: catalog.version,
            locale: catalog.locale,
            templates: catalog.templates.map((template) => ({
              id: template.id,
              name: template.name,
              setId: template.setId,
            })),
          },
        }
      }
      if (
        request.action === "apply-category-templates" &&
        typeof payload.catalogVersion === "string" &&
        typeof payload.requestId === "string" &&
        Array.isArray(payload.templateIds) &&
        payload.templateIds.every((id) => typeof id === "string")
      ) {
        const receipt = await applyCategoryTemplates(
          {
            catalogVersion: payload.catalogVersion,
            templateIds: payload.templateIds,
            requestId: payload.requestId,
          },
          {
            catalog: CATEGORY_TEMPLATE_CATALOG,
            repository: layer,
            receipts: categoryTemplateReceipts,
          },
        )
        return {
          requestId: request.requestId,
          ok: true,
          data: {
            requestId: receipt.requestId,
            results: receipt.results.map((result) => ({
              templateId: result.templateId,
              status: result.status,
              categoryId: result.categoryId ?? null,
              errorCode: result.errorCode ?? null,
            })),
          },
        }
      }
      if (request.action === "create-category" && typeof payload.name === "string") {
        const category = await layer.createCategory({
          id: crypto.randomUUID(),
          name: payload.name,
          creationRequestId: request.requestId,
        })
        return {
          requestId: request.requestId,
          ok: true,
          data: { categoryId: category.id, name: category.name, revision: category.revision },
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
          data: { tagId: tag.id, name: tag.name, revision: tag.revision, parentCategoryId: tag.parentCategoryId },
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
        return { requestId: request.requestId, ok: true, data: { items: items.map((item) => ({ id: item.id, name: item.name, kind: item.kind, parentCategoryId: item.parentCategoryId, parentCategoryName: item.parentCategoryName, revision: item.revision, origin: item.origin, usageCount: item.usageCount })) } }
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
      if (request.action === "search-library" && typeof payload.keyword === "string") {
        if (payload.mode === "SUGGEST") {
          const items = await layer.suggestAllByKeyword(payload.keyword, 8)
          return {
            requestId: request.requestId,
            ok: true,
            data: {
              source: "LEXICAL_FALLBACK",
              items: items.map((item) => ({
                entityType: item.entityType,
                entityId: item.entityId,
                entityRevision: item.entityRevision,
                labelKind: item.labelKind,
                parentCategoryId: item.parentCategoryId,
                displayText: item.displayText,
                matchedFields: item.matchedFields,
              })),
            },
          }
        }
        const result = await layer.searchAllByKeyword(payload.keyword, 8)
        return { requestId: request.requestId, ok: true, data: {
          source: "LEXICAL_FALLBACK",
          labels: result.labels.map((label) => ({ id: label.id, name: label.name, kind: label.kind, parentCategoryId: label.parentCategoryId, revision: label.revision })),
          bookmarks: result.bookmarks.map((bookmark) => ({ id: bookmark.id, title: bookmark.title, normalizedUrl: bookmark.normalizedUrl, revision: bookmark.revision })),
        } }
      }

      if (request.action === "preview-chrome-bookmarks-import") {
        const entries = parseImportEntries(payload.entries)
        if (!entries) return invalid(request.requestId)
        const preview = await previewChromeBookmarkImport(layer, { entries })
        return { requestId: request.requestId, ok: true, data: preview as unknown as import("~/domain").JsonValue }
      }

      if (request.action === "commit-chrome-bookmarks-import") {
        const entries = parseImportEntries(payload.entries)
        const folderResolutions = parseFolderResolutions(payload.folderResolutions)
        if (
          !entries ||
          !folderResolutions ||
          typeof payload.commitRequestId !== "string" ||
          typeof payload.selectionFingerprint !== "string"
        ) {
          return invalid(request.requestId)
        }
        const result = await commitChromeBookmarkImport(layer, {
          commitRequestId: payload.commitRequestId,
          selectionFingerprint: payload.selectionFingerprint,
          entries,
          folderResolutions,
        })
        return { requestId: request.requestId, ok: true, data: result as unknown as import("~/domain").JsonValue }
      }

      const classificationResponse = await handleClassificationJobMessage(layer, request)
      if (classificationResponse) {
        return classificationResponse
      }

      return { requestId: request.requestId, ok: false, error: { code: "ACTION_NOT_AVAILABLE" } }
    } catch (error: unknown) {
      if (isDomainError(error)) {
        safeLogError("Library action rejected", error)
        return { requestId: request.requestId, ok: false, error: { code: error.code } }
      } else {
        safeLogError("Library action failed", error)
      }
      return { requestId: request.requestId, ok: false, error: { code: "INTERNAL_ERROR" } }
    } finally { await layer.close() }
  } }
}
