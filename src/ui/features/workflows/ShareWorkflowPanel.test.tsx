import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { ShareWorkflowPanel } from "./ShareWorkflowPanel"
import type { ShareWorkflowPort } from "./workflow-ports"

function createPort(
  overrides: Partial<ShareWorkflowPort> = {}
): ShareWorkflowPort {
  return {
    confirmQrImport: vi.fn(),
    connectDrive: vi.fn(),
    exportBookmarks: vi.fn(),
    loadDriveState: vi
      .fn()
      .mockResolvedValue({
        accountEmail: null,
        conflictSummary: null,
        fileName: null,
        mode: null,
        status: "DISCONNECTED"
      }),
    loadSelection: vi.fn().mockResolvedValue([
      {
        bookmarkIds: ["a", "b"],
        id: "category",
        kind: "CATEGORY",
        label: "開発"
      },
      { bookmarkIds: ["b"], id: "tag", kind: "TAG", label: "React" }
    ]),
    readQr: vi.fn(),
    resolveDriveConflict: vi.fn(),
    ...overrides
  }
}

describe("ShareWorkflowPanel", () => {
  it("deduplicates a fixed selection and keeps it after QR capacity failure", async () => {
    const user = userEvent.setup()
    const exportBookmarks = vi
      .fn()
      .mockResolvedValue({ status: "QR_CAPACITY_EXCEEDED" })
    render(<ShareWorkflowPanel port={createPort({ exportBookmarks })} />)

    await user.click(screen.getByRole("button", { name: "QR／CSVで共有" }))
    await user.click(await screen.findByRole("checkbox", { name: /開発/ }))
    await user.click(screen.getByRole("checkbox", { name: /React/ }))
    expect(screen.getByText("重複を除いた選択: 2件")).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "QRコードを生成" }))

    await waitFor(() =>
      expect(exportBookmarks).toHaveBeenCalledWith(["a", "b"], "QR")
    )
    expect(screen.getByRole("alert").textContent).toContain(
      "容量を超えています"
    )
    expect(screen.getByText("重複を除いた選択: 2件")).not.toBeNull()
  })

  it("shows file fallback when camera access is denied", async () => {
    const user = userEvent.setup()
    const readQr = vi.fn().mockResolvedValue({ status: "CAMERA_DENIED" })
    render(<ShareWorkflowPanel port={createPort({ readQr })} />)

    await user.click(screen.getByRole("button", { name: "QRコードを読み取る" }))
    await user.click(screen.getByRole("button", { name: "カメラを使用" }))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "画像ファイル"
    )
    expect(screen.getByText("画像ファイルを選択")).not.toBeNull()
  })

  it("keeps appData sync distinct from shared Drive files", async () => {
    const user = userEvent.setup()
    const connectDrive = vi.fn().mockResolvedValue({
      accountEmail: "demo@example.com",
      conflictSummary: null,
      fileName: null,
      mode: "APP_DATA",
      status: "CONNECTED"
    })
    render(<ShareWorkflowPanel port={createPort({ connectDrive })} />)

    await user.click(screen.getByRole("button", { name: "Google Drive" }))
    await user.click(
      await screen.findByRole("button", { name: "端末同期へ接続" })
    )

    await waitFor(() => expect(connectDrive).toHaveBeenCalledWith("APP_DATA"))
    expect(screen.getByText(/端末同期（appDataFolder）/)).not.toBeNull()
    expect(screen.queryByText(/共有ファイル（/)).toBeNull()
  })
})
