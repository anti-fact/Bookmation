import type {
  LocalDataLayerPort,
  SaveBookmarkWithJobResult,
} from "~/ports/repositories"

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
    creationRequestId: string
  }): Promise<SaveBookmarkResult> {
    const title = pickTitle(params.title ?? "", params.rawUrl)
    const result = await this.data.saveBookmarkWithJob({
      id: crypto.randomUUID(),
      jobId: crypto.randomUUID(),
      rawUrl: params.rawUrl,
      title,
      source: "MANUAL_URL",
      creationRequestId: params.creationRequestId,
    })
    return toSaveBookmarkResult(result)
  }
}

function pickTitle(title: string, rawUrl: string): string {
  const trimmed = title.trim()
  if (trimmed.length > 0) {
    return trimmed
  }
  return hostnameFromUrl(rawUrl)
}

export function hostnameFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname
  } catch {
    return rawUrl
  }
}

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
