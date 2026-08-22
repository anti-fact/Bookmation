import { describe, expect, it, vi } from "vitest"

import { handleExtensionCommand } from "./command-handlers"
import { EXTENSION_COMMANDS } from "./commands"
import { DASHBOARD_ENTRY, DASHBOARD_HOME_ROUTE } from "./paths"

vi.mock("./message-handler", () => ({
  saveCurrentTabFromCommand: vi.fn().mockResolvedValue(undefined),
}))

describe("handleExtensionCommand", () => {
  it("focuses an existing home tab when open-bookmation-home is invoked", async () => {
    const create = vi.fn()
    const update = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([
      {
        id: 42,
        windowId: 7,
        url: "chrome-extension://test-id/tabs/index.html#/home",
      },
    ])
    const getURL = vi
      .fn()
      .mockReturnValue("chrome-extension://test-id/tabs/index.html")
    const windowsUpdate = vi.fn().mockResolvedValue(undefined)

    await handleExtensionCommand(
      EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME,
      { getURL },
      { create, update, query },
      { update: windowsUpdate },
    )

    expect(query).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(42, { active: true })
    expect(windowsUpdate).toHaveBeenCalledWith(7, { focused: true })
    expect(create).not.toHaveBeenCalled()
  })

  it("creates a home tab when none exists", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const update = vi.fn()
    const query = vi.fn().mockResolvedValue([])
    const getURL = vi
      .fn()
      .mockReturnValue("chrome-extension://test-id/tabs/index.html")

    await handleExtensionCommand(
      EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME,
      { getURL },
      { create, update, query },
      { update: vi.fn() },
    )

    expect(getURL).toHaveBeenCalledWith(DASHBOARD_ENTRY)
    expect(create).toHaveBeenCalledWith({
      url: `chrome-extension://test-id/tabs/index.html${DASHBOARD_HOME_ROUTE}`,
    })
  })

  it("saves the current page for save-current-page", async () => {
    const { saveCurrentTabFromCommand } = await import("./message-handler")

    await handleExtensionCommand(
      EXTENSION_COMMANDS.SAVE_CURRENT_PAGE,
      { getURL: vi.fn() },
      { create: vi.fn(), update: vi.fn(), query: vi.fn() },
      { update: vi.fn() },
    )

    expect(saveCurrentTabFromCommand).toHaveBeenCalled()
  })
})
