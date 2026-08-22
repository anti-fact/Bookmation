import { buildDashboardUrl, DASHBOARD_ENTRY } from "~extension/paths"
import { Button } from "~ui/primitives"

import "./style.css"

function openDashboard() {
  void chrome.tabs.create({
    url: buildDashboardUrl(chrome.runtime.getURL(DASHBOARD_ENTRY))
  })
}

function IndexPopup() {
  return (
    <main className="min-w-[20rem] bg-bm-paper p-4 text-bm-ink">
      <h1 className="text-sm font-semibold">Bookmation</h1>
      <p className="mt-2 text-xs text-bm-muted-text">
        TASK-002 bootstrap: popup、dashboard、Service Worker
        を分離しました。
      </p>
      <ul className="mt-3 space-y-1 text-[11px] text-bm-control-muted">
        <li>popup — この画面</li>
        <li>dashboard — 空のホーム tab</li>
        <li>commands — save-current-page / open-bookmation-home</li>
      </ul>
      <p className="mt-3 text-[11px] text-bm-control-muted">
        保存とホームの2ボタン、ショートカット表示は TASK-004 で実装します。
      </p>
      <div className="mt-4">
        <Button size="compact" type="button" onClick={openDashboard}>
          Dashboard を開く
        </Button>
      </div>
    </main>
  )
}

export default IndexPopup
