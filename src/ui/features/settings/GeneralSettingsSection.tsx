import * as React from "react"

import type { GeneralSettingsPort } from "./general-settings-port"
import { ContextMenuBookmarkSwitch } from "./ContextMenuBookmarkSwitch"

export function GeneralSettingsSection({
  port
}: {
  port: GeneralSettingsPort
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-bm-ink">一般設定</h3>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li>
          <ContextMenuBookmarkSwitch port={port} />
        </li>
      </ul>
    </div>
  )
}
