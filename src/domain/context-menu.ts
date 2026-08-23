export const CONTEXT_MENU_BOOKMARK_PAGE_ID = "bookmation-save-page" as const
export const CONTEXT_MENU_BOOKMARK_LINK_ID = "bookmation-save-link" as const

export const CONTEXT_MENU_BOOKMARK_PAGE_TITLE = "このページをBookmationに保存"
export const CONTEXT_MENU_BOOKMARK_LINK_TITLE = "リンクをBookmationに保存"

export type OwnedContextMenuId =
  | typeof CONTEXT_MENU_BOOKMARK_PAGE_ID
  | typeof CONTEXT_MENU_BOOKMARK_LINK_ID

export const OWNED_CONTEXT_MENU_DEFINITIONS = [
  {
    id: CONTEXT_MENU_BOOKMARK_PAGE_ID,
    title: CONTEXT_MENU_BOOKMARK_PAGE_TITLE,
    contexts: ["page"] as const,
  },
  {
    id: CONTEXT_MENU_BOOKMARK_LINK_ID,
    title: CONTEXT_MENU_BOOKMARK_LINK_TITLE,
    contexts: ["link"] as const,
  },
] as const

const OWNED_CONTEXT_MENU_IDS = new Set<string>(
  OWNED_CONTEXT_MENU_DEFINITIONS.map((definition) => definition.id),
)

export function isOwnedContextMenuId(id: string | number): id is OwnedContextMenuId {
  return typeof id === "string" && OWNED_CONTEXT_MENU_IDS.has(id)
}

export function isContextMenuPageId(id: string | number): boolean {
  return id === CONTEXT_MENU_BOOKMARK_PAGE_ID
}

export function isContextMenuLinkId(id: string | number): boolean {
  return id === CONTEXT_MENU_BOOKMARK_LINK_ID
}
