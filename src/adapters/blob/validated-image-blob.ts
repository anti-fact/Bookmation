import {
  isAllowedImageMimeType,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
} from "~/domain/security"

export type ValidatedImageBlob = Readonly<{
  blob: Blob
  mimeType: string
  byteLength: number
  width: number
  height: number
  contentHash: string
}>

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function readImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | null {
  if (mimeType === "image/png") {
    return readPngDimensions(bytes)
  }
  if (mimeType === "image/jpeg") {
    return readJpegDimensions(bytes)
  }
  if (mimeType === "image/gif") {
    return readGifDimensions(bytes)
  }
  if (mimeType === "image/webp") {
    return readWebpDimensions(bytes)
  }
  if (mimeType === "image/x-icon" || mimeType === "image/vnd.microsoft.icon") {
    return readIcoDimensions(bytes)
  }
  return null
}

export async function validateImageBytes(
  buffer: ArrayBuffer,
  mimeType: string,
  maxBytes: number,
): Promise<ValidatedImageBlob | null> {
  const normalizedMime = mimeType.split(";")[0]?.trim() ?? ""
  if (!isAllowedImageMimeType(normalizedMime)) {
    return null
  }
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
    return null
  }

  const bytes = new Uint8Array(buffer)
  const dimensions = readImageDimensions(bytes, normalizedMime)
  if (!dimensions) {
    return null
  }
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width > MAX_IMAGE_WIDTH ||
    dimensions.height > MAX_IMAGE_HEIGHT
  ) {
    return null
  }

  return {
    blob: new Blob([buffer], { type: normalizedMime }),
    mimeType: normalizedMime,
    byteLength: buffer.byteLength,
    width: dimensions.width,
    height: dimensions.height,
    contentHash: await sha256Hex(buffer),
  }
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  }
}

function readGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10 || bytes[0] !== 0x47 || bytes[1] !== 0x49) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    width: view.getUint16(6, true),
    height: view.getUint16(8, true),
  }
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }

  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === undefined) {
      return null
    }
    if (marker === 0xd9 || marker === 0xda) {
      return null
    }
    const segmentLength = (bytes[offset + 2] ?? 0) * 256 + (bytes[offset + 3] ?? 0)
    if (segmentLength < 2) {
      return null
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[offset + 5] ?? 0) * 256 + (bytes[offset + 6] ?? 0)
      const width = (bytes[offset + 7] ?? 0) * 256 + (bytes[offset + 8] ?? 0)
      return { width, height }
    }
    offset += segmentLength + 2
  }
  return null
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || bytes[0] !== 0x52 || bytes[1] !== 0x49) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunk = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0)
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16)
    const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16)
    return { width, height }
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    const width = view.getUint16(26, true) & 0x3fff
    const height = view.getUint16(28, true) & 0x3fff
    return { width, height }
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    const bits = view.getUint32(21, true)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { width, height }
  }
  return null
}

function readIcoDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 8 || bytes[0] !== 0x00 || bytes[1] !== 0x00) {
    return null
  }
  const width = bytes[6] === 0 ? 256 : bytes[6] ?? 0
  const height = bytes[7] === 0 ? 256 : bytes[7] ?? 0
  return { width, height }
}
