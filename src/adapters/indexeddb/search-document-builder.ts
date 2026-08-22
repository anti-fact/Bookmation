import type { Id, EpochMs, UpdateTagCommand } from "~/domain"

import { SEARCH_SCHEMA_VERSION } from "./stores"
import type {
  PersistedActiveBookmarkRecord,
  PersistedLabelRecord,
  PersistedSearchDocumentRecord,
} from "./persisted-types"
import { fingerprintFromObject } from "./crypto-utils"

export function searchDocumentId(entityType: "LABEL" | "BOOKMARK", entityId: Id): string {
  return `${entityType}:${entityId}`
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().trim()
  if (!normalized) return []
  const tokens = new Set<string>()
  tokens.add(normalized)
  for (const part of normalized.split(/[\s/._-]+/)) {
    if (part) tokens.add(part)
  }
  return [...tokens].map((t) => `token:${t}`)
}

export function buildLabelSearchDocument(
  label: PersistedLabelRecord,
  parentCategory: PersistedLabelRecord | null,
  now: EpochMs,
): PersistedSearchDocumentRecord {
  const parts = [label.name, label.normalizedName, label.kind]
  if (label.kind === "TAG" && parentCategory) {
    parts.push(parentCategory.name)
  }
  const normalizedText = parts.join(" ")
  const searchKeys = [
    ...tokenize(normalizedText),
    `entity:LABEL`,
    `kind:${label.kind}`,
    `label:${label.id}`,
  ]

  return {
    schemaVersion: 1,
    id: searchDocumentId("LABEL", label.id),
    entityType: "LABEL",
    entityId: label.id,
    sourceRevision: label.revision,
    searchSchemaVersion: SEARCH_SCHEMA_VERSION,
    normalizedText,
    searchKeys,
    builtAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

export function buildBookmarkSearchDocument(
  bookmark: PersistedActiveBookmarkRecord,
  now: EpochMs,
): PersistedSearchDocumentRecord {
  const parts = [bookmark.title, bookmark.siteName ?? "", bookmark.normalizedUrl]
  const normalizedText = parts.filter(Boolean).join(" ")
  const searchKeys = [
    ...tokenize(normalizedText),
    `entity:BOOKMARK`,
    `bookmark:${bookmark.id}`,
  ]

  return {
    schemaVersion: 1,
    id: searchDocumentId("BOOKMARK", bookmark.id),
    entityType: "BOOKMARK",
    entityId: bookmark.id,
    sourceRevision: bookmark.revision,
    searchSchemaVersion: SEARCH_SCHEMA_VERSION,
    normalizedText,
    searchKeys,
    builtAt: now,
    updatedAt: now,
    createdAt: now,
  }
}

export async function buildUpdateTagRequestFingerprint(
  command: UpdateTagCommand,
): Promise<string> {
  return fingerprintFromObject({
    version: 1,
    tagId: command.tagId,
    expectedTagRevision: command.expectedTagRevision,
    name: command.name,
    parentCategoryId: command.parentCategoryId,
    expectedParentRevision: command.expectedParentRevision,
  })
}

export async function buildCategoryImpactFingerprint(input: {
  category: PersistedLabelRecord
  childTags: readonly PersistedLabelRecord[]
  edges: readonly { id: Id; bookmarkId: Id; labelId: Id; revision: number; deletedAt: EpochMs | null }[]
  bookmarks: readonly PersistedActiveBookmarkRecord[]
}): Promise<string> {
  const payload = {
    category: {
      id: input.category.id,
      revision: input.category.revision,
      deletedAt: input.category.deletedAt,
    },
    childTags: input.childTags
      .map((t) => ({
        id: t.id,
        revision: t.revision,
        deletedAt: t.deletedAt,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: input.edges
      .map((e) => ({
        id: e.id,
        bookmarkId: e.bookmarkId,
        labelId: e.labelId,
        revision: e.revision,
        deletedAt: e.deletedAt,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    bookmarks: input.bookmarks
      .map((b) => ({ id: b.id, revision: b.revision }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
  return fingerprintFromObject(payload)
}
