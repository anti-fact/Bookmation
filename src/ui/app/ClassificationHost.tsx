import * as React from "react"

import {
  classifyBookmarkWithLocalPrompt,
  type PromptApi,
} from "~/adapters/chrome-prompt-classifier"
import { EXTENSION_MESSAGE_SCHEMA_VERSION } from "~/extension/messages"

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function localPromptApi(): PromptApi | null {
  return (
    globalThis as unknown as { LanguageModel?: PromptApi }
  ).LanguageModel ?? null
}

async function send(
  action: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const response = await chrome.runtime.sendMessage({
    schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
    requestId: crypto.randomUUID(),
    source: "ai-host",
    action,
    payload,
  })
  return record(response)
}

export function ClassificationHost() {
  React.useEffect(() => {
    let disposed = false
    const executorInstanceId = crypto.randomUUID()

    const run = async () => {
      try {
        const promptApi = localPromptApi()
        if (
          disposed ||
          !promptApi ||
          (await promptApi.availability({
            expectedInputs: [{ type: "text", languages: ["ja"] }],
            expectedOutputs: [{ type: "text", languages: ["ja"] }],
          })) !== "available"
        ) {
          return
        }

        const claim = await send("claim-classification-job", {
          executorInstanceId,
        })
        const data = claim?.ok === true ? record(claim.data) : null
        const job = data && record(data.job)
        const bookmark = data && record(data.bookmark)
        const labels =
          data && Array.isArray(data.labels)
            ? data.labels
                .map(record)
                .filter(
                  (label): label is Record<string, unknown> => !!label,
                )
            : []
        if (
          !job ||
          !bookmark ||
          typeof job.id !== "string" ||
          typeof bookmark.revision !== "number" ||
          typeof bookmark.title !== "string" ||
          typeof bookmark.normalizedUrl !== "string"
        ) {
          return
        }

        const categoryNames = new Map(
          labels
            .filter(
              (label) =>
                label.kind === "CATEGORY" &&
                typeof label.id === "string" &&
                typeof label.name === "string",
            )
            .map((label) => [label.id as string, label.name as string]),
        )
        const tags = labels
          .filter(
            (label) =>
              label.kind === "TAG" &&
              typeof label.id === "string" &&
              typeof label.name === "string",
          )
          .map((label) => ({
            id: label.id as string,
            name: label.name as string,
            parentCategoryId:
              typeof label.parentCategoryId === "string"
                ? label.parentCategoryId
                : null,
            parentCategoryName:
              typeof label.parentCategoryId === "string"
                ? (categoryNames.get(label.parentCategoryId) ?? null)
                : null,
          }))
        const result = await classifyBookmarkWithLocalPrompt(promptApi, {
          title: bookmark.title,
          normalizedUrl: bookmark.normalizedUrl,
          tags,
        })
        if (disposed) return
        await send("apply-classification-result", {
          jobId: job.id,
          executorInstanceId,
          bookmarkRevision: bookmark.revision,
          outcome: result?.outcome ?? "NEEDS_REVIEW",
          tagIds: result?.tagIds ?? [],
          errorCode: result ? null : "PROMPT_OUTPUT_INVALID",
        })
      } catch {
        // Lease expiry recovery handles transient failures.
      }
    }

    void run()
    const timer = globalThis.setInterval(() => void run(), 60_000)
    return () => {
      disposed = true
      globalThis.clearInterval(timer)
    }
  }, [])

  return null
}
