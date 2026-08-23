import { describe, expect, it } from "vitest"

import {
  CONTEXT_MENU_BOOKMARK_LINK_ID,
  CONTEXT_MENU_BOOKMARK_PAGE_ID,
  isOwnedContextMenuId,
} from "./context-menu"

describe("context-menu domain", () => {
  it("recognizes owned menu IDs", () => {
    expect(isOwnedContextMenuId(CONTEXT_MENU_BOOKMARK_PAGE_ID)).toBe(true)
    expect(isOwnedContextMenuId(CONTEXT_MENU_BOOKMARK_LINK_ID)).toBe(true)
    expect(isOwnedContextMenuId("unknown")).toBe(false)
    expect(isOwnedContextMenuId(1)).toBe(false)
  })
})
