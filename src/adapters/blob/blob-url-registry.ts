export class BlobUrlRegistry {
  private readonly urls = new Set<string>()

  register(url: string): string {
    this.urls.add(url)
    return url
  }

  revokeAll(): void {
    for (const url of this.urls) {
      if (url.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url)
      }
    }
    this.urls.clear()
  }
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer())
  }
  return new Uint8Array(await new Response(blob).arrayBuffer())
}

export async function createBlobObjectUrl(blob: Blob): Promise<string> {
  if (typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(blob)
  }

  const bytes = await readBlobBytes(blob)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`
}
