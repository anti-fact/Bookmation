import { describe, expect, it } from "vitest"

import {
  EXTENSION_COMMANDS,
  EXTENSION_COMMAND_ALLOWLIST,
  isExtensionCommand
} from "./commands"

describe("extension commands", () => {
  it("matches manifest command names", () => {
    expect(EXTENSION_COMMANDS.SAVE_CURRENT_PAGE).toBe("save-current-page")
    expect(EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME).toBe(
      "open-bookmation-home"
    )
  })

  it("allowlists only declared commands", () => {
    expect(EXTENSION_COMMAND_ALLOWLIST).toEqual([
      "save-current-page",
      "open-bookmation-home"
    ])
  })

  it("rejects unknown command names", () => {
    expect(isExtensionCommand("save-current-page")).toBe(true)
    expect(isExtensionCommand("open-bookmation-home")).toBe(true)
    expect(isExtensionCommand("unknown-command")).toBe(false)
  })
})
