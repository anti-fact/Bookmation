import { readFileSync } from "node:fs"
import { join } from "node:path"
import "fake-indexeddb/auto"
import { describe, expect, it } from "vitest"

import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { parseNetscapeBookmarkHtml } from "~/domain/chrome-bookmark-html"
import { parseExtensionMessage } from "~/extension/messages"

import { previewChromeBookmarkImport } from "./chrome-bookmark-import"

describe("chrome bookmark import message size", () => {
  it("keeps preview request and response under extension limits", async () => {
    const fixturePath = join(
      process.env.USERPROFILE ?? "",
      "Downloads",
      "bookmarks_2026_08_23.html",
    )
    const html = readFileSync(fixturePath, "utf8")
    const entries = parseNetscapeBookmarkHtml(html)
    expect(entries.length).toBeGreaterThan(0)

    const request = {
      action: "preview-chrome-bookmarks-import" as const,
      payload: { entries: [...entries] },
      requestId: "preview-size-test",
      schemaVersion: 1 as const,
      source: "dashboard" as const,
    }
    expect(parseExtensionMessage(request)).not.toBeNull()

    const layer = await LocalDataLayer.open()
    try {
      const preview = await previewChromeBookmarkImport(layer, { entries })
      const response = { requestId: request.requestId, ok: true as const, data: preview }
      const responseBytes = new TextEncoder().encode(JSON.stringify(response)).byteLength
      expect(responseBytes).toBeLessThan(64 * 1024)
    } finally {
      await layer.close()
    }
  })
})
