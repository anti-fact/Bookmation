import { describe, expect, it, vi } from "vitest"

import { INSTALL_STATE_KEY, initializeOnInstall } from "./install-handler"

describe("initializeOnInstall", () => {
  it("initializes and opens welcome only for a first install", async () => {
    const get = vi.fn().mockResolvedValue({})
    const set = vi.fn().mockResolvedValue(undefined)
    const getURL = vi.fn().mockReturnValue("chrome-extension://test/tabs/index.html")
    const create = vi.fn().mockResolvedValue(undefined)

    await initializeOnInstall("install", { get, set }, { getURL }, { create })

    expect(get).toHaveBeenCalledWith(INSTALL_STATE_KEY)
    expect(set).toHaveBeenCalledWith({
      [INSTALL_STATE_KEY]: expect.objectContaining({ schemaVersion: 1 }),
    })
    expect(create).toHaveBeenCalledWith({
      url: "chrome-extension://test/tabs/index.html#/welcome",
    })
  })

  it("does not overwrite state for update or a repeated install signal", async () => {
    const get = vi.fn().mockResolvedValue({
      [INSTALL_STATE_KEY]: { schemaVersion: 1, initializedAt: 1 },
    })
    const set = vi.fn()
    const getURL = vi.fn()
    const create = vi.fn()

    await initializeOnInstall("update", { get, set }, { getURL }, { create })
    await initializeOnInstall("install", { get, set }, { getURL }, { create })

    expect(set).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
