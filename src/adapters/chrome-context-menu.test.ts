import { describe, expect, it, vi } from "vitest"

import {
  CONTEXT_MENU_BOOKMARK_LINK_ID,
  CONTEXT_MENU_BOOKMARK_PAGE_ID,
  CONTEXT_MENU_BOOKMARK_LINK_TITLE,
  CONTEXT_MENU_BOOKMARK_PAGE_TITLE,
} from "~/domain/context-menu"
import { ChromeContextMenuAdapter, type ContextMenusApi } from "~/adapters/chrome-context-menu"

describe("ChromeContextMenuAdapter", () => {
  it("creates owned page and link menus when enabled", async () => {
    const api = createContextMenusApi()
    const adapter = new ChromeContextMenuAdapter(api)

    await adapter.reconcile(true)

    expect(api.create).toHaveBeenCalledTimes(2)
    expect(api.create).toHaveBeenCalledWith({
      id: CONTEXT_MENU_BOOKMARK_PAGE_ID,
      title: CONTEXT_MENU_BOOKMARK_PAGE_TITLE,
      contexts: ["page"],
    })
    expect(api.create).toHaveBeenCalledWith({
      id: CONTEXT_MENU_BOOKMARK_LINK_ID,
      title: CONTEXT_MENU_BOOKMARK_LINK_TITLE,
      contexts: ["link"],
    })
    expect(api.remove).not.toHaveBeenCalled()
    expect(api.removeAll).not.toHaveBeenCalled()
  })

  it("updates menus when create reports duplicate id", async () => {
    const api = createContextMenusApi()
    const adapter = new ChromeContextMenuAdapter(api)

    await adapter.reconcile(true)
    await adapter.reconcile(true)

    expect(api.update).toHaveBeenCalledTimes(2)
  })

  it("removes only owned menus when disabled", async () => {
    const api = createContextMenusApi()
    const adapter = new ChromeContextMenuAdapter(api)

    await adapter.reconcile(false)

    expect(api.remove).toHaveBeenCalledTimes(2)
    expect(api.remove).toHaveBeenCalledWith(CONTEXT_MENU_BOOKMARK_PAGE_ID)
    expect(api.remove).toHaveBeenCalledWith(CONTEXT_MENU_BOOKMARK_LINK_ID)
    expect(api.create).not.toHaveBeenCalled()
  })

  it("ignores missing menu errors on remove", async () => {
    const api = createContextMenusApi({
      removeError: new Error("Cannot find menu item with id bookmation-save-page"),
    })
    const adapter = new ChromeContextMenuAdapter(api)

    await expect(adapter.reconcile(false)).resolves.toBeUndefined()
  })

  it("is idempotent across repeated reconcile while enabled", async () => {
    const api = createContextMenusApi()
    const adapter = new ChromeContextMenuAdapter(api)

    await adapter.reconcile(true)
    await adapter.reconcile(true)

    expect(api.create).toHaveBeenCalledTimes(4)
    expect(api.update).toHaveBeenCalledTimes(2)
  })
})

function createContextMenusApi(options?: {
  createError?: Error
  removeError?: Error
}): ContextMenusApi & {
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  removeAll: ReturnType<typeof vi.fn>
} {
  const created = new Set<string>()
  const create = vi.fn(async (properties: chrome.contextMenus.CreateProperties) => {
    if (typeof properties.id === "string") {
      if (created.has(properties.id)) {
        throw options?.createError ?? new Error("Cannot create item with duplicate id")
      }
      created.add(properties.id)
    }
    return properties.id ?? "generated"
  })
  const update = vi.fn(async () => undefined)
  const remove = vi.fn(async (id: string | number) => {
    if (options?.removeError) {
      throw options.removeError
    }
    created.delete(String(id))
  })
  const removeAll = vi.fn(async () => undefined)

  return { create, update, remove, removeAll }
}
