import { readFileSync } from "node:fs"
import { join } from "node:path"
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { createIndexedDbChromeBookmarkImportPort } from "~/adapters/indexeddb-chrome-bookmark-import-port"
import { autoReuseFolderResolutions, parseNetscapeBookmarkHtml } from "~/domain"

const FIXTURE_PATH = join(
  process.cwd(),
  "src/domain/fixtures/chrome-bookmarks-minimal.html",
)

describe("createIndexedDbChromeBookmarkImportPort", () => {
  let layer: LocalDataLayer

  beforeEach(async () => {
    layer = await LocalDataLayer.open()
  })

  afterEach(async () => {
    await layer.close()
  })

  it("previews and commits without extension messaging", async () => {
    const port = createIndexedDbChromeBookmarkImportPort()
    const entries = parseNetscapeBookmarkHtml(readFileSync(FIXTURE_PATH, "utf8")).filter(
      (entry) => entry.sourceFolderName === "開発",
    )

    const preview = await port.preview(entries)
    expect(preview.entries).toHaveLength(1)
    expect(preview.folders[0]).toMatchObject({ folderName: "開発", mode: "UNCLASSIFIED" })

    const result = await port.commit({
      commitRequestId: "commit-import-port",
      selectionFingerprint: preview.selectionFingerprint,
      entries,
      folderResolutions: autoReuseFolderResolutions(preview.folders),
    })
    expect(result.imported).toBe(1)
  })
})
