import { describe, expect, it } from "vitest"

import { parsePageMetadata } from "./page-metadata"

describe("parsePageMetadata", () => {
  it("extracts title, favicon, and og:image", () => {
    const html = `<!doctype html>
<html>
<head>
  <title>  Example Page  </title>
  <link rel="icon" href="/icon.png">
  <meta property="og:image" content="https://cdn.example.com/preview.jpg">
</head>
<body></body>
</html>`

    const parsed = parsePageMetadata(html, "https://example.com/article")

    expect(parsed.title).toBe("Example Page")
    expect(parsed.faviconUrl).toBe("https://example.com/icon.png")
    expect(parsed.thumbnailUrl).toBe("https://cdn.example.com/preview.jpg")
  })
})
