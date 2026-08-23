import * as React from "react"

import { EXTENSION_COMMANDS } from "~/extension/commands"
import {
  PopupView,
  type PopupSaveState,
  type PopupShortcutsState
} from "~/ui/features/popup/PopupApp"
import type { PopupShortcuts } from "~/ui/features/popup/popup-port"

const fixtures = [
  "assigned",
  "unassigned",
  "loading",
  "success",
  "duplicate",
  "error",
  "shortcut-error"
] as const

type PopupFixtureName = (typeof fixtures)[number]

const assignedShortcuts: PopupShortcuts = {
  [EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME]: "Ctrl+Shift+H",
  [EXTENSION_COMMANDS.SAVE_CURRENT_PAGE]: "Ctrl+Shift+S"
}

const unassignedShortcuts: PopupShortcuts = {
  [EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME]: null,
  [EXTENSION_COMMANDS.SAVE_CURRENT_PAGE]: null
}

function isPopupFixtureName(value: string | null): value is PopupFixtureName {
  return fixtures.some((fixture) => fixture === value)
}

function getInitialSaveState(fixture: PopupFixtureName): PopupSaveState {
  switch (fixture) {
    case "loading":
      return "saving"
    case "success":
      return "saved"
    case "duplicate":
      return "duplicate"
    case "error":
      return "error"
    default:
      return "idle"
  }
}

function getSaveOutcome(fixture: PopupFixtureName): PopupSaveState {
  switch (fixture) {
    case "duplicate":
      return "duplicate"
    case "error":
      return "error"
    case "loading":
      return "saving"
    default:
      return "saved"
  }
}

export function PopupFixture() {
  const fixtureQuery = new URLSearchParams(window.location.search).get(
    "fixture"
  )
  const fixture = isPopupFixtureName(fixtureQuery) ? fixtureQuery : "assigned"
  const [saveState, setSaveState] = React.useState<PopupSaveState>(() =>
    getInitialSaveState(fixture)
  )
  const timerRef = React.useRef<number | null>(null)
  const shortcutsState: PopupShortcutsState =
    fixture === "shortcut-error" ? "error" : "ready"
  const shortcuts =
    fixture === "unassigned" || fixture === "shortcut-error"
      ? unassignedShortcuts
      : assignedShortcuts

  React.useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    },
    []
  )

  const handleSave = () => {
    setSaveState("saving")
    if (fixture === "loading") return

    timerRef.current = window.setTimeout(() => {
      setSaveState(getSaveOutcome(fixture))
    }, 350)
  }

  return (
    <div className="min-h-dvh bg-bm-accent p-4 text-bm-ink sm:p-8">
      <header className="mx-auto mb-5 flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-4 text-xs shadow-bm-header">
        <div>
          <p className="m-0 font-bold uppercase tracking-[0.12em]">
            Test preview / UI-03
          </p>
          <p className="mb-0 mt-1 text-bm-muted-text">fixture: {fixture}</p>
        </div>
        <nav aria-label="Popup fixture切替" className="flex flex-wrap gap-2">
          {fixtures.map((name) => (
            <a
              aria-current={fixture === name ? "page" : undefined}
              className="rounded-bm-field border border-bm-border bg-bm-paper px-2 py-1 text-bm-ink no-underline outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus aria-[current=page]:bg-bm-ink aria-[current=page]:text-bm-paper"
              href={`?view=popup&fixture=${name}`}
              key={name}
            >
              {name}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto w-fit max-w-full shadow-bm-floating">
        <PopupView
          onChangeShortcuts={() => undefined}
          onOpenHome={() => undefined}
          onSave={handleSave}
          saveState={saveState}
          shortcuts={shortcuts}
          shortcutsState={shortcutsState}
        />
      </div>
    </div>
  )
}
