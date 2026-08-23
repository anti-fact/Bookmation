/**
 * AI_GUIDE policy v2 分類結果の検証境界
 * MODEL_DECISION（schema通過）→ APPLICABLE（信頼側検証・canonical化）
 */
import { normalizeLabelName } from "./normalizer"
import { isCreateImportanceAllowed } from "./classification-policy"
import type { ClassificationRetryReasonCode } from "./classification-prompt"
import type { ClassificationPromptInput } from "./classification-prompt"
import type { ClassificationPolicySnapshotV2, EntityOrigin, Id, TagImportance } from "./types"

const IMPORTANCES = new Set<TagImportance>([
  "CORE",
  "MAJOR",
  "SUPPORTING",
  "DETAIL",
])

export type TagDecision =
  | {
      action: "REUSE"
      tagId: Id
      importance: TagImportance
      evidenceText: string
      confidence: number
    }
  | {
      action: "CREATE"
      name: string
      importance: TagImportance
      evidenceText: string
      confidence: number
    }

export type ModelDecisionCandidate = {
  sourceIndex: number
  decision: TagDecision
}

export type ApplicableCandidate =
  | {
      sourceIndex: number
      action: "REUSE"
      tagId: Id
      importance: TagImportance
      confidence: number
    }
  | {
      sourceIndex: number
      action: "CREATE"
      name: string
      normalizedName: string
      importance: TagImportance
      confidence: number
      proposalKey: string
    }

export type AttemptOutcome =
  | "GLOBAL_INVALID"
  | "ZERO_VALID"
  | "APPLIED"
  | "TECHNICAL_FAILURE"

export type ResponseDisposition =
  | "JSON_INVALID"
  | "ENVELOPE_INVALID"
  | "ENVELOPE_VALID"
  | "NO_RESPONSE"
  | "TECHNICAL_FAILURE"

export interface SnapshotTag {
  id: Id
  name: string
  normalizedName: string
  origin: EntityOrigin
  revision: number
  parentCategoryId: Id
  parentCategoryRevision: number
  deletedAt: number | null
}

export interface ValidateClassificationResultInput {
  raw: unknown
  promptInput: ClassificationPromptInput
  /** snapshot 上の Tag（tombstone 含む名前予約照合用） */
  snapshotTags: ReadonlyArray<SnapshotTag>
  policy: ClassificationPolicySnapshotV2
}

