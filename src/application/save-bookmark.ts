import { LocalDataLayer } from "~/adapters"
import { validateAndNormalizeUrl } from "~/domain"
import type { ExtensionMessageApplication } from "./extension-message-application"

type Tab = { url?: string; title?: string; favIconUrl?: string }
export type TabReader = { query(queryInfo: { active: boolean; lastFocusedWindow: boolean }): Promise<Tab[]> }
const bad = (requestId: string) => ({ requestId, ok: false as const, error: { code: "INVALID_MESSAGE" as const } })

export function createBookmarkSaveApplication(tabReader: TabReader): ExtensionMessageApplication {
  return { async handle(request) {
    if (request.action !== "save-current-tab" && request.action !== "save-bookmark-by-url") return { requestId: request.requestId, ok: false, error: { code: "ACTION_NOT_AVAILABLE" } }
    const tab = request.action === "save-current-tab" ? (await tabReader.query({ active: true, lastFocusedWindow: true }))[0] : undefined
    const rawUrl = request.action === "save-current-tab" ? tab?.url : request.payload.url
    if (!rawUrl) return bad(request.requestId)
    let normalized: string; try { normalized = validateAndNormalizeUrl(rawUrl).normalized } catch { return bad(request.requestId) }
    const layer = await LocalDataLayer.open()
    try {
      const duplicate = await layer.findActiveBookmarkByNormalizedUrl(normalized)
      if (duplicate) return { requestId: request.requestId, ok: true, data: { outcome: "DUPLICATE", bookmarkId: duplicate.id, jobId: null } }
      const title = request.action === "save-current-tab" ? tab?.title : request.payload.title
      const saved = await layer.saveBookmarkWithJob({ id: crypto.randomUUID(), jobId: crypto.randomUUID(), creationRequestId: request.requestId, rawUrl, title: title?.trim() || new URL(normalized).hostname, siteName: new URL(normalized).hostname, faviconUrl: tab?.favIconUrl ?? null, source: request.action === "save-current-tab" ? "CURRENT_TAB" : "MANUAL_URL" })
      return { requestId: request.requestId, ok: true, data: { outcome: "SAVED", bookmarkId: saved.bookmark.id, jobId: saved.job.id } }
    } catch { return { requestId: request.requestId, ok: false, error: { code: "INTERNAL_ERROR" } } } finally { await layer.close() }
  } }
}
