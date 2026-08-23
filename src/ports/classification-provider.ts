/**
 * ClassificationProvider Port（BACKEND.md）
 * AI Host Document 内だけで生成・呼び出す。
 */
import type { ClassificationPromptInput } from "~/domain"

export type AiCapabilityState =
  | "AVAILABLE"
  | "DOWNLOADABLE"
  | "DOWNLOADING"
  | "UNAVAILABLE"

export type AiCapability = {
  state: AiCapabilityState
  providerModel: string | null
}

export type ClassificationProviderErrorCode =
  | "PROMPT_API_UNAVAILABLE"
  | "PROMPT_MODEL_PREPARING"
  | "PROMPT_MODEL_DOWNLOAD_FAILED"
  | "PROMPT_SESSION_FAILED"
  | "PROMPT_INPUT_TOO_LARGE"
  | "PROMPT_RESPONSE_TOO_LARGE"
  | "PROMPT_TECHNICAL_FAILURE"

export class ClassificationProviderError extends Error {
  readonly code: ClassificationProviderErrorCode
  constructor(code: ClassificationProviderErrorCode, message?: string) {
    super(message ? `${code}: ${message}` : code)
    this.name = "ClassificationProviderError"
    this.code = code
  }
}

/** 未検証の生応答。Domain validate へ渡す。 */
export type UnknownClassificationOutput = {
  rawText: string
  parsed: unknown
}

export interface ClassificationProvider {
  capability(): Promise<AiCapability>
  classify(input: ClassificationPromptInput): Promise<UnknownClassificationOutput>
}
