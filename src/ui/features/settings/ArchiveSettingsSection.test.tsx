import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { ArchiveSettingsSection } from "./ArchiveSettingsSection"

const archived = [
  {
    categories: ["開発"],
    id: "a",
    tags: ["React"],
    title: "Alpha",
    url: "https://a.example/"
  },
  {
    categories: ["仕事"],
    id: "b",
    tags: [],
    title: "Beta",
    url: "https://b.example/"
  }
]

describe("ArchiveSettingsSection", () => {
  it("keeps only failed items selected after a partial restore", async () => {
    const user = userEvent.setup()
    const restore = vi.fn().mockResolvedValue({
      failures: [{ id: "b", reason: "タグが削除されています。" }],
      restoredIds: ["a"],
      snapshot: { archived: [archived[1]], historyIssues: [] }
    })
    render(
      <ArchiveSettingsSection
        port={{
          load: vi.fn().mockResolvedValue({ archived, historyIssues: [] }),
          restore
        }}
      />
    )

    const archiveList = await screen.findByRole("list", {
      name: "アーカイブ済みブックマーク一覧"
    })
    expect(archiveList.className).toContain("max-h-96")
    expect(archiveList.className).toContain("overflow-y-auto")
    expect(archiveList.className).toContain("border-2")
    expect(archiveList.className).toContain("border-bm-border")
    expect(archiveList.className).toContain("p-2")
    expect(archiveList.getAttribute("tabindex")).toBe("0")
    expect(screen.getByText("Alpha").closest("li")?.className).toContain("py-2")

    await user.click(screen.getByRole("checkbox", { name: "すべて選択" }))
    await user.click(screen.getByRole("button", { name: "選択項目を復元" }))

    await waitFor(() => expect(restore).toHaveBeenCalledWith(["a", "b"]))
    expect(screen.queryByText("Alpha")).toBeNull()
    expect(screen.getByText("Beta")).not.toBeNull()
    expect(screen.getByRole("alert").textContent).toContain(
      "タグが削除されています"
    )
  })

  it("shows history-not-found separately from archived records", async () => {
    render(
      <ArchiveSettingsSection
        port={{
          load: vi.fn().mockResolvedValue({
            archived: [],
            historyIssues: [
              {
                code: "ARCHIVE_HISTORY_NOT_FOUND",
                id: "x",
                title: "No history",
                url: "https://x.example/"
              }
            ]
          }),
          restore: vi.fn()
        }}
      />
    )

    expect(
      await screen.findByText("履歴がないためアーカイブできません")
    ).not.toBeNull()
    expect(
      screen.getByText("アーカイブ済みのブックマークはありません。")
    ).not.toBeNull()
  })
})
