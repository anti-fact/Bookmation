/**
 * Chrome Prompt API (LanguageModel) 型 — top-level extension page 専用
 */
export type LanguageModelAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available"

export type LanguageModelPromptOptions = {
  expectedInputs: { type: "text"; languages: string[] }[]
  expectedOutputs: { type: "text"; languages: string[] }[]
  initialPrompts?: Array<{ role: "system" | "user" | "assistant"; content: string }>
  monitor?: (monitor: LanguageModelMonitor) => void
  signal?: AbortSignal
}

export type LanguageModelMonitor = EventTarget & {
  addEventListener(
    type: "downloadprogress",
    listener: (event: Event & { loaded?: number }) => void,
  ): void
}

export type LanguageModelSession = {
  prompt: (
    input: string,
    options?: {
      responseConstraint?: Record<string, unknown>
      signal?: AbortSignal
    },
  ) => Promise<string>
  destroy: () => void
}

export type LanguageModelApi = {
  availability: (
    options: LanguageModelPromptOptions,
  ) => Promise<LanguageModelAvailability>
  create: (options: LanguageModelPromptOptions) => Promise<LanguageModelSession>
}

declare global {
  interface Window {
    LanguageModel?: LanguageModelApi
  }
}

export const PROMPT_API_JA_OPTIONS: LanguageModelPromptOptions = {
  expectedInputs: [{ type: "text", languages: ["ja"] }],
  expectedOutputs: [{ type: "text", languages: ["ja"] }],
}

export function getLanguageModel(): LanguageModelApi | null {
  if (typeof window === "undefined") return null
  return window.LanguageModel ?? null
}
