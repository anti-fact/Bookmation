import type {
  ChromeImportEntryPreview,
  ChromeImportFolderPreview,
} from "~/domain/chrome-bookmark-import"
import {
  DomainError,
  DomainErrorCode,
  buildSelectionFingerprint,
  folderKeyFromName,
  isAllowedUrl,
  resolveBookmarkTitle,
  validateAndNormalizeUrl,
  type ParsedChromeBookmarkEntry,
} from "~/domain"
import type { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import type { PersistedLabelRecord } from "~/adapters/indexeddb/persisted-types"

import { hostnameFromUrl } from "./save-bookmark-hostname"

export type ChromeImportPreviewInput = Readonly<{
  entries: readonly ParsedChromeBookmarkEntry[]
}>

export type ChromeImportPreviewResult = Readonly<{
  selectionFingerprint: string
  folders: ChromeImportFolderPreview[]
  entries: ChromeImportEntryPreview[]
}>

export type ChromeImportFolderResolution =
  | Readonly<{
      mode: "REUSE"
      sourceFolderKey: string
      tagId: string
      expectedTagRevision: number
    }>
  | Readonly<{
      mode: "UNCLASSIFIED"
      sourceFolderKey: string
    }>
  | Readonly<{
      mode: "SKIP"
      sourceFolderKey: string
    }>

export type ChromeImportCommitInput = Readonly<{
  commitRequestId: string
  selectionFingerprint: string
  entries: readonly ParsedChromeBookmarkEntry[]
  folderResolutions: readonly ChromeImportFolderResolution[]
}>

export type ChromeImportCommitResult = Readonly<{
  imported: number
  skippedDuplicate: number
  skippedOther: number
  failed: number
  importedBookmarks: ReadonlyArray<{
    bookmarkId: string
    revision: number
    rawUrl: string
    title: string
    faviconUrl: string | null
  }>
}>

async function findTagByFolderKey(
  layer: LocalDataLayer,
  sourceFolderKey: string,
): Promise<
  | { kind: "active"; tag: PersistedLabelRecord; parentName: string }
  | { kind: "reserved" }
  | { kind: "missing" }
> {
  const tag = await layer.findTagByUniqueName(sourceFolderKey)
  if (!tag) return { kind: "missing" }
  if (tag.deletedAt !== null) return { kind: "reserved" }
  if (tag.parentCategoryId === null) return { kind: "missing" }
  const parent = await layer.getLabel(tag.parentCategoryId)
  if (!parent || parent.deletedAt !== null) return { kind: "missing" }
  return { kind: "active", tag, parentName: parent.name }
}

async function buildFolderPreviews(
  layer: LocalDataLayer,
  entries: readonly ParsedChromeBookmarkEntry[],
) {
  const counts = new Map<string, { folderName: string; count: number }>()
  for (const entry of entries) {
    const key = folderKeyFromName(entry.sourceFolderName)
    if (!key) continue
    const current = counts.get(key)
    if (current) {
      current.count += 1
    } else {
      counts.set(key, {
        folderName: entry.sourceFolderName!.trim(),
        count: 1,
      })
    }
  }

  const folders = []
  for (const [sourceFolderKey, { folderName, count }] of counts) {
    const tagState = await findTagByFolderKey(layer, sourceFolderKey)
    if (tagState.kind === "reserved") {
      folders.push({
        sourceFolderKey,
        folderName,
        mode: "SKIP" as const,
        reason: "TAG_NAME_RESERVED" as const,
        bookmarkCount: count,
      })
      continue
    }
    if (tagState.kind === "active") {
      folders.push({
        sourceFolderKey,
        folderName,
        mode: "REUSE" as const,
        tagId: tagState.tag.id,
        tagName: tagState.tag.name,
        tagRevision: tagState.tag.revision,
        parentCategoryId: tagState.tag.parentCategoryId!,
        parentCategoryName: tagState.parentName,
        bookmarkCount: count,
      })
      continue
    }
    folders.push({
      sourceFolderKey,
      folderName,
      mode: "UNCLASSIFIED" as const,
      plannedTagName: folderName,
      bookmarkCount: count,
    })
  }

  return folders.sort((a, b) => a.folderName.localeCompare(b.folderName, "ja"))
}

function buildEntryPreviews(
  entries: readonly ParsedChromeBookmarkEntry[],
  skippedFolderKeys: ReadonlySet<string>,
  duplicateUrls: ReadonlySet<string>,
) {
  return entries.map((entry) => {
    const sourceFolderKey = folderKeyFromName(entry.sourceFolderName)
    let skipReason: string | null = null
    let importable = true

    if (!sourceFolderKey) {
      importable = false
      skipReason = "FOLDER_NAME_INVALID"
    } else if (skippedFolderKeys.has(sourceFolderKey)) {
      importable = false
      skipReason = "FOLDER_SKIPPED"
    }

    try {
      if (!isAllowedUrl(entry.url)) {
        importable = false
        skipReason = "URL_NOT_ALLOWED"
      } else {
        validateAndNormalizeUrl(entry.url)
      }
    } catch {
      importable = false
      skipReason = "URL_INVALID"
    }

    const duplicate = importable && duplicateUrls.has(entry.url)
    if (duplicate) {
      importable = false
      skipReason = "DUPLICATE_URL"
    }

    return {
      entryId: entry.entryId,
      title: entry.title,
      url: entry.url,
      sourceFolderKey,
      sourceFolderName: entry.sourceFolderName,
      importable,
      duplicate,
      skipReason,
    }
  })
}

export async function previewChromeBookmarkImport(
  layer: LocalDataLayer,
  input: ChromeImportPreviewInput,
): Promise<ChromeImportPreviewResult> {
  const folders = await buildFolderPreviews(layer, input.entries)
  const skippedFolderKeys = new Set(
    folders.filter((folder) => folder.mode === "SKIP").map((folder) => folder.sourceFolderKey),
  )

  const duplicateUrls = new Set<string>()
  for (const entry of input.entries) {
    try {
      const normalized = validateAndNormalizeUrl(entry.url).normalized
      const existing = await layer.findActiveBookmarkByNormalizedUrl(normalized)
      if (existing) duplicateUrls.add(entry.url)
    } catch {
      // handled per-entry
    }
  }

  const entryPreviews = buildEntryPreviews(input.entries, skippedFolderKeys, duplicateUrls)
  return {
    selectionFingerprint: buildSelectionFingerprint(
      input.entries.map((entry) => ({ entryId: entry.entryId, url: entry.url })),
    ),
    folders,
    entries: entryPreviews,
  }
}

function resolutionMap(
  resolutions: readonly ChromeImportFolderResolution[],
): Map<string, ChromeImportFolderResolution> {
  return new Map(resolutions.map((resolution) => [resolution.sourceFolderKey, resolution]))
}

export async function commitChromeBookmarkImport(
  layer: LocalDataLayer,
  input: ChromeImportCommitInput,
): Promise<ChromeImportCommitResult> {
  const expectedFingerprint = buildSelectionFingerprint(
    input.entries.map((entry) => ({ entryId: entry.entryId, url: entry.url })),
  )
  if (expectedFingerprint !== input.selectionFingerprint) {
    throw new DomainError(DomainErrorCode.INVALID_ID, "Selection fingerprint mismatch")
  }

  const resolutions = resolutionMap(input.folderResolutions)
  let imported = 0
  let skippedDuplicate = 0
  let skippedOther = 0
  let failed = 0
  const importedBookmarks: ChromeImportCommitResult["importedBookmarks"][number][] = []

  for (const entry of input.entries) {
    const folderKey = folderKeyFromName(entry.sourceFolderName)
    if (!folderKey) {
      skippedOther += 1
      continue
    }

    const resolution = resolutions.get(folderKey)
    if (!resolution || resolution.mode === "SKIP") {
      skippedOther += 1
      continue
    }

    let normalizedUrl: string
    try {
      normalizedUrl = validateAndNormalizeUrl(entry.url).normalized
    } catch {
      skippedOther += 1
      continue
    }

    const duplicate = await layer.findActiveBookmarkByNormalizedUrl(normalizedUrl)
    if (duplicate) {
      skippedDuplicate += 1
      continue
    }

    const title = resolveBookmarkTitle(entry.title, hostnameFromUrl(entry.url))
    try {
      let bookmark
      if (resolution.mode === "REUSE") {
        const tag = await layer.getLabel(resolution.tagId)
        if (
          !tag ||
          tag.kind !== "TAG" ||
          tag.deletedAt !== null ||
          tag.revision !== resolution.expectedTagRevision
        ) {
          failed += 1
          continue
        }
        bookmark = await layer.importChromeBookmarkWithTag({
          id: crypto.randomUUID(),
          rawUrl: entry.url,
          title,
          tagId: tag.id,
          faviconUrl: entry.faviconUrl,
          creationRequestId: `${input.commitRequestId}:${entry.entryId}`,
        })
      } else {
        bookmark = await layer.importChromeBookmarkUnclassified({
          id: crypto.randomUUID(),
          rawUrl: entry.url,
          title,
          faviconUrl: entry.faviconUrl,
          creationRequestId: `${input.commitRequestId}:${entry.entryId}`,
        })
      }
      imported += 1
      importedBookmarks.push({
        bookmarkId: bookmark.id,
        revision: bookmark.revision,
        rawUrl: bookmark.rawUrl,
        title: bookmark.title,
        faviconUrl: bookmark.faviconUrl,
      })
    } catch {
      failed += 1
    }
  }

  return { imported, skippedDuplicate, skippedOther, failed, importedBookmarks }
}

export function folderResolutionComplete(
  folders: ChromeImportPreviewResult["folders"],
  resolutions: readonly ChromeImportFolderResolution[],
): boolean {
  const resolvedKeys = new Set(
    resolutions
      .filter((resolution) => resolution.mode !== "SKIP")
      .map((resolution) => resolution.sourceFolderKey),
  )
  for (const folder of folders) {
    if (folder.mode === "SKIP") continue
    if (folder.mode === "REUSE") {
      if (
        !resolutions.some(
          (resolution) =>
            resolution.mode === "REUSE" &&
            resolution.sourceFolderKey === folder.sourceFolderKey,
        )
      ) {
        return false
      }
      continue
    }
    if (
      !resolutions.some(
        (resolution) =>
          resolution.mode === "UNCLASSIFIED" &&
          resolution.sourceFolderKey === folder.sourceFolderKey,
      )
    ) {
      return false
    }
  }
  for (const folder of folders) {
    if (folder.mode === "UNCLASSIFIED" && !resolvedKeys.has(folder.sourceFolderKey)) {
      return false
    }
  }
  return true
}
