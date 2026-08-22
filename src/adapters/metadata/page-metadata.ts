import type { LocalDataLayerPort } from "~/ports/repositories"

const MAX_HTML_BYTES = 512_000
const MAX_IMAGE_BYTES = 512_000
const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
])

export interface ParsedPageMetadata {
  title: string | null
  faviconUrl: string | null
  thumbnailUrl: string | null
}

export function parsePageMetadata(html: string, pageUrl: string): ParsedPageMetadata {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null

  const faviconMatch =
    html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]*>/i) ??
    html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]*>/i)
  const faviconHref = faviconMatch
    ? faviconMatch[0].match(/href=["']([^"']+)["']/i)?.[1] ?? null
    : null

  const ogImageMatch = html.match(
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  )
  const twitterImageMatch = html.match(
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  )

  return {
    title,
    faviconUrl: resolveUrl(faviconHref, pageUrl),
    thumbnailUrl: resolveUrl(
      ogImageMatch?.[1] ?? twitterImageMatch?.[1] ?? null,
      pageUrl,
    ),
  }
}

function resolveUrl(href: string | null, base: string): string | null {
  if (!href) {
    return null
  }
  try {
    return new URL(href, base).href
  } catch {
    return null
  }
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) {
    return null
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_HTML_BYTES) {
    return null
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer)
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) {
    return null
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? ""
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
    return null
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
    return null
  }
  return new Blob([buffer], { type: mimeType })
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function applyUrlMetadataFetch(
  data: LocalDataLayerPort,
  input: {
    bookmarkId: string
    expectedRevision: number
    rawUrl: string
    fallbackTitle: string
    fetchThumbnail: boolean
  },
): Promise<void> {
  const html = await fetchText(input.rawUrl)
  if (!html) {
    return
  }

  const parsed = parsePageMetadata(html, input.rawUrl)
  const title = parsed.title?.trim() || input.fallbackTitle

  let faviconBlobId: string | null = null
  let faviconUrl = parsed.faviconUrl
  if (!faviconUrl) {
    try {
      faviconUrl = new URL("/favicon.ico", input.rawUrl).href
    } catch {
      faviconUrl = null
    }
  }

  if (faviconUrl) {
    const blob = await fetchImageBlob(faviconUrl)
    if (blob) {
      const buffer = await blob.arrayBuffer()
      faviconBlobId = crypto.randomUUID()
      await data.putBlobRecord({
        id: faviconBlobId,
        kind: "FAVICON",
        mimeType: blob.type,
        byteLength: buffer.byteLength,
        data: blob,
        contentHash: await sha256Hex(buffer),
      })
    }
  }

  let thumbnailBlobId: string | null = null
  if (input.fetchThumbnail && parsed.thumbnailUrl) {
    const blob = await fetchImageBlob(parsed.thumbnailUrl)
    if (blob) {
      const buffer = await blob.arrayBuffer()
      thumbnailBlobId = crypto.randomUUID()
      await data.putBlobRecord({
        id: thumbnailBlobId,
        kind: "THUMBNAIL",
        mimeType: blob.type,
        byteLength: buffer.byteLength,
        data: blob,
        contentHash: await sha256Hex(buffer),
      })
    }
  }

  await data.updateBookmarkMetadata({
    bookmarkId: input.bookmarkId,
    expectedRevision: input.expectedRevision,
    title,
    faviconUrl,
    faviconBlobId,
    thumbnailBlobId,
  })
}

export async function applyFaviconUrlFetch(
  data: LocalDataLayerPort,
  input: {
    bookmarkId: string
    expectedRevision: number
    faviconUrl: string
    fetchThumbnail: boolean
    pageUrl: string
  },
): Promise<void> {
  let faviconBlobId: string | null = null
  const blob = await fetchImageBlob(input.faviconUrl)
  if (blob) {
    const buffer = await blob.arrayBuffer()
    faviconBlobId = crypto.randomUUID()
    await data.putBlobRecord({
      id: faviconBlobId,
      kind: "FAVICON",
      mimeType: blob.type,
      byteLength: buffer.byteLength,
      data: blob,
      contentHash: await sha256Hex(buffer),
    })
  }

  let thumbnailBlobId: string | null = null
  if (input.fetchThumbnail) {
    const html = await fetchText(input.pageUrl)
    if (html) {
      const parsed = parsePageMetadata(html, input.pageUrl)
      if (parsed.thumbnailUrl) {
        const thumbBlob = await fetchImageBlob(parsed.thumbnailUrl)
        if (thumbBlob) {
          const buffer = await thumbBlob.arrayBuffer()
          thumbnailBlobId = crypto.randomUUID()
          await data.putBlobRecord({
            id: thumbnailBlobId,
            kind: "THUMBNAIL",
            mimeType: thumbBlob.type,
            byteLength: buffer.byteLength,
            data: thumbBlob,
            contentHash: await sha256Hex(buffer),
          })
        }
      }
    }
  }

  await data.updateBookmarkMetadata({
    bookmarkId: input.bookmarkId,
    expectedRevision: input.expectedRevision,
    faviconUrl: input.faviconUrl,
    faviconBlobId,
    thumbnailBlobId,
  })
}
