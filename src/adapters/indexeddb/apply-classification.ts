/**
 * 検証済み APPLICABLE 候補の Tag／edge 適用（TASK-008 縦スライス）
 */
import type { IDBPTransaction } from "idb"
import {
  DomainError,
  DomainErrorCode,
  nextRevision,
  type ApplicableCandidate,
  type EpochMs,
  type Id,
} from "~/domain"

import { stripUndefinedFields } from "./document-validation"
import {
  getActiveBookmarkOrThrow,
  getEdgeByPair,
  getLabelOrThrow,
  putBookmark,
  putEdge,
  syncCategoryEdgesFromTags,
} from "./edge-helpers"
import type { BookmationDatabase, BookmationDbSchema } from "./open-database"
import type {
  PersistedActiveBookmarkRecord,
  PersistedBookmarkLabelRecord,
  PersistedClassificationJobRecord,
} from "./persisted-types"
import { STORES } from "./stores"

const APPLY_TX_STORES = [
  STORES.classificationJobs,
  STORES.bookmarks,
  STORES.labels,
  STORES.bookmarkLabels,
] as const

type ApplyTx = IDBPTransaction<
  BookmationDbSchema,
  typeof APPLY_TX_STORES,
  "readwrite"
>

export interface ApplyValidatedClassificationInput {
  jobId: Id
  executorInstanceId: Id
  bookmarkRevision: number
  categoryId: Id
  candidates: ReadonlyArray<ApplicableCandidate>
  now: EpochMs
}

export interface ApplyValidatedClassificationResult {
  job: PersistedClassificationJobRecord
  bookmark: PersistedActiveBookmarkRecord
  appliedTagIds: Id[]
  createdTagIds: Id[]
  deduplicated: boolean
}

async function putJob(tx: ApplyTx, job: PersistedClassificationJobRecord): Promise<void> {
  await tx
    .objectStore(STORES.classificationJobs)
    .put(
      stripUndefinedFields(
        job as unknown as Record<string, unknown>,
      ) as unknown as PersistedClassificationJobRecord,
    )
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/**
 * 正常候補を同一 transaction で全件適用し、Job SUCCEEDED / Bookmark CLASSIFIED にする。
 * confidence 上位N件切り捨てなし。件数上限なし。
 */
export async function applyValidatedClassificationResult(
  db: BookmationDatabase,
  input: ApplyValidatedClassificationInput,
): Promise<ApplyValidatedClassificationResult> {
  if (input.candidates.length < 1) {
    throw new DomainError(
      DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED,
      "APPLICABLE candidates must be non-empty",
    )
  }

  const tx = db.transaction([...APPLY_TX_STORES], "readwrite")
  const job = await tx.objectStore(STORES.classificationJobs).get(input.jobId)
  if (!job) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_NOT_FOUND)
  }

  if (job.state === "SUCCEEDED") {
    const bookmark = await getActiveBookmarkOrThrow(tx, job.bookmarkId)
    await tx.done
    return {
      job,
      bookmark,
      appliedTagIds: [],
      createdTagIds: [],
      deduplicated: true,
    }
  }

  if (job.state !== "RUNNING") {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }
  if (job.executorInstanceId !== input.executorInstanceId) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }
  if (
    job.leaseExpiresAt === null ||
    job.leaseExpiresAt <= input.now ||
    job.bookmarkRevision !== input.bookmarkRevision
  ) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }

  const bookmark = await getActiveBookmarkOrThrow(tx, job.bookmarkId)
  if (bookmark.revision !== input.bookmarkRevision) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }

  const category = await getLabelOrThrow(tx, input.categoryId)
  if (category.kind !== "CATEGORY" || category.deletedAt !== null) {
    throw new DomainError(
      DomainErrorCode.AI_CATEGORY_CREATION_FORBIDDEN,
      "selected category must be active USER category",
    )
  }

  const appliedTagIds: Id[] = []
  const createdTagIds: Id[] = []

  for (const candidate of input.candidates) {
    let tagId: Id
    if (candidate.action === "REUSE") {
      const tag = await getLabelOrThrow(tx, candidate.tagId)
      if (
        tag.kind !== "TAG" ||
        tag.deletedAt !== null ||
        tag.origin !== "USER" ||
        tag.parentCategoryId !== input.categoryId
      ) {
        throw new DomainError(
          DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED,
          `REUSE tag invalid: ${candidate.tagId}`,
        )
      }
      tagId = tag.id
    } else {
      throw new DomainError(
        DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED,
        "AI Tag CREATE is disabled; only USER Tag REUSE is allowed",
      )
    }

    const existingEdge = await getEdgeByPair(tx, bookmark.id, tagId)
    if (existingEdge && existingEdge.deletedAt === null) {
      // 非AI provenance は上書きしない
      if (existingEdge.assignedBy === "AI") {
        await putEdge(tx, {
          ...existingEdge,
          confidence: candidate.confidence,
          classificationJobId: job.id,
          updatedAt: input.now,
          revision: nextRevision(existingEdge.revision),
        })
      }
    } else if (existingEdge && existingEdge.deletedAt !== null) {
      await putEdge(tx, {
        ...existingEdge,
        assignedBy: "AI",
        confidence: candidate.confidence,
        classificationJobId: job.id,
        deletedAt: null,
        updatedAt: input.now,
        revision: nextRevision(existingEdge.revision),
      })
    } else {
      const edge: PersistedBookmarkLabelRecord = {
        schemaVersion: 1,
        id: newId("edge"),
        bookmarkId: bookmark.id,
        labelId: tagId,
        assignedBy: "AI",
        confidence: candidate.confidence,
        classificationJobId: job.id,
        createdAt: input.now,
        updatedAt: input.now,
        revision: 1,
        deletedAt: null,
      }
      await putEdge(tx, edge)
    }
    appliedTagIds.push(tagId)
  }

  // 派生 Category edge: active Tag 親から再導出
  let updatedBookmark = await syncCategoryEdgesFromTags(
    tx,
    bookmark,
    input.now,
    "AI",
  )
  updatedBookmark = {
    ...updatedBookmark,
    classificationState: "CLASSIFIED",
    revision: nextRevision(updatedBookmark.revision),
    updatedAt: input.now,
  }
  await putBookmark(tx, updatedBookmark)

  const updatedJob: PersistedClassificationJobRecord = {
    ...job,
    state: "SUCCEEDED",
    errorCode: null,
    finishedAt: input.now,
    leaseExpiresAt: null,
    executorInstanceId: null,
    executionContext: null,
    updatedAt: input.now,
  }
  await putJob(tx, updatedJob)
  await tx.done

  return {
    job: updatedJob,
    bookmark: updatedBookmark,
    appliedTagIds: [...new Set(appliedTagIds)],
    createdTagIds,
    deduplicated: false,
  }
}
