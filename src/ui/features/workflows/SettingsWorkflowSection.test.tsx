import { render, screen } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import { emptyChromeBookmarkImportPort } from "~/ui/features/settings/chrome-bookmark-import-port"

import { SettingsWorkflowSection } from "./SettingsWorkflowSection"
import {
  emptyBookmarkImportPort,
  emptyShareWorkflowPort
} from "./workflow-ports"

describe("SettingsWorkflowSection", () => {
  it("keeps both Chrome bookmark import paths in the share settings area", () => {
    render(
      <SettingsWorkflowSection
        bookmarkImportPort={emptyBookmarkImportPort}
        chromeBookmarkImportPort={emptyChromeBookmarkImportPort}
        onBookmarksImported={vi.fn()}
        shareWorkflowPort={emptyShareWorkflowPort}
      />
    )

    expect(
      screen.getByRole("heading", { name: "Chrome標準ブックマーク" })
    ).not.toBeNull()
    expect(
      screen.getByRole("group", {
        name: "Chrome ブックマークの取り込み"
      })
    ).not.toBeNull()
  })
})
