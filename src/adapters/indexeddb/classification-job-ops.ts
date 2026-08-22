/**
 * BE-06: Classification Job の claim / recover / apply / cancel / retry。
 */
import type { IDBPTransaction } from "idb"

import {
  assertValidStateTransition,
  CLASSIFICATION_JOB_LEASE_MS,
  CLASSIFICATION_JOB_MAX_ATTEMPTS,
  DomainError,
  DomainErrorCode,
  type ClassificationApplyOutcome,
  type EpochMs,
  type Id,
} from "~/domain"

import { stripUndefinedFields } from "./document-validation"
import { getActiveBookmarkOrThrow, putBookmark } from "./edge-helpers"
import type { BookmationDatabase } from "./open-database"
import type {
  PersistedActiveBookmarkRecord,
  PersistedClassificationJobRecord,
  BookmarkClassificationState,
} from "./persisted-types"
import { CLASSIFICATION_JOB_INDEXES, STORES } from "./stores"

const JOB_TX_STORES = [STORES.classificationJobs, STORES.bookmarks] as const

export interface ClaimClassificationJobInput {
  executorInstanceId: Id
  jobId?: Id
  now: EpochMs
}

export interface ClaimClassificationJobResult {
  job: PersistedClassificationJobRecord
  bookmark: PersistedActiveBookmarkRecord
}

export interface ApplyClassificationResultShellInput {
  jobId: Id
  executorInstanceId: Id
  bookmarkRevision: number
  outcome: ClassificationApplyOutcome
  errorCode?: string | null
  tagIds?: readonly Id[]
  now: EpochMs
}

export interface ApplyClassificationResultShellResult {
  job: PersistedClassificationJobRecord
  bookmark: PersistedActiveBookmarkRecord
  deduplicated: boolean
}

type JobTx = IDBPTransaction<
  import("./open-database").BookmationDbSchema,
  typeof JOB_TX_STORES,
  "readwrite"
>

async function putJob(tx: JobTx, job: PersistedClassificationJobRecord): Promise<void> {
  await tx
    .objectStore(STORES.classificationJobs)
    .put(
      stripUndefinedFields(job as unknown as Record<string, unknown>) as unknown as PersistedClassificationJobRecord,
    )
}

function assertLeaseValid(job: PersistedClassificationJobRecord, now: EpochMs): void {
  if (
    job.leaseExpiresAt === null ||
    job.leaseExpiresAt <= now ||
    job.executorInstanceId === null
  ) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_LEASE_INVALID)
  }
}

function bookmarkStateForOutcome(outcome: ClassificationApplyOutcome): BookmarkClassificationState {
  switch (outcome) {
    case "SUCCEEDED":
      return "CLASSIFIED"
    case "FAILED":
      return "FAILED"
    case "NEEDS_REVIEW":
      return "NEEDS_REVIEW"
    case "CANCELED":
      return "UNCLASSIFIED"
  }
}

async function findSucceededJobByFingerprint(
  tx: JobTx,
  fingerprint: string,
  excludeJobId: Id,
): Promise<PersistedClassificationJobRecord | undefined> {
  const matches = await tx
    .objectStore(STORES.classificationJobs)
    .index(CLASSIFICATION_JOB_INDEXES.byFingerprint)
    .getAll(fingerprint)
  return matches.find((job) => job.state === "SUCCEEDED" && job.id !== excludeJobId)
}

async function recoverStaleJobsInTransaction(tx: JobTx, now: EpochMs): Promise<number> {
  const store = tx.objectStore(STORES.classificationJobs)
  const index = store.index(CLASSIFICATION_JOB_INDEXES.byStateUpdatedAt)
  const runningJobs = await index.getAll(
    IDBKeyRange.bound(["RUNNING", 0], ["RUNNING", Number.MAX_SAFE_INTEGER]),
  )

  let recovered = 0
  for (const job of runningJobs) {
    if (job.leaseExpiresAt === null || job.leaseExpiresAt > now) {
      continue
    }

    if (job.attempt >= CLASSIFICATION_JOB_MAX_ATTEMPTS) {
      assertValidStateTransition(job.state, "FAILED")
      const failedJob: PersistedClassificationJobRecord = {
        ...job,
        state: "FAILED",
        errorCode: "MAX_ATTEMPTS_EXCEEDED",
        finishedAt: now,
        updatedAt: now,
        leaseExpiresAt: null,
        executorInstanceId: null,
        executionContext: null,
      }
      await putJob(tx, failedJob)

      const bookmark = await getActiveBookmarkOrThrow(tx, job.bookmarkId)
      if (bookmark.classificationState !== "FAILED") {
        await putBookmark(tx, {
          ...bookmark,
          classificationState: "FAILED",
          updatedAt: now,
        })
      }
      recovered += 1
      continue
    }

    assertValidStateTransition(job.state, "PENDING")
    const pendingJob: PersistedClassificationJobRecord = {
      ...job,
      state: "PENDING",
      updatedAt: now,
      leaseExpiresAt: null,
      executorInstanceId: null,
      executionContext: null,
      startedAt: null,
    }
    await putJob(tx, pendingJob)
    recovered += 1
  }

  return recovered
}

