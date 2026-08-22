import type { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"

import { getBundledFallbackLogoUrl } from "./bundled-fallback"
import { BlobUrlRegistry, createBlobObjectUrl } from "./blob-url-registry"

export async function resolveBookmarkImageSrc(
  layer: LocalDataLayer,
  blobId: string | null,
  registry: BlobUrlRegistry,
): Promise<string> {
  if (!blobId) {
    return getBundledFallbackLogoUrl()
  }

  const record = await layer.getBlobRecord(blobId)
  if (!record?.data) {
    return getBundledFallbackLogoUrl()
  }

  const objectUrl = await createBlobObjectUrl(record.data)
  return registry.register(objectUrl)
}
