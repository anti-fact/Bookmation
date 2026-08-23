import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("manifest security", () => {
  it("declares only the expected MVP permissions", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as {
      manifest: {
        permissions: string[]
        host_permissions: string[]
        commands: Record<string, unknown>
      }
    }

    expect(packageJson.manifest.permissions).toEqual([
      "storage",
      "activeTab",
      "contextMenus",
      "history",
      "alarms",
    ])
    expect(packageJson.manifest.host_permissions).toEqual([
      "https://*/*",
      "http://*/*",
    ])
    expect(Object.keys(packageJson.manifest.commands).sort()).toEqual([
      "open-bookmation-home",
      "save-current-page",
    ])
  })
})