async function findPendingJob(
  tx: JobTx,
  jobId?: Id,
): Promise<PersistedClassificationJobRecord | undefined> {
  const store = tx.objectStore(STORES.classificationJobs)
  if (jobId) {
    const job = await store.get(jobId)
    return job?.state === "PENDING" ? job : undefined
  }

  const pendingJobs = await store
    .index(CLASSIFICATION_JOB_INDEXES.byStateUpdatedAt)
    .getAll(IDBKeyRange.bound(["PENDING", 0], ["PENDING", Number.MAX_SAFE_INTEGER]))
  pendingJobs.sort((left, right) => left.updatedAt - right.updatedAt || left.id.localeCompare(right.id))
  return pendingJobs[0]
}

export async function recoverStaleClassificationJobs(
  db: BookmationDatabase,
  now: EpochMs,
): Promise<number> {
  const tx = db.transaction(JOB_TX_STORES, "readwrite")
  const recovered = await recoverStaleJobsInTransaction(tx, now)
  await tx.done
  return recovered
}

export async function claimClassificationJob(
  db: BookmationDatabase,
  input: ClaimClassificationJobInput,
): Promise<ClaimClassificationJobResult | null> {
  const tx = db.transaction(JOB_TX_STORES, "readwrite")
  await recoverStaleJobsInTransaction(tx, input.now)

  const pending = await findPendingJob(tx, input.jobId)
  if (!pending) {
    if (input.jobId) {
      const existing = await tx.objectStore(STORES.classificationJobs).get(input.jobId)
      if (existing && existing.state !== "PENDING") {
        throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_CLAIM_CONFLICT)
      }
      throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_NOT_FOUND)
    }
    await tx.done
    return null
  }

  const bookmark = await getActiveBookmarkOrThrow(tx, pending.bookmarkId)
  assertValidStateTransition(pending.state, "RUNNING")

  const runningJob: PersistedClassificationJobRecord = {
    ...pending,
    state: "RUNNING",
    bookmarkRevision: bookmark.revision,
    attempt: pending.attempt + 1,
    executorInstanceId: input.executorInstanceId,
    leaseExpiresAt: input.now + CLASSIFICATION_JOB_LEASE_MS,
    executionContext: "TOP_LEVEL_EXTENSION_DOCUMENT",
    startedAt: pending.startedAt ?? input.now,
    updatedAt: input.now,
  }
  await putJob(tx, runningJob)

  const pendingBookmark =
    bookmark.classificationState === "PENDING"
      ? bookmark
      : {
          ...bookmark,
          classificationState: "PENDING" as const,
          updatedAt: input.now,
        }
  if (pendingBookmark !== bookmark) {
    await putBookmark(tx, pendingBookmark)
  }

  await tx.done
  return { job: runningJob, bookmark: pendingBookmark }
}

export async function getClassificationJob(
  db: BookmationDatabase,
  jobId: Id,
): Promise<PersistedClassificationJobRecord | undefined> {
  return db.get(STORES.classificationJobs, jobId)
}

export async function getLatestClassificationJobForBookmark(
  db: BookmationDatabase,
  bookmarkId: Id,
): Promise<PersistedClassificationJobRecord | undefined> {
  const jobs = await db.getAllFromIndex(
    STORES.classificationJobs,
    CLASSIFICATION_JOB_INDEXES.byBookmarkCreatedAt,
    IDBKeyRange.bound([bookmarkId, 0], [bookmarkId, Number.MAX_SAFE_INTEGER]),
  )
  if (jobs.length === 0) {
    return undefined
  }
  jobs.sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
  return jobs[0]
}

export async function cancelClassificationJob(
  db: BookmationDatabase,
  jobId: Id,
  now: EpochMs,
): Promise<PersistedClassificationJobRecord> {
  const tx = db.transaction(JOB_TX_STORES, "readwrite")
  const job = await tx.objectStore(STORES.classificationJobs).get(jobId)
  if (!job) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_NOT_FOUND)
  }
  if (job.state !== "PENDING" && job.state !== "RUNNING") {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }

  assertValidStateTransition(job.state, "CANCELED")
  const canceledJob: PersistedClassificationJobRecord = {
    ...job,
    state: "CANCELED",
    finishedAt: now,
    updatedAt: now,
    leaseExpiresAt: null,
    executorInstanceId: null,
    executionContext: null,
    errorCode: null,
  }
  await putJob(tx, canceledJob)

  const bookmark = await getActiveBookmarkOrThrow(tx, job.bookmarkId)
  await putBookmark(tx, {
    ...bookmark,
    classificationState: "UNCLASSIFIED",
    updatedAt: now,
  })

  await tx.done
  return canceledJob
}

