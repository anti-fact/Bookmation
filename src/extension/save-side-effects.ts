import { applyFaviconUrlFetch, applyUrlMetadataFetch } from "~/adapters/metadata/page-metadata"
import { safeLogWarning } from "~/adapters/security/log-redaction"
import type { LocalDataLayerPort } from "~/ports/repositories"
import type { SaveBookmarkResult } from "~/application/save-bookmark"

export function scheduleBookmarkMetadataFetch(
  data: LocalDataLayerPort,
  result: SaveBookmarkResult,
  input: {
    rawUrl: string
    faviconUrl?: string | null
    source: "CURRENT_TAB" | "MANUAL_URL" | "CONTEXT_PAGE" | "CONTEXT_LINK"
  },
): void {
  if (result.duplicate) {
    return
  }

  const task = async (): Promise<void> => {
    try {
      if (
        input.source === "MANUAL_URL" ||
        input.source === "CONTEXT_PAGE" ||
        input.source === "CONTEXT_LINK"
      ) {
        await applyUrlMetadataFetch(data, {
          bookmarkId: result.bookmarkId,
          expectedRevision: result.revision,
          rawUrl: input.rawUrl,
          fallbackTitle: result.title,
          fetchThumbnail: true,
        })
        return
      }

      if (input.faviconUrl) {
        await applyFaviconUrlFetch(data, {
          bookmarkId: result.bookmarkId,
          expectedRevision: result.revision,
          faviconUrl: input.faviconUrl,
          fetchThumbnail: true,
          pageUrl: input.rawUrl,
        })
      }
    } catch (error: unknown) {
      safeLogWarning("Metadata fetch", error instanceof Error ? error.message : "failed")
    }
  }

  void task()
}

export async function showDuplicateBadge(
  action: Pick<typeof chrome.action, "setBadgeText" | "setBadgeBackgroundColor">,
  durationMs: number = 2500,
): Promise<void> {
  await action.setBadgeBackgroundColor({ color: "#4A5568" })
  await action.setBadgeText({ text: "済" })
  setTimeout(() => {
    void action.setBadgeText({ text: "" })
  }, durationMs)
}
