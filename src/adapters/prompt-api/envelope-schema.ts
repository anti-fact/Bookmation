/**
 * AI_GUIDE: responseConstraint は envelope のみ。tagDecisions items は制約しない。
 */
export const CLASSIFICATION_RESPONSE_ENVELOPE_CONSTRAINT = {
  type: "object",
  properties: {
    outcome: { type: "string", enum: ["CLASSIFIED", "NEEDS_REVIEW"] },
    categoryId: { type: "string" },
    tagDecisions: { type: "array" },
    reviewReasonCode: {
      type: "string",
      enum: ["NONE", "INSUFFICIENT_EVIDENCE", "AMBIGUOUS", "NO_COMPATIBLE_CATEGORY"],
    },
  },
  required: ["outcome", "categoryId", "tagDecisions", "reviewReasonCode"],
  additionalProperties: false,
} as const
