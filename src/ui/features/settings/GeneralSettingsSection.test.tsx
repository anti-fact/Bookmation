import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import {
  DEFAULT_GENERAL_SETTINGS_SNAPSHOT,
  emptyGeneralSettingsPort,
  type GeneralSettingsPort
} from "./general-settings-port"
import { GeneralSettingsSection } from "./GeneralSettingsSection"

function createPort(
  overrides: Partial<GeneralSettingsPort> = {}
): GeneralSettingsPort {
  return {
    ...emptyGeneralSettingsPort,
    getSnapshot: vi.fn().mockResolvedValue(DEFAULT_GENERAL_SETTINGS_SNAPSHOT),
    ...overrides
  }
}

describe("GeneralSettingsSection", () => {
  it("shows the specified initial values and keeps visit days disabled without a window", async () => {
    render(<GeneralSettingsSection port={createPort()} />)

    const period = await screen.findByRole("combobox", {
      name: "訪問の集計期間"
    })
    expect(period.className).toContain("h-10")
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", {
        name: /リマインダー表示までの訪問日数/
      }).disabled
    ).toBe(true)
    const archiveDays = screen.getByRole<HTMLInputElement>("spinbutton", {
      name: /アーカイブ化の閾値/
    })
    expect(archiveDays.value).toBe("30")
    expect(archiveDays.className).toContain("h-10")
    expect(archiveDays.className).toContain("w-24")
    expect(
      screen
        .getByRole("slider", { name: "AIタグの細分化" })
        .getAttribute("aria-valuenow")
    ).toBe("2")
  })

  it("clears the visit-day value whenever the window changes", async () => {
    const user = userEvent.setup()
    const updateSettings = vi.fn().mockResolvedValue({
      ...DEFAULT_GENERAL_SETTINGS_SNAPSHOT,
      frequentVisitWindow: "LAST_7_DAYS"
    })
    render(<GeneralSettingsSection port={createPort({ updateSettings })} />)

    await user.click(
      await screen.findByRole("combobox", { name: "訪問の集計期間" })
    )
    await user.click(screen.getByRole("option", { name: "1週間" }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        frequentVisitDayThreshold: null,
        frequentVisitWindow: "LAST_7_DAYS"
      })
    })
    expect(
      screen
        .getByRole("spinbutton", {
          name: /リマインダー表示までの訪問日数/
        })
        .getAttribute("max")
    ).toBe("7")
  })

  it("moves the controlled granularity slider before saving the committed value", async () => {
    const user = userEvent.setup()
    const updateSettings = vi.fn(async (update) => ({
      ...DEFAULT_GENERAL_SETTINGS_SNAPSHOT,
      ...update
    }))
    render(<GeneralSettingsSection port={createPort({ updateSettings })} />)

    const slider = await screen.findByRole("slider", {
      name: "AIタグの細分化"
    })
    slider.focus()
    await user.keyboard("{ArrowRight}")

    expect(slider.getAttribute("aria-valuenow")).toBe("3")
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ aiGranularity: 3 })
    )
  })

  it("keeps auto archive off when history permission is denied", async () => {
    const user = userEvent.setup()
    const port = createPort({
      setAutoArchiveEnabled: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "履歴へのアクセスが許可されていないため、自動アーカイブを有効にできません。"
          )
        )
    })
    render(<GeneralSettingsSection port={port} />)

    const toggle = await screen.findByRole("switch", { name: "自動アーカイブ" })
    await user.click(toggle)

    expect((await screen.findByRole("alert")).textContent).toContain(
      "有効にできません"
    )
    expect(toggle.getAttribute("aria-checked")).toBe("false")
  })

  it("validates the archive day input before sending", async () => {
    const updateSettings = vi.fn()
    render(<GeneralSettingsSection port={createPort({ updateSettings })} />)

    const input = await screen.findByRole("spinbutton", {
      name: /アーカイブ化の閾値/
    })
    fireEvent.change(input, { target: { value: "0" } })
    fireEvent.blur(input)

    expect(screen.getByRole("alert").textContent).toContain("1以上の整数")
    expect(updateSettings).not.toHaveBeenCalled()
    expect((input as HTMLInputElement).value).toBe("30")
  })
})
