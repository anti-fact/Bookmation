/** SHA-256 hex digest (Web Crypto) */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function computeUrlHash(normalizedUrl: string): Promise<string> {
  return sha256Hex(normalizedUrl)
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`
}

/** canonical JSON (sorted keys) で fingerprint を生成 */
export async function fingerprintFromObject(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value))
}

/** transaction 内で使う同期 fingerprint（Job 冪等補助） */
export function syncInputFingerprint(bookmarkId: string, categoryId: string): string {
  return `cascade:${bookmarkId}:${categoryId}`
}
