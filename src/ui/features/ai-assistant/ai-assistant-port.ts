export type AiAssistantIntent =
  | "SEARCH_LIBRARY"
  | "PRODUCT_HELP"
  | "OUT_OF_SCOPE"

export type AiAssistantCandidate =
  | {
      entityType: "LABEL"
      id: string
      kind: "CATEGORY" | "TAG"
      name: string
      parentCategoryId: string | null
      revision: number
    }
  | {
      entityType: "BOOKMARK"
      id: string
      normalizedUrl: string
      revision: number
      title: string
    }

export type AiAssistantResponse = {
  aiAvailable: boolean
  answerText: string
  candidates: AiAssistantCandidate[]
  intent: AiAssistantIntent
  query: string | null
}

export interface AiAssistantPort {
  ask(
    input: string,
    options?: {
      onProgress?: (phase: "processing" | "streaming") => void
      signal?: AbortSignal
    }
  ): Promise<AiAssistantResponse>
}

export const emptyAiAssistantPort: AiAssistantPort = {
  ask: async () => ({
    aiAvailable: false,
    answerText:
      "AIアシスタントは現在利用できません。キーワード検索をご利用ください。",
    candidates: [],
    intent: "OUT_OF_SCOPE",
    query: null
  })
}
