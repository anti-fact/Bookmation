import type { ExtensionMessageApplication } from "~/application/extension-message-application"

import {
  getMessageRequestId,
  parseExtensionMessage,
  type ExtensionMessageResponse,
} from "./messages"

export type ExtensionMessageSender = Readonly<{
  id?: string
  url?: string
}>

function failure(
  requestId: string | null,
  code: Extract<ExtensionMessageResponse, { ok: false }>['error']['code'],
): ExtensionMessageResponse {
  return { requestId, ok: false, error: { code } }
}

export function isTrustedExtensionSender(
  sender: ExtensionMessageSender,
  runtimeId: string,
): boolean {
  if (sender.id !== runtimeId || typeof sender.url !== "string") {
    return false
  }

  try {
    const url = new URL(sender.url)
    return url.protocol === "chrome-extension:" && url.host === runtimeId
  } catch {
    return false
  }
}

/** A stateless router: durable idempotency belongs to the Application / Repository. */
export function createExtensionMessageRouter(
  runtimeId: string,
  application: ExtensionMessageApplication,
) {
  return {
    async handle(
      message: unknown,
      sender: ExtensionMessageSender,
    ): Promise<ExtensionMessageResponse> {
      const requestId = getMessageRequestId(message)
      if (!isTrustedExtensionSender(sender, runtimeId)) {
        return failure(requestId, "UNAUTHORIZED_SENDER")
      }

      const request = parseExtensionMessage(message)
      if (!request) {
        return failure(requestId, "INVALID_MESSAGE")
      }

      try {
        return await application.handle(request)
      } catch {
        return failure(request.requestId, "INTERNAL_ERROR")
      }
    },
  }
}