export async function retryClassificationJob(
  db: BookmationDatabase,
  jobId: Id,
  now: EpochMs,
): Promise<PersistedClassificationJobRecord> {
  const tx = db.transaction(JOB_TX_STORES, "readwrite")
  const job = await tx.objectStore(STORES.classificationJobs).get(jobId)
  if (!job) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_NOT_FOUND)
  }
  if (job.state !== "FAILED" && job.state !== "NEEDS_REVIEW") {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }

  assertValidStateTransition(job.state, "PENDING")
  const pendingJob: PersistedClassificationJobRecord = {
    ...job,
    state: "PENDING",
    errorCode: null,
    finishedAt: null,
    startedAt: null,
    leaseExpiresAt: null,
    executorInstanceId: null,
    executionContext: null,
    updatedAt: now,
  }
  await putJob(tx, pendingJob)

  const bookmark = await getActiveBookmarkOrThrow(tx, job.bookmarkId)
  await putBookmark(tx, {
    ...bookmark,
    classificationState: "PENDING",
    updatedAt: now,
  })

  await tx.done
  return pendingJob
}

export async function applyClassificationResultShell(
  db: BookmationDatabase,
  input: ApplyClassificationResultShellInput,
): Promise<ApplyClassificationResultShellResult> {
  if (input.tagIds && input.tagIds.length > 0) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED, "Tag application is BE-08")
  }

  const tx = db.transaction(JOB_TX_STORES, "readwrite")
  const job = await tx.objectStore(STORES.classificationJobs).get(input.jobId)
  if (!job) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_NOT_FOUND)
  }

  if (
    job.state === "SUCCEEDED" ||
    job.state === "FAILED" ||
    job.state === "NEEDS_REVIEW" ||
    job.state === "CANCELED"
  ) {
    const bookmark = await getActiveBookmarkOrThrow(tx, job.bookmarkId)
    await tx.done
    return { job, bookmark, deduplicated: true }
  }

  if (job.state !== "RUNNING") {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }
  if (job.executorInstanceId !== input.executorInstanceId) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }
  assertLeaseValid(job, input.now)
  if (job.bookmarkRevision !== input.bookmarkRevision) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }

  const bookmark = await getActiveBookmarkOrThrow(tx, job.bookmarkId)
  if (bookmark.revision !== input.bookmarkRevision) {
    throw new DomainError(DomainErrorCode.CLASSIFICATION_JOB_APPLY_REJECTED)
  }

  const existingSucceeded = await findSucceededJobByFingerprint(
    tx,
    job.inputFingerprint,
    job.id,
  )
  if (existingSucceeded) {
    assertValidStateTransition(job.state, "SUCCEEDED")
    const dedupedJob: PersistedClassificationJobRecord = {
      ...job,
      state: "SUCCEEDED",
      finishedAt: input.now,
      updatedAt: input.now,
      leaseExpiresAt: null,
      executorInstanceId: null,
      executionContext: null,
      errorCode: null,
    }
    await putJob(tx, dedupedJob)
    const dedupedBookmark: PersistedActiveBookmarkRecord = {
      ...bookmark,
      classificationState: "CLASSIFIED",
      updatedAt: input.now,
    }
    await putBookmark(tx, dedupedBookmark)
    await tx.done
    return { job: dedupedJob, bookmark: dedupedBookmark, deduplicated: true }
  }

  assertValidStateTransition(job.state, input.outcome)
  const terminalJob: PersistedClassificationJobRecord = {
    ...job,
    state: input.outcome,
    errorCode: input.errorCode ?? (input.outcome === "FAILED" ? "CLASSIFICATION_FAILED" : null),
    finishedAt: input.now,
    updatedAt: input.now,
    leaseExpiresAt: null,
    executorInstanceId: null,
    executionContext: null,
  }
  await putJob(tx, terminalJob)

  const updatedBookmark: PersistedActiveBookmarkRecord = {
    ...bookmark,
    classificationState: bookmarkStateForOutcome(input.outcome),
    updatedAt: input.now,
  }
  await putBookmark(tx, updatedBookmark)

  await tx.done
  return { job: terminalJob, bookmark: updatedBookmark, deduplicated: false }
}
