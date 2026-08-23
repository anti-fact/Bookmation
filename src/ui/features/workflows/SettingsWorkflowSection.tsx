import { ChromeBookmarkImportDialog } from "./ChromeBookmarkImportDialog"
import { ShareWorkflowPanel } from "./ShareWorkflowPanel"
import type { BookmarkImportPort, ShareWorkflowPort } from "./workflow-ports"

export function SettingsWorkflowSection({
  bookmarkImportPort,
  shareWorkflowPort
}: {
  bookmarkImportPort: BookmarkImportPort
  shareWorkflowPort: ShareWorkflowPort
}) {
  return (
    <React.Fragment>
      <div className="space-y-6">
        <ShareWorkflowPanel port={shareWorkflowPort} />
        <ChromeBookmarkImportDialog port={bookmarkImportPort} />
      </div>
    </React.Fragment>
  )
}
import * as React from "react"
