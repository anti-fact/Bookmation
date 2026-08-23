import {
  OWNED_CONTEXT_MENU_DEFINITIONS,
  type OwnedContextMenuId,
} from "~/domain/context-menu"
import type { ContextMenuPort } from "~/ports/context-menu-port"

export type ContextMenuUpdateProperties = {
  title?: string
  contexts?: chrome.contextMenus.ContextType[]
}

export type ContextMenusApi = {
  create(
    createProperties: chrome.contextMenus.CreateProperties,
  ): Promise<string | number>
  update(id: string | number, updateProperties: ContextMenuUpdateProperties): Promise<void>
  remove(menuItemId: string | number): Promise<void>
}

export function createChromeContextMenusApi(
  contextMenus: Pick<typeof chrome.contextMenus, "create" | "update" | "remove"> = chrome.contextMenus,
): ContextMenusApi {
  const readRuntimeError = (): Error | null => {
    const message = chrome.runtime.lastError?.message
    return message ? new Error(message) : null
  }

  const throwIfRuntimeError = (): void => {
    const error = readRuntimeError()
    if (error) {
      throw error
    }
  }

  return {
    async create(createProperties) {
      const result = await Promise.resolve(contextMenus.create(createProperties))
      throwIfRuntimeError()
      return result
    },
    async update(id, updateProperties) {
      await Promise.resolve(
        contextMenus.update(
          id,
          updateProperties as Parameters<typeof contextMenus.update>[1],
        ),
      )
      throwIfRuntimeError()
    },
    async remove(menuItemId) {
      await Promise.resolve(contextMenus.remove(menuItemId))
      throwIfRuntimeError()
    },
  }
}

function isDuplicateMenuError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return (
    message.includes("duplicate") ||
    message.includes("already exists") ||
    message.includes("cannot create item with duplicate id")
  )
}

function isMissingMenuError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return (
    message.includes("cannot find") ||
    message.includes("no item with id") ||
    message.includes("cannot find menu item")
  )
}

async function ensureOwnedMenu(
  contextMenus: ContextMenusApi,
  definition: (typeof OWNED_CONTEXT_MENU_DEFINITIONS)[number],
): Promise<void> {
  const contexts = [...definition.contexts] as chrome.contextMenus.ContextType[]
  try {
    await contextMenus.create({
      id: definition.id,
      title: definition.title,
      contexts,
    } as chrome.contextMenus.CreateProperties)
  } catch (error: unknown) {
    if (!isDuplicateMenuError(error)) {
      throw error
    }
    await contextMenus.update(definition.id, {
      title: definition.title,
      contexts,
    })
  }
}

async function removeOwnedMenu(
  contextMenus: ContextMenusApi,
  id: OwnedContextMenuId,
): Promise<void> {
  try {
    await contextMenus.remove(id)
  } catch (error: unknown) {
    if (!isMissingMenuError(error)) {
      throw error
    }
  }
}

export class ChromeContextMenuAdapter implements ContextMenuPort {
  constructor(private readonly contextMenus: ContextMenusApi = createChromeContextMenusApi()) {}

  async reconcile(enabled: boolean): Promise<void> {
    if (enabled) {
      for (const definition of OWNED_CONTEXT_MENU_DEFINITIONS) {
        await ensureOwnedMenu(this.contextMenus, definition)
      }
      return
    }

    for (const definition of OWNED_CONTEXT_MENU_DEFINITIONS) {
      await removeOwnedMenu(this.contextMenus, definition.id)
    }
  }
}
