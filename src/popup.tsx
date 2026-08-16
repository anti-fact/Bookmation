import { designTokens } from "~ui/tokens"

import "./style.css"

function IndexPopup() {
  return (
    <main className="min-w-[20rem] bg-surface p-4 text-ink">
      <h1 className="text-sm font-semibold">Bookmation</h1>
      <p className="mt-2 text-xs text-subtle">
        開発基盤の確認用画面です。保存とホーム操作は TASK-002 で実装します。
      </p>
      <p className="mt-3 text-[11px] text-muted">
        surface {designTokens.color.surface}
      </p>
    </main>
  )
}

export default IndexPopup
