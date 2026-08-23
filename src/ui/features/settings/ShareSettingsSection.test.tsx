import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { ShareSettingsSection } from "./ShareSettingsSection"

describe("ShareSettingsSection", () => {
  it("deduplicates bookmark ids and preserves selection when QR capacity is exceeded", async () => {
    const user = userEvent.setup()
    const exportBookmarks = vi
      .fn()
      .mockResolvedValue({ status: "QR_CAPACITY_EXCEEDED" })
    render(
      <ShareSettingsSection
        port={{
          connectDrive: vi.fn(),
          exportBookmarks,
          load: vi.fn().mockResolvedValue({
            drive: null,
            items: [
              {
                bookmarkIds: ["a", "b"],
                id: "category",
                kind: "CATEGORY",
                label: "開発"
              },
              { bookmarkIds: ["b"], id: "tag", kind: "TAG", label: "React" }
            ]
          }),
          openQrReader: vi.fn()
        }}
      />
    )

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
})
