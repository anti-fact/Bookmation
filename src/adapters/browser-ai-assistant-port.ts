import { EXTENSION_MESSAGE_SCHEMA_VERSION } from "~/extension/messages"
import {
  BOOKMATION_CAPABILITY_CATALOG_VERSION,
  bookmationCapabilities,
  getStaticCapabilityAnswer
} from "~/catalogs/bookmation-capabilities"
import type {
  AiAssistantCandidate,
  AiAssistantIntent,
  AiAssistantPort
} from "~/ui/features/ai-assistant/ai-assistant-port"

type SendMessage = (message: unknown) => Promise<unknown>
type Availability = "unavailable" | "downloadable" | "downloading" | "available"
type LanguageModelSessionLike = {
  destroy(): void
  prompt(
    input: string,
    options?: {
      responseConstraint?: Record<string, unknown>
      signal?: AbortSignal
    }
  ): Promise<string>
}
type LanguageModelLike = {
  availability(options: Record<string, unknown>): Promise<Availability>
  create(options: Record<string, unknown>): Promise<LanguageModelSessionLike>
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const helpWords = [
  "使い方",
  "できる",
  "保存",
  "設定",
  "分類",
  "共有",
  "アーカイブ",
  "復元",
  "インポート",
  "右クリック"
]
const outOfScopeWords = ["天気", "ニュース", "株価", "翻訳", "レシピ"]

function fallbackIntent(input: string): AiAssistantIntent {
  if (outOfScopeWords.some((word) => input.includes(word)))
    return "OUT_OF_SCOPE"
  if (helpWords.some((word) => input.includes(word))) return "PRODUCT_HELP"
  return "SEARCH_LIBRARY"
}

function fallbackQuery(input: string) {
  const stripped = input
    .replace(
      /(の)?(資料|ブックマーク)?を?(探して|検索して|見せて|教えて)$/u,
      ""
    )
    .trim()
  return stripped || input.trim()
}

function parseModelResponse(value: string): {
  answerText: string
  intent: AiAssistantIntent
  query: string
} | null {
  try {
    const parsed = record(JSON.parse(value))
    if (
      !parsed ||
      (parsed.intent !== "SEARCH_LIBRARY" &&
        parsed.intent !== "PRODUCT_HELP" &&
        parsed.intent !== "OUT_OF_SCOPE") ||
      typeof parsed.query !== "string" ||
      typeof parsed.answerText !== "string" ||
      parsed.query.length > 200 ||
      parsed.answerText.length > 1_000
    )
      return null
    return {
      answerText: parsed.answerText,
      intent: parsed.intent,
      query: parsed.query.trim()
    }
  } catch {
    return null
  }
}

function parseCandidates(value: unknown): AiAssistantCandidate[] {
  const data = record(value)
  if (!data || !Array.isArray(data.labels) || !Array.isArray(data.bookmarks))
    return []
  const labels = data.labels.flatMap((value): AiAssistantCandidate[] => {
    const item = record(value)
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.revision !== "number" ||
      (item.kind !== "CATEGORY" && item.kind !== "TAG")
    )
      return []
    return [
      {
        entityType: "LABEL",
        id: item.id,
        kind: item.kind,
        name: item.name,
        parentCategoryId:
          typeof item.parentCategoryId === "string"
            ? item.parentCategoryId
            : null,
        revision: item.revision
      }
    ]
  })
  const bookmarks = data.bookmarks.flatMap((value): AiAssistantCandidate[] => {
    const item = record(value)
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.normalizedUrl !== "string" ||
      typeof item.revision !== "number"
    )
      return []
    return [
      {
        entityType: "BOOKMARK",
        id: item.id,
        normalizedUrl: item.normalizedUrl,
        revision: item.revision,
        title: item.title
      }
    ]
  })
  return [
    ...labels.sort((left, right) =>
      left.entityType === "LABEL" && right.entityType === "LABEL"
        ? left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
        : 0
    ),
    ...bookmarks.sort((left, right) =>
      left.entityType === "BOOKMARK" && right.entityType === "BOOKMARK"
        ? left.title.localeCompare(right.title) ||
          left.id.localeCompare(right.id)
        : 0
    )
  ]
}

