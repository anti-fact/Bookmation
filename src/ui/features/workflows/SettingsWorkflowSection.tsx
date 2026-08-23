import * as React from "react"

import { ChromeBookmarkImportPanel } from "~/ui/features/settings/ChromeBookmarkImportPanel"
import type { ChromeBookmarkImportPort } from "~/ui/features/settings/chrome-bookmark-import-port"

import { ChromeBookmarkImportDialog } from "./ChromeBookmarkImportDialog"
import { ShareWorkflowPanel } from "./ShareWorkflowPanel"
import type { BookmarkImportPort, ShareWorkflowPort } from "./workflow-ports"

export function SettingsWorkflowSection({
  bookmarkImportPort,
  chromeBookmarkImportPort,
  onBookmarksImported,
  shareWorkflowPort
}: {
  bookmarkImportPort: BookmarkImportPort
  chromeBookmarkImportPort: ChromeBookmarkImportPort
  onBookmarksImported?: () => void
  shareWorkflowPort: ShareWorkflowPort
}) {
  return (
    <React.Fragment>
      <div className="space-y-6">
        <ShareWorkflowPanel port={shareWorkflowPort} />
        <ChromeBookmarkImportDialog port={bookmarkImportPort} />
        <ChromeBookmarkImportPanel
          importPort={chromeBookmarkImportPort}
          onImported={onBookmarksImported}
        />
      </div>
    </React.Fragment>
  )
}
