import type { LocalDataLayer } from "~/adapters"
import type {
  ApplicableCandidate,
  ClassificationApplyOutcome,
  JsonValue,
  TagImportance,
} from "~/domain"
import { isPolicyV2, policyFromGranularity } from "~/domain"
import {
  serializeBookmarkForClaim,
  serializeClassificationJob,
} from "~/adapters/indexeddb/mappers/classification-job"
import type { ExtensionMessageRequest, ExtensionMessageResponse } from "~/extension/messages"

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

const IMPORTANCES = new Set(["CORE", "MAJOR", "SUPPORTING", "DETAIL"])

function parseApplicableCandidates(raw: unknown): ApplicableCandidate[] | null {
  if (!Array.isArray(raw)) return null
  const out: ApplicableCandidate[] = []
  for (const item of raw) {
    const r = record(item)
    if (!r || typeof r.sourceIndex !== "number") return null
    if (!IMPORTANCES.has(String(r.importance))) return null
    if (r.action === "REUSE") {
      if (typeof r.tagId !== "string" || typeof r.confidence !== "number") return null
      out.push({
        sourceIndex: r.sourceIndex,
        action: "REUSE",
        tagId: r.tagId,
        importance: r.importance as TagImportance,
        confidence: r.confidence,
      })
      continue
    }
    if (r.action === "CREATE") {
      if (
        typeof r.name !== "string" ||
        typeof r.normalizedName !== "string" ||
        typeof r.confidence !== "number" ||
        typeof r.proposalKey !== "string"
      ) {
        return null
      }
      out.push({
        sourceIndex: r.sourceIndex,
        action: "CREATE",
        name: r.name,
        normalizedName: r.normalizedName,
        importance: r.importance as TagImportance,
        confidence: r.confidence,
        proposalKey: r.proposalKey,
      })
      continue
    }
    return null
  }
  return out
}

/** BE-06/08 classification job message handlers。 */
export async function handleClassificationJobMessage(
  layer: LocalDataLayer,
  request: ExtensionMessageRequest,
): Promise<ExtensionMessageResponse | null> {
  const payload = record(request.payload)
  if (!payload) {
    return invalid(request.requestId)
  }

  if (request.action === "claim-classification-job") {
    if (typeof payload.executorInstanceId !== "string" || payload.executorInstanceId.length === 0) {
      return invalid(request.requestId)
    }
    const claimed = await layer.claimClassificationJob({
      executorInstanceId: payload.executorInstanceId,
      jobId: typeof payload.jobId === "string" ? payload.jobId : undefined,
    })
    if (!claimed) {
      return {
        requestId: request.requestId,
        ok: true,
        data: { job: null, bookmark: null, labels: { categories: [], existingTags: [] } },
      }
    }
    const labels = await layer.listActiveLabelsForClassification()
    const policy = isPolicyV2(claimed.job.policy)
      ? claimed.job.policy
      : policyFromGranularity(2)
    return {
      requestId: request.requestId,
      ok: true,
      data: {
        job: serializeClassificationJob({ ...claimed.job, policy }),
        bookmark: serializeBookmarkForClaim(claimed.bookmark),
        labels: {
          categories: labels.categories,
          existingTags: labels.existingTags.map((t) => ({
            id: t.id,
            name: t.name,
            normalizedName: t.normalizedName,
            origin: t.origin,
            revision: t.revision,
            parentCategoryId: t.parentCategoryId,
            parentCategoryRevision: t.parentCategoryRevision,
            deletedAt: null,
          })),
        },
      },
    }
  }

  if (request.action === "apply-validated-classification") {
    if (
      typeof payload.jobId !== "string" ||
      typeof payload.executorInstanceId !== "string" ||
      typeof payload.bookmarkRevision !== "number" ||
      typeof payload.categoryId !== "string"
    ) {
      return invalid(request.requestId)
    }
    const candidates = parseApplicableCandidates(payload.candidates)
    if (!candidates || candidates.length === 0) {
      return invalid(request.requestId)
    }
    const result = await layer.applyValidatedClassificationResult({
      jobId: payload.jobId,
      executorInstanceId: payload.executorInstanceId,
      bookmarkRevision: payload.bookmarkRevision,
      categoryId: payload.categoryId,
      candidates,
    })
    return {
      requestId: request.requestId,
      ok: true,
      data: {
        job: serializeClassificationJob(result.job),
        bookmark: serializeBookmarkForClaim(result.bookmark),
        appliedTagIds: result.appliedTagIds,
        createdTagIds: result.createdTagIds,
        deduplicated: result.deduplicated,
      },
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
      errorCode: typeof payload.errorCode === "string" ? payload.errorCode : null,
      tagIds,
    })
    return {
      requestId: request.requestId,
      ok: true,
      data: {
        job: serializeClassificationJob(result.job),
        bookmark: serializeBookmarkForClaim(result.bookmark),
        deduplicated: result.deduplicated,
      },
    }
  }

  if (request.action === "get-classification-job") {
    const job =
      typeof payload.jobId === "string"
        ? await layer.getClassificationJob(payload.jobId)
        : typeof payload.bookmarkId === "string"
          ? await layer.getLatestClassificationJobForBookmark(payload.bookmarkId)
          : undefined
    if (!job) {
      return {
        requestId: request.requestId,
        ok: true,
        data: { job: null },
      }
    }
    return {
      requestId: request.requestId,
      ok: true,
      data: { job: serializeClassificationJob(job) },
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
      data: { job: serializeClassificationJob(job) },
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
      data: { job: serializeClassificationJob(job) },
    }
  }

  return null
}

export type { JsonValue }
