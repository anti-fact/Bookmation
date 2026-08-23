import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageAction,
} from "~/extension/messages"
import {
  ChromeBookmarkImportPortError,
  type ChromeBookmarkImportPort,
  type ChromeImportCommitResult,
  type ChromeImportFolderResolution,
  type ChromeImportPreview,
} from "~/ui/features/settings/chrome-bookmark-import-port"
import type { ParsedChromeBookmarkEntry } from "~/domain"

type SendMessage = (message: unknown) => Promise<unknown>

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function sendRequest(
  sendMessage: SendMessage,
  action: ExtensionMessageAction,
  payload: Record<string, unknown>,
  requestId: string = crypto.randomUUID(),
): Promise<Record<string, unknown>> {
  let rawResponse: unknown
  try {
    rawResponse = await sendMessage({
      action,
      payload,
      requestId,
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      source: "dashboard",
    })
  } catch {
    throw new ChromeBookmarkImportPortError("INTERNAL_ERROR")
  }

  const response = record(rawResponse)
  if (!response || response.requestId !== requestId) {
    throw new ChromeBookmarkImportPortError("INVALID_RESPONSE")
  }
  if (response.ok !== true) {
    const error = record(response.error)
    const code =
      typeof error?.code === "string" &&
      (error.code === "INVALID_MESSAGE" ||
        error.code === "ACTION_NOT_AVAILABLE" ||
        error.code === "INTERNAL_ERROR")
        ? error.code
        : "INVALID_RESPONSE"
    throw new ChromeBookmarkImportPortError(code)
  }

  const data = record(response.data)
  if (!data) {
    throw new ChromeBookmarkImportPortError("INVALID_RESPONSE")
  }
  return data
}

function decodePreview(data: Record<string, unknown>): ChromeImportPreview {
  if (typeof data.selectionFingerprint !== "string" || !Array.isArray(data.folders) || !Array.isArray(data.entries)) {
    throw new ChromeBookmarkImportPortError("INVALID_RESPONSE")
  }
  return {
    selectionFingerprint: data.selectionFingerprint,
    folders: data.folders as ChromeImportPreview["folders"],
    entries: data.entries as ChromeImportPreview["entries"],
  }
}

function decodeCommit(data: Record<string, unknown>): ChromeImportCommitResult {
  if (
    typeof data.imported !== "number" ||
    typeof data.skippedDuplicate !== "number" ||
    typeof data.skippedOther !== "number" ||
    typeof data.failed !== "number"
  ) {
    throw new ChromeBookmarkImportPortError("INVALID_RESPONSE")
  }
  return {
    imported: data.imported,
    skippedDuplicate: data.skippedDuplicate,
    skippedOther: data.skippedOther,
    failed: data.failed,
  }
}

export function createChromeBookmarkImportPort(
  runtime: Readonly<{ sendMessage(message: unknown): Promise<unknown> }>,
): ChromeBookmarkImportPort {
  const sendMessage: SendMessage = (message) => runtime.sendMessage(message)

  return {
    async preview(entries: readonly ParsedChromeBookmarkEntry[]) {
      const data = await sendRequest(sendMessage, "preview-chrome-bookmarks-import", {
        entries: [...entries],
      })
      return decodePreview(data)
    },
    async commit(input) {
      const data = await sendRequest(sendMessage, "commit-chrome-bookmarks-import", {
        commitRequestId: input.commitRequestId,
        selectionFingerprint: input.selectionFingerprint,
        entries: [...input.entries],
        folderResolutions: [...input.folderResolutions] as ChromeImportFolderResolution[],
      })
      return decodeCommit(data)
    },
  }
}
