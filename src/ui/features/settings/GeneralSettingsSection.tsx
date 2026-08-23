import * as React from "react"

import type { GeneralSettingsPort } from "./general-settings-port"
import { ContextMenuBookmarkSwitch } from "./ContextMenuBookmarkSwitch"
import { FrequentVisitReminderSettings } from "./FrequentVisitReminderSettings"

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
      <ul className="m-0 flex list-none flex-col gap-6 p-0">
        <li>
          <FrequentVisitReminderSettings port={port} />
        </li>
        <li>
          <ContextMenuBookmarkSwitch port={port} />
        </li>
      </ul>
    </div>
  )
}
