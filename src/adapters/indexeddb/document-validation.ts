import { DomainError, DomainErrorCode, validateJsonValue } from "~/domain"

import { MAX_JSON_DOCUMENT_BYTES } from "./stores"

const SUPPORTED_SCHEMA_VERSIONS: Readonly<Record<string, ReadonlySet<number>>> = {
  bookmarks: new Set([1]),
  labels: new Set([1]),
  bookmarkLabels: new Set([1]),
  classificationJobs: new Set([1]),
  bookmarkRevisions: new Set([1]),
  searchDocuments: new Set([1]),
  tagMutationReceipts: new Set([1]),
  schemaMeta: new Set([1]),
}

export function assertSupportedSchemaVersion(store: string, schemaVersion: number): void {
  const allowed = SUPPORTED_SCHEMA_VERSIONS[store]
  if (!allowed?.has(schemaVersion)) {
    throw new DomainError(
      DomainErrorCode.INVALID_JSON_VALUE,
      `Unsupported schemaVersion ${schemaVersion} for store ${store}`,
    )
  }
}

export function assertDocumentSize(value: unknown): void {
  validateJsonValue(value)
  const serialized = JSON.stringify(value)
  const byteLength = new TextEncoder().encode(serialized).byteLength
  if (byteLength > MAX_JSON_DOCUMENT_BYTES) {
    throw new DomainError(
      DomainErrorCode.INVALID_JSON_VALUE,
      `Document exceeds max size ${MAX_JSON_DOCUMENT_BYTES} bytes`,
    )
  }
}

export function stripUndefinedFields<T extends Record<string, unknown>>(value: T): T {
  const result = {} as Record<string, unknown>
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) {
      result[key] = fieldValue
    }
  }
  return result as T
}

export function assertPersistableDocument(store: string, value: unknown): void {
  const sanitized = stripUndefinedFields(value as Record<string, unknown>)
  assertDocumentSize(sanitized)
  if (typeof sanitized === "object" && sanitized !== null && "schemaVersion" in sanitized) {
    assertSupportedSchemaVersion(store, (sanitized as { schemaVersion: number }).schemaVersion)
  }
}
