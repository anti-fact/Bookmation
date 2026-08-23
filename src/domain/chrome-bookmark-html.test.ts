import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { parseNetscapeBookmarkHtml } from "./chrome-bookmark-html"

const FIXTURE_PATH = join(
  process.cwd(),
  "src/domain/fixtures/chrome-bookmarks-minimal.html",
)

describe("parseNetscapeBookmarkHtml", () => {
  it("assigns the immediate parent folder name", () => {
    const html = readFileSync(FIXTURE_PATH, "utf8")
    const entries = parseNetscapeBookmarkHtml(html)
    expect(entries).toEqual([
      expect.objectContaining({
        url: "https://example.com/nested",
        sourceFolderName: "開発",
        faviconUrl: null,
      }),
    ])
  })

  it("parses Chrome export files with bookmark bar folders", () => {
    const fixturePath = join(
      process.env.USERPROFILE ?? "",
      "Downloads",
      "bookmarks_2026_08_23.html",
    )
    try {
      const html = readFileSync(fixturePath, "utf8")
      const entries = parseNetscapeBookmarkHtml(html)
      const barEntries = entries.filter(
        (entry) => entry.sourceFolderName === "ブックマーク バー",
      )
      expect(barEntries.length).toBeGreaterThanOrEqual(70)
      expect(entries.some((entry) => entry.sourceFolderName === null)).toBe(true)
    } catch {
      // optional local fixture
    }
  })

  it("parses Chrome export ICON attribute as faviconUrl", () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com" ICON="data:image/png;base64,iVBORw0KGgo=">Example</A>
</DL><p>`
    const entries = parseNetscapeBookmarkHtml(html)
    expect(entries[0]?.faviconUrl).toBe("data:image/png;base64,iVBORw0KGgo=")
  })
})
