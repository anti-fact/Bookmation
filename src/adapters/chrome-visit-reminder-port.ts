import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  type ExtensionMessageResponse
} from "~/extension/messages"
import {
  type VisitReminderPort,
} from "~/ui/features/visit-reminder/visit-reminder-port"

type VisitReminderChromeApi = Readonly<{
  runtime: {
    sendMessage(message: unknown): Promise<unknown>
    lastError?: { message?: string }
  }
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function decodePendingReminder(value: unknown) {
  if (value === null) return null
  if (
    !isRecord(value) ||
    typeof value.reminderId !== "string" ||
    typeof value.normalizedUrl !== "string" ||
    typeof value.title !== "string" ||
    typeof value.visitDays !== "number"
  ) {
    throw new Error("保留中のリマインダーの取得に失敗しました。")
  }
  return {
    reminderId: value.reminderId,
    normalizedUrl: value.normalizedUrl,
    title: value.title,
    visitDays: value.visitDays,
  }
}

export function createChromeVisitReminderPort(
  chromeApi: VisitReminderChromeApi,
  createRequestId: () => string = () => crypto.randomUUID()
): VisitReminderPort {
  return {
    async getPending() {
      const requestId = createRequestId()
      const value = await chromeApi.runtime.sendMessage({
        action: "get-pending-visit-reminder",
        payload: {},
        requestId,
        schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
        source: "dashboard",
      })

      if (chromeApi.runtime.lastError?.message) {
        throw new Error(chromeApi.runtime.lastError.message)
      }

      if (!isRecord(value) || value.requestId !== requestId) {
        throw new Error("保留中のリマインダーの取得に失敗しました。")
      }

      const response = value as ExtensionMessageResponse
      if (!response.ok) {
        throw new Error("保留中のリマインダーの取得に失敗しました。")
      }

      return decodePendingReminder(response.data ?? null)
    },

    async respond(input) {
      const requestId = createRequestId()
      const value = await chromeApi.runtime.sendMessage({
        action: "handle-visit-reminder",
        payload: {
          reminderId: input.reminderId,
          response: input.response,
          ...(input.suppressFuture ? { suppressFuture: true } : {}),
        },
        requestId,
        schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
        source: "dashboard",
      })

      if (chromeApi.runtime.lastError?.message) {
        throw new Error(chromeApi.runtime.lastError.message)
      }

      if (!isRecord(value) || value.requestId !== requestId) {
        throw new Error("リマインダーへの応答に失敗しました。")
      }

      const response = value as ExtensionMessageResponse
      if (!response.ok) {
        throw new Error("リマインダーへの応答に失敗しました。")
      }
    },
  }
}
