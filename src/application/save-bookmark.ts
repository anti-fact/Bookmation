import type {
  LocalDataLayerPort,
  SaveBookmarkWithJobResult,
} from "~/ports/repositories"
import { resolveBookmarkTitle } from "~/domain"

import { hostnameFromUrl } from "./save-bookmark-hostname"

export interface SaveBookmarkResult {
  bookmarkId: string
  title: string
  normalizedUrl: string
  duplicate: boolean
  savedAt: number
  revision: number
}

export class SaveBookmarkUseCase {
  constructor(private readonly data: LocalDataLayerPort) {}

  async saveCurrentTab(params: {
    rawUrl: string
    title: string
    faviconUrl?: string | null
    creationRequestId: string
  }): Promise<SaveBookmarkResult> {
    const title = pickTitle(params.title, params.rawUrl)
    const result = await this.data.saveBookmarkWithJob({
      id: crypto.randomUUID(),
      jobId: crypto.randomUUID(),
      rawUrl: params.rawUrl,
      title,
      faviconUrl: params.faviconUrl ?? null,
      source: "CURRENT_TAB",
      creationRequestId: params.creationRequestId,
    })
    return toSaveBookmarkResult(result)
  }

  async saveByUrl(params: {
    rawUrl: string
    title?: string
    tagIds?: readonly string[]
    creationRequestId: string
  }): Promise<SaveBookmarkResult> {
    return this.saveWithSource({
      rawUrl: params.rawUrl,
      title: params.title ?? "",
      tagIds: params.tagIds,
      source: "MANUAL_URL",
      creationRequestId: params.creationRequestId,
    })
  }

  async saveFromContextPage(params: {
    rawUrl: string
    creationRequestId: string
  }): Promise<SaveBookmarkResult> {
    return this.saveWithSource({
      rawUrl: params.rawUrl,
      title: "",
      source: "CONTEXT_PAGE",
      creationRequestId: params.creationRequestId,
    })
  }

  async saveFromContextLink(params: {
    rawUrl: string
    title?: string
    creationRequestId: string
  }): Promise<SaveBookmarkResult> {
    return this.saveWithSource({
      rawUrl: params.rawUrl,
      title: params.title ?? "",
      source: "CONTEXT_LINK",
      creationRequestId: params.creationRequestId,
    })
  }

  async saveFromVisitReminder(params: {
    rawUrl: string
    title?: string
    creationRequestId: string
  }): Promise<SaveBookmarkResult> {
    return this.saveWithSource({
      rawUrl: params.rawUrl,
      title: params.title ?? "",
      source: "VISIT_REMINDER",
      creationRequestId: params.creationRequestId,
    })
  }

  private async saveWithSource(params: {
    rawUrl: string
    title: string
    tagIds?: readonly string[]
    source: "MANUAL_URL" | "CONTEXT_PAGE" | "CONTEXT_LINK" | "VISIT_REMINDER"
    creationRequestId: string
  }): Promise<SaveBookmarkResult> {
    const title = pickTitle(params.title, params.rawUrl)
    const result = await this.data.saveBookmarkWithJob({
      id: crypto.randomUUID(),
      jobId: crypto.randomUUID(),
      rawUrl: params.rawUrl,
      title,
      source: params.source,
      tagIds: params.tagIds,
      creationRequestId: params.creationRequestId,
    })
    return toSaveBookmarkResult(result)
  }
}

function pickTitle(title: string, rawUrl: string): string {
  return resolveBookmarkTitle(title, hostnameFromUrl(rawUrl))
}

export { hostnameFromUrl } from "./save-bookmark-hostname"

function toSaveBookmarkResult(
  result: SaveBookmarkWithJobResult,
): SaveBookmarkResult {
  return {
    bookmarkId: result.bookmark.id,
    title: result.bookmark.title,
    normalizedUrl: result.bookmark.normalizedUrl,
    duplicate: result.duplicate,
    savedAt: result.bookmark.savedAt,
    revision: result.bookmark.revision,
  }
}
