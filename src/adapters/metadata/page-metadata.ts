import type { LocalDataLayerPort } from "~/ports/repositories"
import {
  MAX_FAVICON_BYTES,
  MAX_HTML_FETCH_BYTES,
  MAX_THUMBNAIL_BYTES,
} from "~/domain/security"

import { validateImageBytes } from "../blob/validated-image-blob"

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
  if (buffer.byteLength > MAX_HTML_FETCH_BYTES) {
    return null
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer)
}

async function fetchValidatedImage(url: string, maxBytes: number) {
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) {
    return null
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? ""
  const buffer = await response.arrayBuffer()
  return validateImageBytes(buffer, mimeType, maxBytes)
}

async function storeValidatedImage(
  data: LocalDataLayerPort,
  validated: NonNullable<Awaited<ReturnType<typeof fetchValidatedImage>>>,
  kind: "THUMBNAIL" | "FAVICON",
): Promise<string> {
  const id = crypto.randomUUID()
  await data.putBlobRecord({
    id,
    kind,
    mimeType: validated.mimeType,
    byteLength: validated.byteLength,
    width: validated.width,
    height: validated.height,
    data: validated.blob,
    contentHash: validated.contentHash,
  })
  return id
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
    const validated = await fetchValidatedImage(faviconUrl, MAX_FAVICON_BYTES)
    if (validated) {
      faviconBlobId = await storeValidatedImage(data, validated, "FAVICON")
    }
  }

  let thumbnailBlobId: string | null = null
  if (input.fetchThumbnail && parsed.thumbnailUrl) {
    const validated = await fetchValidatedImage(parsed.thumbnailUrl, MAX_THUMBNAIL_BYTES)
    if (validated) {
      thumbnailBlobId = await storeValidatedImage(data, validated, "THUMBNAIL")
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
  const faviconValidated = await fetchValidatedImage(input.faviconUrl, MAX_FAVICON_BYTES)
  if (faviconValidated) {
    faviconBlobId = await storeValidatedImage(data, faviconValidated, "FAVICON")
  }

  let thumbnailBlobId: string | null = null
  if (input.fetchThumbnail) {
    const html = await fetchText(input.pageUrl)
    if (html) {
      const parsed = parsePageMetadata(html, input.pageUrl)
      if (parsed.thumbnailUrl) {
        const thumbValidated = await fetchValidatedImage(
          parsed.thumbnailUrl,
          MAX_THUMBNAIL_BYTES,
        )
        if (thumbValidated) {
          thumbnailBlobId = await storeValidatedImage(data, thumbValidated, "THUMBNAIL")
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