async function search(
  sendMessage: SendMessage,
  keyword: string,
  signal?: AbortSignal
) {
  signal?.throwIfAborted()
  const requestId = crypto.randomUUID()
  const response = record(
    await sendMessage({
      action: "search-library",
      payload: { keyword, mode: "SEARCH" },
      requestId,
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      source: "dashboard"
    })
  )
  signal?.throwIfAborted()
  if (!response || response.ok !== true || response.requestId !== requestId)
    throw new Error("SEARCH_FAILED")
  return parseCandidates(response.data)
}

const promptOptions = {
  expectedInputs: [{ languages: ["ja"], type: "text" }],
  expectedOutputs: [{ languages: ["ja"], type: "text" }]
}

export function createBrowserAiAssistantPort({
  languageModel = (window as Window & { LanguageModel?: LanguageModelLike })
    .LanguageModel,
  sendMessage = (message) => chrome.runtime.sendMessage(message)
}: {
  languageModel?: LanguageModelLike
  sendMessage?: SendMessage
} = {}): AiAssistantPort {
  return {
    async ask(input, options = {}) {
      const normalizedInput = input.trim()
      if (!normalizedInput || normalizedInput.length > 500)
        throw new Error("INVALID_AI_INPUT")
      options.signal?.throwIfAborted()
      options.onProgress?.("processing")

      let aiAvailable = false
      let modelResult: ReturnType<typeof parseModelResponse> = null
      let session: LanguageModelSessionLike | null = null
      try {
        if (
          languageModel &&
          (await languageModel.availability(promptOptions)) === "available"
        ) {
          aiAvailable = true
          session = await languageModel.create({
            ...promptOptions,
            signal: options.signal
          })
          options.onProgress?.("streaming")
          const result = await session.prompt(
            `あなたはBookmation専用アシスタントです。入力をSEARCH_LIBRARY、PRODUCT_HELP、OUT_OF_SCOPEのいずれかに分類してください。SEARCH_LIBRARYでは検索用の短いqueryを、PRODUCT_HELPでは次の機能カタログだけに基づく日本語回答を返してください。設定変更、削除、共有、権限要求を実行したとは回答しないでください。\n\nCapability Catalog v${BOOKMATION_CAPABILITY_CATALOG_VERSION}: ${JSON.stringify(bookmationCapabilities)}\n\n利用者入力(JSON): ${JSON.stringify(normalizedInput)}`,
            {
              responseConstraint: {
                additionalProperties: false,
                properties: {
                  answerText: { type: "string" },
                  intent: {
                    enum: ["SEARCH_LIBRARY", "PRODUCT_HELP", "OUT_OF_SCOPE"],
                    type: "string"
                  },
                  query: { type: "string" }
                },
                required: ["intent", "query", "answerText"],
                type: "object"
              },
              signal: options.signal
            }
          )
          modelResult = parseModelResponse(result)
          if (!modelResult) aiAvailable = false
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          throw error
        aiAvailable = false
      } finally {
        session?.destroy()
      }

      const intent = modelResult?.intent ?? fallbackIntent(normalizedInput)
      if (intent === "OUT_OF_SCOPE")
        return {
          aiAvailable,
          answerText:
            "Bookmationの保存、整理、検索、設定、共有、アーカイブに関する質問に対応しています。",
          candidates: [],
          intent,
          query: null
        }
      if (intent === "PRODUCT_HELP")
        return {
          aiAvailable,
          answerText: getStaticCapabilityAnswer(normalizedInput),
          candidates: [],
          intent,
          query: null
        }

      const query = modelResult?.query || fallbackQuery(normalizedInput)
      const candidates = await search(sendMessage, query, options.signal)
      return {
        aiAvailable,
        answerText: candidates.length
          ? `${candidates.length}件の候補が見つかりました。候補を選ぶか、全画面検索で確認できます。`
          : "候補は見つかりませんでした。別の言葉でもう一度お試しください。",
        candidates,
        intent,
        query
      }
    }
  }
}