export interface ValidateClassificationResultOutput {
  responseDisposition: ResponseDisposition
  outcome: AttemptOutcome
  rawCandidateCount: number
  modelDecisionCategoryId: string | null
  modelDecisionCandidates: ModelDecisionCandidate[]
  candidateSchemaInvalidIndexes: number[]
  applicableCategoryId: Id | null
  applicableCandidates: ApplicableCandidate[]
  diagnosticReasonCodes: ClassificationRetryReasonCode[]
  acceptedCount: number
  rejectedCount: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function evidencePresent(
  evidenceText: string,
  title: string,
  normalizedUrl: string,
): boolean {
  return (
    evidenceText.length > 0 &&
    (title.includes(evidenceText) || normalizedUrl.includes(evidenceText))
  )
}

function parseTagDecision(raw: unknown): TagDecision | null {
  if (!isPlainObject(raw)) return null
  const keys = Object.keys(raw)
  if (raw["action"] === "REUSE") {
    const allowed = new Set([
      "action",
      "tagId",
      "importance",
      "evidenceText",
      "confidence",
    ])
    if (keys.some((k) => !allowed.has(k))) return null
    if (typeof raw["tagId"] !== "string" || raw["tagId"].length === 0) return null
    if (!IMPORTANCES.has(raw["importance"] as TagImportance)) return null
    if (typeof raw["evidenceText"] !== "string") return null
    if (
      typeof raw["confidence"] !== "number" ||
      raw["confidence"] < 0 ||
      raw["confidence"] > 1
    ) {
      return null
    }
    return {
      action: "REUSE",
      tagId: raw["tagId"] as Id,
      importance: raw["importance"] as TagImportance,
      evidenceText: raw["evidenceText"] as string,
      confidence: raw["confidence"] as number,
    }
  }
  if (raw["action"] === "CREATE") {
    const allowed = new Set([
      "action",
      "name",
      "importance",
      "evidenceText",
      "confidence",
    ])
    if (keys.some((k) => !allowed.has(k))) return null
    if (typeof raw["name"] !== "string" || raw["name"].length === 0) return null
    if (!IMPORTANCES.has(raw["importance"] as TagImportance)) return null
    if (typeof raw["evidenceText"] !== "string") return null
    if (
      typeof raw["confidence"] !== "number" ||
      raw["confidence"] < 0 ||
      raw["confidence"] > 1
    ) {
      return null
    }
    return {
      action: "CREATE",
      name: raw["name"] as string,
      importance: raw["importance"] as TagImportance,
      evidenceText: raw["evidenceText"] as string,
      confidence: raw["confidence"] as number,
    }
  }
  return null
}

function originRank(origin: EntityOrigin): number {
  return { USER: 0, AI: 1, IMPORT: 2, SHARE: 3 }[origin]
}

/**
 * raw モデル応答を検証し、APPLICABLE 候補集合を返す。
 * PARTIAL_SUCCESS は作らず、正常候補だけを残す。
 */
export function validateClassificationModelResult(
  input: ValidateClassificationResultInput,
): ValidateClassificationResultOutput {
  const codes = new Set<ClassificationRetryReasonCode>()
  const empty = (
    disposition: ResponseDisposition,
    outcome: AttemptOutcome,
  ): ValidateClassificationResultOutput => ({
    responseDisposition: disposition,
    outcome,
    rawCandidateCount: 0,
    modelDecisionCategoryId: null,
    modelDecisionCandidates: [],
    candidateSchemaInvalidIndexes: [],
    applicableCategoryId: null,
    applicableCandidates: [],
    diagnosticReasonCodes: [...codes].sort() as ClassificationRetryReasonCode[],
    acceptedCount: 0,
    rejectedCount: 0,
  })

  if (input.raw === null || input.raw === undefined) {
    codes.add("MODEL_RESULT_LOST")
    return empty("NO_RESPONSE", "TECHNICAL_FAILURE")
  }

  let parsed: unknown = input.raw
  if (typeof input.raw === "string") {
    try {
      parsed = JSON.parse(input.raw)
    } catch {
      codes.add("RESPONSE_SCHEMA_INVALID")
      return empty("JSON_INVALID", "GLOBAL_INVALID")
    }
  }

  if (!isPlainObject(parsed)) {
    codes.add("RESPONSE_SCHEMA_INVALID")
    return empty("ENVELOPE_INVALID", "GLOBAL_INVALID")
  }

  const allowedTop = new Set([
    "outcome",
    "categoryId",
    "tagDecisions",
    "reviewReasonCode",
  ])
  if (Object.keys(parsed).some((k) => !allowedTop.has(k))) {
    codes.add("RESPONSE_SCHEMA_INVALID")
    return empty("ENVELOPE_INVALID", "GLOBAL_INVALID")
  }

  const outcomeField = parsed["outcome"]
  const categoryIdField = parsed["categoryId"]
  const tagDecisionsField = parsed["tagDecisions"]
  const reviewReason = parsed["reviewReasonCode"]

  if (outcomeField === "NEEDS_REVIEW") {
    if (
      categoryIdField !== "UNASSIGNED" ||
      !Array.isArray(tagDecisionsField) ||
      tagDecisionsField.length !== 0 ||
      (reviewReason !== "INSUFFICIENT_EVIDENCE" &&
        reviewReason !== "AMBIGUOUS" &&
        reviewReason !== "NO_COMPATIBLE_CATEGORY")
    ) {
      codes.add("RESPONSE_SCHEMA_INVALID")
      return empty("ENVELOPE_INVALID", "GLOBAL_INVALID")
    }
    codes.add("MODEL_NEEDS_REVIEW")
    return {
      responseDisposition: "ENVELOPE_VALID",
      outcome: "GLOBAL_INVALID",
      rawCandidateCount: 0,
      modelDecisionCategoryId: null,
      modelDecisionCandidates: [],
      candidateSchemaInvalidIndexes: [],
      applicableCategoryId: null,
      applicableCandidates: [],
      diagnosticReasonCodes: [...codes].sort() as ClassificationRetryReasonCode[],
      acceptedCount: 0,
      rejectedCount: 0,
    }
  }

  if (outcomeField !== "CLASSIFIED" || reviewReason !== "NONE") {
    codes.add("RESPONSE_SCHEMA_INVALID")
    return empty("ENVELOPE_INVALID", "GLOBAL_INVALID")
  }

  if (typeof categoryIdField !== "string" || categoryIdField.length === 0) {
    codes.add("CATEGORY_INVALID")
    return {
      ...empty("ENVELOPE_VALID", "GLOBAL_INVALID"),
      diagnosticReasonCodes: [...codes].sort() as ClassificationRetryReasonCode[],
    }
  }

  const categoryIds = new Set(input.promptInput.categories.map((c) => c.id))
  if (!categoryIds.has(categoryIdField)) {
    codes.add("CATEGORY_INVALID")
    return {
      responseDisposition: "ENVELOPE_VALID",
      outcome: "GLOBAL_INVALID",
      rawCandidateCount: 0,
      modelDecisionCategoryId: categoryIdField,
      modelDecisionCandidates: [],
      candidateSchemaInvalidIndexes: [],
      applicableCategoryId: null,
      applicableCandidates: [],
      diagnosticReasonCodes: [...codes].sort() as ClassificationRetryReasonCode[],
      acceptedCount: 0,
      rejectedCount: 0,
    }
  }

  if (!Array.isArray(tagDecisionsField)) {
    codes.add("RESPONSE_SCHEMA_INVALID")
    return empty("ENVELOPE_INVALID", "GLOBAL_INVALID")
  }

  const rawCandidateCount = tagDecisionsField.length
  const modelDecisionCandidates: ModelDecisionCandidate[] = []
  const invalidIndexes: number[] = []

  for (let i = 0; i < tagDecisionsField.length; i++) {
    const decision = parseTagDecision(tagDecisionsField[i])
    if (!decision) {
      invalidIndexes.push(i)
      codes.add("CANDIDATE_SCHEMA_INVALID")
      continue
    }
    modelDecisionCandidates.push({ sourceIndex: i, decision })
  }

  const title = input.promptInput.bookmark.title
  const url = input.promptInput.bookmark.normalizedUrl
  const tagsById = new Map(input.snapshotTags.map((t) => [t.id, t]))
  const activeByNormalized = new Map<string, SnapshotTag[]>()
  const tombstoneNames = new Set<string>()
  for (const tag of input.snapshotTags) {
    if (tag.deletedAt !== null) {
      tombstoneNames.add(tag.normalizedName)
      continue
    }
    const list = activeByNormalized.get(tag.normalizedName) ?? []
    list.push(tag)
    activeByNormalized.set(tag.normalizedName, list)
  }

  type Draft =
    | {
        sourceIndex: number
        action: "REUSE"
        tagId: Id
        importance: TagImportance
        confidence: number
        normalizedName: string
      }
    | {
        sourceIndex: number
        action: "CREATE"
        name: string
        normalizedName: string
        importance: TagImportance
        confidence: number
      }

  const drafts: Draft[] = []
  let rejected = invalidIndexes.length

  for (const md of modelDecisionCandidates) {
    const { decision, sourceIndex } = md
    if (!evidencePresent(decision.evidenceText, title, url)) {
      codes.add("EVIDENCE_INVALID")
      rejected += 1
      continue
    }

    if (decision.action === "REUSE") {
      const tag = tagsById.get(decision.tagId)
      if (!tag || tag.deletedAt !== null) {
        codes.add("REUSE_ID_INVALID")
        rejected += 1
        continue
      }
      if (tag.parentCategoryId !== categoryIdField) {
        codes.add("REUSE_PARENT_MISMATCH")
        rejected += 1
        continue
      }
      drafts.push({
        sourceIndex,
        action: "REUSE",
        tagId: tag.id,
        importance: decision.importance,
        confidence: decision.confidence,
        normalizedName: tag.normalizedName,
      })
      continue
    }

    // CREATE
    if (!isCreateImportanceAllowed(input.policy, decision.importance)) {
      codes.add("IMPORTANCE_NOT_ALLOWED")
      rejected += 1
      continue
    }
    let normalizedName: string
    try {
      normalizedName = normalizeLabelName(decision.name).normalized
    } catch {
      codes.add("NAME_INVALID")
      rejected += 1
      continue
    }

    const existing = activeByNormalized.get(normalizedName) ?? []
    const inSelected = existing.filter((t) => t.parentCategoryId === categoryIdField)
    const outside = existing.filter((t) => t.parentCategoryId !== categoryIdField)

    if (outside.length > 0 && inSelected.length === 0) {
      codes.add("DUPLICATE")
      rejected += 1
      continue
    }
    if (tombstoneNames.has(normalizedName) && inSelected.length === 0) {
      codes.add("DUPLICATE")
      rejected += 1
      continue
    }
    if (inSelected.length > 0) {
      // CREATE → REUSE canonicalization
      const preferred = [...inSelected].sort((a, b) => {
        const or = originRank(a.origin) - originRank(b.origin)
        if (or !== 0) return or
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      })[0]!
      drafts.push({
        sourceIndex,
        action: "REUSE",
        tagId: preferred.id,
        importance: decision.importance,
        confidence: decision.confidence,
        normalizedName: preferred.normalizedName,
      })
      continue
    }

    drafts.push({
      sourceIndex,
      action: "CREATE",
      name: decision.name,
      normalizedName,
      importance: decision.importance,
      confidence: decision.confidence,
    })
  }

  // duplicate canonicalization
  const seenReuseIds = new Set<string>()
  const seenCreateNames = new Set<string>()
  const applicable: ApplicableCandidate[] = []

  for (const d of drafts) {
    if (d.action === "REUSE") {
      if (seenReuseIds.has(d.tagId)) {
        codes.add("DUPLICATE")
        rejected += 1
        continue
      }
      seenReuseIds.add(d.tagId)
      // drop CREATE with same normalizedName later
      applicable.push({
        sourceIndex: d.sourceIndex,
        action: "REUSE",
        tagId: d.tagId,
        importance: d.importance,
        confidence: d.confidence,
      })
      continue
    }
    if (seenReuseIds.size > 0) {
      // if any REUSE already has this normalizedName, drop CREATE
      const reuseHasName = drafts.some(
        (x) =>
          x.action === "REUSE" &&
          x.normalizedName === d.normalizedName &&
          seenReuseIds.has(x.tagId),
      )
      if (reuseHasName) {
        codes.add("DUPLICATE")
        rejected += 1
        continue
      }
    }
    if (seenCreateNames.has(d.normalizedName)) {
      codes.add("DUPLICATE")
      rejected += 1
      continue
    }
    // also: if a REUSE in applicable has same normalizedName
    const conflictReuse = applicable.some((a) => {
      if (a.action !== "REUSE") return false
      const tag = tagsById.get(a.tagId)
      return tag?.normalizedName === d.normalizedName
    })
    if (conflictReuse) {
      codes.add("DUPLICATE")
      rejected += 1
      continue
    }
    seenCreateNames.add(d.normalizedName)
    applicable.push({
      sourceIndex: d.sourceIndex,
      action: "CREATE",
      name: d.name,
      normalizedName: d.normalizedName,
      importance: d.importance,
      confidence: d.confidence,
      proposalKey: `${categoryIdField}:${d.normalizedName}`,
    })
  }

  if (applicable.length === 0) {
    codes.add("NO_VALID_CANDIDATE")
    return {
      responseDisposition: "ENVELOPE_VALID",
      outcome: "ZERO_VALID",
      rawCandidateCount,
      modelDecisionCategoryId: categoryIdField,
      modelDecisionCandidates,
      candidateSchemaInvalidIndexes: invalidIndexes,
      applicableCategoryId: null,
      applicableCandidates: [],
      diagnosticReasonCodes: [...codes].sort() as ClassificationRetryReasonCode[],
      acceptedCount: 0,
      rejectedCount: rejected,
    }
  }

  return {
    responseDisposition: "ENVELOPE_VALID",
    outcome: "APPLIED",
    rawCandidateCount,
    modelDecisionCategoryId: categoryIdField,
    modelDecisionCandidates,
    candidateSchemaInvalidIndexes: invalidIndexes,
    applicableCategoryId: categoryIdField,
    applicableCandidates: applicable,
    diagnosticReasonCodes: [...codes].sort() as ClassificationRetryReasonCode[],
    acceptedCount: applicable.length,
    rejectedCount: rejected,
  }
}

/** quality-zero かどうか（NEEDS_REVIEW 集計用） */
export function isQualityZeroOutcome(outcome: AttemptOutcome): boolean {
  return outcome === "GLOBAL_INVALID" || outcome === "ZERO_VALID"
}

/**
 * 最大3 DISPATCH_RESERVED 枠の終端判定。
 * 全 quality-zero → NEEDS_REVIEW、technical 混在枯渇 → FAILED。
 */
export function resolveDispatchBudgetTerminal(
  outcomes: ReadonlyArray<AttemptOutcome>,
): "NEEDS_REVIEW" | "FAILED" | null {
  if (outcomes.length < 3) return null
  const allQz = outcomes.every(isQualityZeroOutcome)
  if (allQz) return "NEEDS_REVIEW"
  const anyTech = outcomes.some((o) => o === "TECHNICAL_FAILURE")
  const allQzOrTech = outcomes.every(
    (o) => isQualityZeroOutcome(o) || o === "TECHNICAL_FAILURE",
  )
  if (anyTech && allQzOrTech) return "FAILED"
  return null
}
