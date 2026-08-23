import { describe, expect, it } from "vitest"

import { DEFAULT_LOCAL_SETTINGS } from "~/domain/local-settings"
import type { ContextMenuPort } from "~/ports/context-menu-port"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"
import {
  ContextMenuApplicationError,
  updateContextMenuBookmarkEnabled,
} from "./update-context-menu-setting"

describe("updateContextMenuBookmarkEnabled", () => {
  it("persists enabled value and reconciles menus", async () => {
    const store = createMemoryStore()
    const contextMenus = createContextMenuPort()

    const result = await updateContextMenuBookmarkEnabled(store, contextMenus, false)

    expect(result.contextMenuBookmarkEnabled).toBe(false)
    expect((await store.get()).contextMenuBookmarkEnabled).toBe(false)
    expect(contextMenus.enabledStates).toEqual([false])
  })

  it("rolls back storage when reconcile fails", async () => {
    const store = createMemoryStore()
    const contextMenus = createContextMenuPort({ failOnReconcile: true })

    await expect(updateContextMenuBookmarkEnabled(store, contextMenus, false)).rejects.toBeInstanceOf(
      ContextMenuApplicationError,
    )

    expect((await store.get()).contextMenuBookmarkEnabled).toBe(true)
  })

  it("no-ops storage write when value is unchanged", async () => {
    const store = createMemoryStore()
    const contextMenus = createContextMenuPort()

    await updateContextMenuBookmarkEnabled(store, contextMenus, true)

    expect(store.writeCount).toBe(0)
    expect(contextMenus.enabledStates).toEqual([true])
  })
})

function createMemoryStore(initial = DEFAULT_LOCAL_SETTINGS): LocalSettingsStore & {
  get writeCount(): number
} {
  let current = { ...initial }
  let writeCount = 0
  return {
    get writeCount() {
      return writeCount
    },
    async get() {
      return { ...current }
    },
    async set(settings) {
      writeCount += 1
      current = { ...settings }
    },
  }
}

function createContextMenuPort(options?: {
  failOnReconcile?: boolean
}): ContextMenuPort & { enabledStates: boolean[] } {
  const enabledStates: boolean[] = []
  return {
    enabledStates,
    async reconcile(enabled: boolean) {
      enabledStates.push(enabled)
      if (options?.failOnReconcile) {
        throw new Error("sync failed")
      }
    },
  }
}
