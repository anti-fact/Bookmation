import { readFileSync } from "node:fs"
import { join } from "node:path"
import "fake-indexeddb/auto"
import { describe, expect, it, beforeEach, afterEach } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import {
  commitChromeBookmarkImport,
  previewChromeBookmarkImport,
} from "~/application/chrome-bookmark-import"
import { autoReuseFolderResolutions, parseNetscapeBookmarkHtml } from "~/domain"

const FIXTURE_PATH = join(
  process.cwd(),
  "src/domain/fixtures/chrome-bookmarks-minimal.html",
)

describe("chrome bookmark import", () => {
  let layer: LocalDataLayer

  beforeEach(async () => {
    layer = await LocalDataLayer.open(`chrome-import-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await layer.close()
  })

  it("imports without tag as unclassified when folder tag does not exist", async () => {
    const html = readFileSync(FIXTURE_PATH, "utf8")
    const entries = parseNetscapeBookmarkHtml(html).filter(
      (entry) => entry.sourceFolderName === "開発",
    )
    expect(entries).toHaveLength(1)

    const preview = await previewChromeBookmarkImport(layer, { entries })
    expect(preview.folders).toHaveLength(1)
    expect(preview.folders[0]).toMatchObject({
      folderName: "開発",
      mode: "UNCLASSIFIED",
      plannedTagName: "開発",
    })

    const result = await commitChromeBookmarkImport(layer, {
      commitRequestId: "commit-1",
      selectionFingerprint: preview.selectionFingerprint,
      entries,
      folderResolutions: autoReuseFolderResolutions(preview.folders),
    })
    expect(result.imported).toBe(1)

    const bookmark = await layer.findActiveBookmarkByNormalizedUrl(
      "https://example.com/nested",
    )
    expect(bookmark?.source).toBe("CHROME_IMPORT")
    expect(bookmark?.classificationState).toBe("UNCLASSIFIED")
  })

  it("reuses an existing tag when folder name matches", async () => {
    const html = readFileSync(FIXTURE_PATH, "utf8")
    const entries = parseNetscapeBookmarkHtml(html).filter(
      (entry) => entry.sourceFolderName === "開発",
    )
    const category = await layer.createCategory({
      id: crypto.randomUUID(),
      name: "Work",
      creationRequestId: "cat-1",
    })
    await layer.createTag({
      id: crypto.randomUUID(),
      name: "開発",
      parentCategoryId: category.id,
      expectedParentRevision: category.revision,
      creationRequestId: "tag-1",
    })

    const preview = await previewChromeBookmarkImport(layer, { entries })
    expect(preview.folders[0]).toMatchObject({ mode: "REUSE", tagName: "開発" })

    const result = await commitChromeBookmarkImport(layer, {
      commitRequestId: "commit-2",
      selectionFingerprint: preview.selectionFingerprint,
      entries,
      folderResolutions: autoReuseFolderResolutions(preview.folders),
    })
    expect(result.imported).toBe(1)

    const bookmark = await layer.findActiveBookmarkByNormalizedUrl(
      "https://example.com/nested",
    )
    expect(bookmark?.classificationState).toBe("CLASSIFIED")
  })
})
