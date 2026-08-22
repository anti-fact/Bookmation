import type { JsonValue } from "~/domain"

import type { PersistedActiveBookmarkRecord, PersistedClassificationJobRecord } from "../persisted-types"

export function serializeClassificationJob(job: PersistedClassificationJobRecord): JsonValue {
  return {
    id: job.id,
    bookmarkId: job.bookmarkId,
    requestId: job.requestId,
    reason: job.reason,
    state: job.state,
    inputFingerprint: job.inputFingerprint,
    bookmarkRevision: job.bookmarkRevision,
    policy: job.policy,
    attempt: job.attempt,
    leaseExpiresAt: job.leaseExpiresAt,
    executorInstanceId: job.executorInstanceId,
    errorCode: job.errorCode,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

export function serializeBookmarkForClaim(bookmark: PersistedActiveBookmarkRecord): JsonValue {
  return {
    id: bookmark.id,
    title: bookmark.title,
    normalizedUrl: bookmark.normalizedUrl,
    revision: bookmark.revision,
    classificationState: bookmark.classificationState,
  }
}
