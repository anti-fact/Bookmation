import { describe, expect, it, vi } from "vitest"

import type { ExtensionMessageApplication } from "~/application"

import {
  EXTENSION_MESSAGE_SCHEMA_VERSION,
  MAX_EXTENSION_MESSAGE_BYTES,
  parseExtensionMessage,
} from "./messages"
import { createExtensionMessageRouter, isTrustedExtensionSender } from "./message-router"

const runtimeId = "test-extension-id"
const trustedSender = {
  id: runtimeId,
  url: `chrome-extension://${runtimeId}/tabs/index.html`,
}

function listRequest(requestId = "request-1") {
  return {
    schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
    requestId,
    source: "dashboard",
    action: "list-bookmarks",
    payload: { cursor: null },
  } as const
}

describe("extension message protocol", () => {
  it("accepts a versioned allowlisted request", () => {
    expect(parseExtensionMessage(listRequest())).toEqual(listRequest())
  })

  it("accepts ai-host classification job requests", () => {
    const claimRequest = {
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      requestId: "claim-1",
      source: "ai-host",
      action: "claim-classification-job",
      payload: { executorInstanceId: crypto.randomUUID() },
    } as const
    expect(parseExtensionMessage(claimRequest)).toEqual(claimRequest)
  })

  it("accepts dashboard classification job management requests", () => {
    const getRequest = {
      schemaVersion: EXTENSION_MESSAGE_SCHEMA_VERSION,
      requestId: "get-job-1",
      source: "dashboard",
      action: "get-classification-job",
      payload: { jobId: crypto.randomUUID() },
    } as const
    expect(parseExtensionMessage(getRequest)).toEqual(getRequest)
  })

  it("rejects unknown action, invalid source, and unknown schema version", () => {
    expect(parseExtensionMessage({ ...listRequest(), action: "unknown" })).toBeNull()
    expect(parseExtensionMessage({ ...listRequest(), source: "popup" })).toBeNull()
    expect(parseExtensionMessage({ ...listRequest(), schemaVersion: 2 })).toBeNull()
  })

  it("rejects an oversized payload before it reaches Application", () => {
    const request = {
      ...listRequest(),
      payload: { text: "x".repeat(MAX_EXTENSION_MESSAGE_BYTES) },
    }
    expect(parseExtensionMessage(request)).toBeNull()
  })

  it("rejects dangerous object keys in payload", () => {
    const request = {
      ...listRequest(),
      payload: { constructor: { polluted: true } },
    }
    expect(parseExtensionMessage(request)).toBeNull()
  })

  it("rejects deeply nested payload objects", () => {
    let payload: Record<string, unknown> = { leaf: true }
    for (let index = 0; index < 10; index += 1) {
      payload = { nested: payload }
    }
    expect(
      parseExtensionMessage({
        ...listRequest(),
        payload,
      }),
    ).toBeNull()
  })
})

describe("extension message router", () => {
  it("rejects a sender outside this extension", async () => {
    const handle = vi.fn()
    const router = createExtensionMessageRouter(runtimeId, { handle })

    await expect(
      router.handle(listRequest(), {
        id: "other-extension",
        url: "chrome-extension://other-extension/popup.html",
      }),
    ).resolves.toEqual({
      requestId: "request-1",
      ok: false,
      error: { code: "UNAUTHORIZED_SENDER" },
    })
    expect(handle).not.toHaveBeenCalled()
  })

  it("requires an extension URL even if sender.id matches", () => {
    expect(isTrustedExtensionSender({ id: runtimeId }, runtimeId)).toBe(false)
    expect(
      isTrustedExtensionSender(
        { id: runtimeId, url: "https://example.test/" },
        runtimeId,
      ),
    ).toBe(false)
  })

  it("delegates accepted actions to Application", async () => {
    const application: ExtensionMessageApplication = {
      handle: vi.fn().mockResolvedValue({
        requestId: "request-1",
        ok: true,
        data: { items: [] },
      }),
    }
    const router = createExtensionMessageRouter(runtimeId, application)

    await expect(router.handle(listRequest(), trustedSender)).resolves.toEqual({
      requestId: "request-1",
      ok: true,
      data: { items: [] },
    })
    expect(application.handle).toHaveBeenCalledWith(listRequest())
  })

  it("keeps no in-memory request state, so retries reach durable Application handling", async () => {
    const handle = vi.fn().mockResolvedValue({
      requestId: "retry-1",
      ok: true,
      data: { saved: true },
    })
    const application: ExtensionMessageApplication = { handle }

    await createExtensionMessageRouter(runtimeId, application).handle(
      listRequest("retry-1"),
      trustedSender,
    )
    // A new router represents a restarted MV3 Service Worker.
    await createExtensionMessageRouter(runtimeId, application).handle(
      listRequest("retry-1"),
      trustedSender,
    )

    expect(handle).toHaveBeenCalledTimes(2)
    expect(handle).toHaveBeenNthCalledWith(1, listRequest("retry-1"))
    expect(handle).toHaveBeenNthCalledWith(2, listRequest("retry-1"))
  })
})
