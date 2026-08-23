/**
 * Gemini Nano (Chrome Prompt API) ClassificationProvider
 * top-level extension page でのみインスタンス化する。
 */
import {
  canonicalizeUnknown,
  GEMINI_NANO_TAG_CLASSIFIER_V2_SYSTEM_PROMPT,
  MAX_MODEL_RESPONSE_BYTES,
  MAX_PROMPT_INPUT_BYTES,
  utf8ByteLength,
  type ClassificationPromptInput,
} from "~/domain"
import type {
  AiCapability,
  ClassificationProvider,
  UnknownClassificationOutput,
} from "~/ports/classification-provider"
import { ClassificationProviderError } from "~/ports/classification-provider"
import { CLASSIFICATION_RESPONSE_ENVELOPE_CONSTRAINT } from "./envelope-schema"
import {
  getLanguageModel,
  PROMPT_API_JA_OPTIONS,
  type LanguageModelApi,
  type LanguageModelSession,
} from "./types"

export type GeminiNanoClassificationProviderOptions = {
  languageModel?: LanguageModelApi | null
  onDownloadProgress?: (loaded: number) => void
  signal?: AbortSignal
}

export function createGeminiNanoClassificationProvider(
  options: GeminiNanoClassificationProviderOptions = {},
): ClassificationProvider {
  const resolveApi = () => options.languageModel ?? getLanguageModel()

  return {
    async capability(): Promise<AiCapability> {
      const lm = resolveApi()
      if (!lm) {
        return { state: "UNAVAILABLE", providerModel: null }
      }
      try {
        const availability = await lm.availability({ ...PROMPT_API_JA_OPTIONS })
        const state =
          availability === "available"
            ? "AVAILABLE"
            : availability === "downloadable"
              ? "DOWNLOADABLE"
              : availability === "downloading"
                ? "DOWNLOADING"
                : "UNAVAILABLE"
        return { state, providerModel: "chrome-prompt-api" }
      } catch {
        return { state: "UNAVAILABLE", providerModel: null }
      }
    },

    async classify(
      input: ClassificationPromptInput,
    ): Promise<UnknownClassificationOutput> {
      const lm = resolveApi()
      if (!lm) {
        throw new ClassificationProviderError("PROMPT_API_UNAVAILABLE")
      }

      const capability = await this.capability()
      if (capability.state === "UNAVAILABLE") {
        throw new ClassificationProviderError("PROMPT_API_UNAVAILABLE")
      }
      if (capability.state === "DOWNLOADING") {
        throw new ClassificationProviderError("PROMPT_MODEL_PREPARING")
      }

      const inputJson = canonicalizeUnknown(input)
      const inputBytes = utf8ByteLength(inputJson)
      if (inputBytes > MAX_PROMPT_INPUT_BYTES) {
        throw new ClassificationProviderError(
          "PROMPT_INPUT_TOO_LARGE",
          `bytes=${inputBytes}`,
        )
      }

      // system prompt + user JSON（データは system へ補間しない）
      const userMessage = inputJson
      let session: LanguageModelSession | null = null
      try {
        session = await lm.create({
          ...PROMPT_API_JA_OPTIONS,
          initialPrompts: [
            { role: "system", content: GEMINI_NANO_TAG_CLASSIFIER_V2_SYSTEM_PROMPT },
          ],
          signal: options.signal,
          monitor: options.onDownloadProgress
            ? (monitor) => {
                monitor.addEventListener("downloadprogress", (event) => {
                  if (typeof event.loaded === "number") {
                    options.onDownloadProgress!(event.loaded)
                  }
                })
              }
            : undefined,
        })

        const rawText = await session.prompt(userMessage, {
          responseConstraint: {
            ...CLASSIFICATION_RESPONSE_ENVELOPE_CONSTRAINT,
          },
          signal: options.signal,
        })

        const responseBytes = utf8ByteLength(rawText)
        if (responseBytes > MAX_MODEL_RESPONSE_BYTES) {
          throw new ClassificationProviderError(
            "PROMPT_RESPONSE_TOO_LARGE",
            `bytes=${responseBytes}`,
          )
        }

        let parsed: unknown = rawText
        try {
          parsed = JSON.parse(rawText)
        } catch {
          // JSON 不正はそのまま Domain validator へ（GLOBAL_INVALID）
          parsed = rawText
        }

        return { rawText, parsed }
      } catch (error) {
        if (error instanceof ClassificationProviderError) throw error
        throw new ClassificationProviderError(
          "PROMPT_SESSION_FAILED",
          error instanceof Error ? error.message : String(error),
        )
      } finally {
        try {
          session?.destroy()
        } catch {
          // destroy 失敗は握りつぶす
        }
      }
    },
  }
}
