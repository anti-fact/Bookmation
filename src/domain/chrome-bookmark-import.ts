import { normalizeLabelName } from "./normalizer/label-normalizer"
import { DomainError, DomainErrorCode } from "./errors"

/** Folder 名の正規化キー。空／不正は null。 */
export function folderKeyFromName(folderName: string | null): string | null {
  if (folderName === null) return null
  const trimmed = folderName.trim()
  if (trimmed.length === 0) return null
  try {
    return normalizeLabelName(trimmed).normalized
  } catch (error) {
    if (
      error instanceof DomainError &&
      (error.code === DomainErrorCode.LABEL_NAME_EMPTY ||
        error.code === DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    ) {
      return null
    }
    throw error
  }
}

export type ChromeImportFolderSkipReason =
  | "FOLDER_NAME_INVALID"
  | "TAG_NAME_RESERVED"

export type ChromeImportFolderPreview =
  | Readonly<{
      sourceFolderKey: string
      folderName: string
      mode: "REUSE"
      tagId: string
      tagName: string
      tagRevision: number
      parentCategoryId: string
      parentCategoryName: string
      bookmarkCount: number
    }>
  | Readonly<{
      sourceFolderKey: string
      folderName: string
      mode: "UNCLASSIFIED"
      plannedTagName: string
      bookmarkCount: number
    }>
  | Readonly<{
      sourceFolderKey: string
      folderName: string
      mode: "SKIP"
      reason: ChromeImportFolderSkipReason
      bookmarkCount: number
    }>

export type ChromeImportEntryPreview = Readonly<{
  entryId: string
  title: string
  url: string
  sourceFolderKey: string | null
  sourceFolderName: string | null
  importable: boolean
  duplicate: boolean
  skipReason: string | null
}>

export function buildSelectionFingerprint(
  entries: ReadonlyArray<Readonly<{ entryId: string; url: string }>>,
): string {
  const canonical = [...entries]
    .map((entry) => `${entry.entryId}\u001f${entry.url}`)
    .sort()
    .join("\u001e")
  return canonical
}

export type ChromeImportFolderResolutionInput =
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

export function autoReuseFolderResolutions(
  folders: readonly ChromeImportFolderPreview[],
): ChromeImportFolderResolutionInput[] {
  return folders.flatMap((folder) => {
    if (folder.mode === "REUSE") {
      return [
        {
          mode: "REUSE" as const,
          sourceFolderKey: folder.sourceFolderKey,
          tagId: folder.tagId,
          expectedTagRevision: folder.tagRevision,
        },
      ]
    }
    if (folder.mode === "SKIP") {
      return [{ mode: "SKIP" as const, sourceFolderKey: folder.sourceFolderKey }]
    }
    if (folder.mode === "UNCLASSIFIED") {
      return [{ mode: "UNCLASSIFIED" as const, sourceFolderKey: folder.sourceFolderKey }]
    }
    return []
  })
}
