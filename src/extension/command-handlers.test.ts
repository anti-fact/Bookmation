import { describe, expect, it, vi } from "vitest"

import { handleExtensionCommand } from "./command-handlers"
import { EXTENSION_COMMANDS } from "./commands"
import { DASHBOARD_ENTRY, DASHBOARD_HOME_ROUTE } from "./paths"

describe("handleExtensionCommand", () => {
  it("opens the dashboard tab for open-bookmation-home", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const getURL = vi
      .fn()
      .mockReturnValue("chrome-extension://test-id/tabs/index.html")

    await handleExtensionCommand(
      EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME,
      { getURL },
      { create }
    )

    expect(getURL).toHaveBeenCalledWith(DASHBOARD_ENTRY)
    expect(create).toHaveBeenCalledWith({
      url: `chrome-extension://test-id/tabs/index.html${DASHBOARD_HOME_ROUTE}`
    })
  })

  it("does nothing for save-current-page until TASK-004", async () => {
    const create = vi.fn()
    const getURL = vi.fn()

    await handleExtensionCommand(
      EXTENSION_COMMANDS.SAVE_CURRENT_PAGE,
      { getURL },
      { create }
    )

    expect(create).not.toHaveBeenCalled()
    expect(getURL).not.toHaveBeenCalled()
  })
})
