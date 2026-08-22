import type { JsonValue } from "~/domain"
import type {
  ExtensionMessageRequest,
  ExtensionMessageResponse,
} from "~/extension/messages"

/**
 * Chrome event router が依存する Application 境界。
 * 各 BE-04 以降の use case はこの実装へ注入し、Chrome API を持ち込まない。
 */
export interface ExtensionMessageApplication {
  handle(request: ExtensionMessageRequest): Promise<ExtensionMessageResponse>
}

export function successResponse(requestId: string, data: JsonValue): ExtensionMessageResponse {
  return { requestId, ok: true, data }
}

/**
 * 未実装の業務 action を安全に閉じる初期 Application。
 * router は受理済み action を必ず Application に渡し、機能追加時に
 * Service Worker の分岐を増やさない。
 */
export const deferredExtensionMessageApplication: ExtensionMessageApplication = {
  async handle(request) {
    return {
      requestId: request.requestId,
      ok: false,
      error: { code: "ACTION_NOT_AVAILABLE" },
    }
  },
}
