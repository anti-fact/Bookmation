import type { LocalDataLayer } from "~/adapters"
import type { ClassificationApplyOutcome } from "~/domain"
import {
  serializeBookmarkForClaim,
  serializeClassificationJob
} from "~/adapters/indexeddb/mappers/classification-job"
import type {
  ExtensionMessageRequest,
  ExtensionMessageResponse
} from "~/extension/messages"

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function invalid(requestId: string): ExtensionMessageResponse {
  return { requestId, ok: false, error: { code: "INVALID_MESSAGE" } }
}

function isApplyOutcome(value: unknown): value is ClassificationApplyOutcome {
  return (
    value === "SUCCEEDED" ||
    value === "FAILED" ||
    value === "NEEDS_REVIEW" ||
    value === "CANCELED"
  )
}

/** BE-06 classification job message handlers。 */
export async function handleClassificationJobMessage(
  layer: LocalDataLayer,
  request: ExtensionMessageRequest
): Promise<ExtensionMessageResponse | null> {
  const payload = record(request.payload)
  if (!payload) {
    return invalid(request.requestId)
  }

  if (request.action === "claim-classification-job") {
    if (
      typeof payload.executorInstanceId !== "string" ||
      payload.executorInstanceId.length === 0
    ) {
      return invalid(request.requestId)
    }
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: payload.executorInstanceId,
      jobId: typeof payload.jobId === "string" ? payload.jobId : undefined
    })
    if (!claimed) {
      return {
        requestId: request.requestId,
        ok: true,
        data: { job: null, bookmark: null, labels: [] }
      }
    }
    const labels = await layer.listLabelCandidates(
      "",
      undefined,
      Number.MAX_SAFE_INTEGER
    )
    return {
      requestId: request.requestId,
      ok: true,
      data: {
        job: serializeClassificationJob(claimed.job),
        bookmark: serializeBookmarkForClaim(claimed.bookmark),
        labels: labels.map((label) => ({
          id: label.id,
          kind: label.kind,
          name: label.name,
          origin: label.origin,
          parentCategoryId: label.parentCategoryId,
          parentCategoryName: label.parentCategoryName,
          revision: label.revision
        }))
      }
    }
  }

  if (request.action === "apply-classification-result") {
    if (
      typeof payload.jobId !== "string" ||
      typeof payload.executorInstanceId !== "string" ||
      typeof payload.bookmarkRevision !== "number" ||
      !isApplyOutcome(payload.outcome)
    ) {
      return invalid(request.requestId)
    }
    const tagIds = Array.isArray(payload.tagIds)
      ? payload.tagIds.filter((id): id is string => typeof id === "string")
      : undefined
    const result = await layer.applyClassificationResultShell({
      jobId: payload.jobId,
      executorInstanceId: payload.executorInstanceId,
      bookmarkRevision: payload.bookmarkRevision,
      outcome: payload.outcome,
      errorCode:
        typeof payload.errorCode === "string" ? payload.errorCode : null,
      tagIds
    })
    return {
      requestId: request.requestId,
      ok: true,
      data: {
        job: serializeClassificationJob(result.job),
        bookmark: serializeBookmarkForClaim(result.bookmark),
        deduplicated: result.deduplicated
      }
    }
  }

  if (request.action === "get-classification-job") {
    const job =
      typeof payload.jobId === "string"
        ? await layer.getClassificationJob(payload.jobId)
        : typeof payload.bookmarkId === "string"
          ? await layer.getLatestClassificationJobForBookmark(
              payload.bookmarkId
            )
          : undefined
    if (!job) {
      return {
        requestId: request.requestId,
        ok: true,
        data: { job: null }
      }
    }
    return {
      requestId: request.requestId,
      ok: true,
      data: { job: serializeClassificationJob(job) }
    }
  }

  if (request.action === "retry-classification-job") {
    if (typeof payload.jobId !== "string") {
      return invalid(request.requestId)
    }
    const job = await layer.retryClassificationJob(payload.jobId)
    return {
      requestId: request.requestId,
      ok: true,
      data: { job: serializeClassificationJob(job) }
    }
  }

  if (request.action === "cancel-classification-job") {
    if (typeof payload.jobId !== "string") {
      return invalid(request.requestId)
    }
    const job = await layer.cancelClassificationJob(payload.jobId)
    return {
      requestId: request.requestId,
      ok: true,
      data: { job: serializeClassificationJob(job) }
    }
  }

  return null
}
