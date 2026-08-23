import * as React from "react"

import { Button, Checkbox } from "~/ui/primitives"

import type {
  ArchiveRestoreFailure,
  ArchiveSettingsPort,
  ArchiveSettingsSnapshot
} from "./archive-settings-port"

function LabeledCheckbox({
  checked,
  label,
  onCheckedChange
}: {
  checked: boolean
  label: string
  onCheckedChange: (checked: boolean | "indeterminate") => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-bm-ink">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span>{label}</span>
    </label>
  )
}

export function ArchiveSettingsSection({
  port
}: {
  port: ArchiveSettingsPort
}) {
  const [snapshot, setSnapshot] =
    React.useState<ArchiveSettingsSnapshot | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [failures, setFailures] = React.useState<
    readonly ArchiveRestoreFailure[]
  >([])
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void port.load().then(
      (next) => active && setSnapshot(next),
      (loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "アーカイブを読み込めませんでした。"
          )
        }
      }
    )
    return () => {
      active = false
    }
  }, [port])

  if (!snapshot) {
    return (
      <div aria-busy={!error} className="space-y-2">
        <h3 className="m-0 text-lg font-semibold text-bm-ink">
          アーカイブ管理
        </h3>
        <p
          className="m-0 text-sm text-bm-muted-text"
          role={error ? "alert" : undefined}
        >
          {error ?? "アーカイブを読み込んでいます。"}
        </p>
      </div>
    )
  }

  const allSelected =
    snapshot.archived.length > 0 &&
    selectedIds.size === snapshot.archived.length

  return (
    <div className="space-y-6">
      <div>
        <h3 className="m-0 text-lg font-semibold text-bm-ink">
          アーカイブ管理
        </h3>
        <p className="mt-1 text-sm text-bm-muted-text">
          アーカイブ済みブックマークを選択して復元できます。
        </p>
      </div>

      {snapshot.historyIssues.length > 0 ? (
        <section
          aria-labelledby="archive-history-issues"
          className="rounded-bm-field border-2 border-bm-danger p-4"
        >
          <h4
            className="m-0 font-semibold text-bm-danger"
            id="archive-history-issues"
          >
            アーカイブできなかった項目
          </h4>
          <ul className="mb-0 mt-3 space-y-3 pl-5">
            {snapshot.historyIssues.map((issue) => (
              <li key={issue.id}>
                <p className="m-0 font-medium text-bm-ink">{issue.title}</p>
                <p className="m-0 break-all text-xs text-bm-muted-text">
                  {issue.url}
                </p>
                <p className="m-0 text-sm text-bm-danger">
                  履歴がないためアーカイブできません
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {snapshot.archived.length === 0 ? (
        <p className="rounded-bm-field bg-bm-accent p-4 text-sm text-bm-ink">
          アーカイブ済みのブックマークはありません。
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LabeledCheckbox
              checked={allSelected}
              label="すべて選択"
              onCheckedChange={(checked) => {
                setSelectedIds(
                  checked === true
                    ? new Set(snapshot.archived.map((item) => item.id))
                    : new Set()
                )
              }}
            />
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                選択: {selectedIds.size}件
              </span>
              <Button
                disabled={pending || selectedIds.size === 0}
                onClick={async () => {
                  setPending(true)
                  setError(null)
                  try {
                    const result = await port.restore([...selectedIds])
                    setSnapshot(result.snapshot)
                    setFailures(result.failures)
                    setSelectedIds(
                      new Set(result.failures.map((failure) => failure.id))
                    )
                  } catch (restoreError: unknown) {
                    setError(
                      restoreError instanceof Error
                        ? restoreError.message
                        : "ブックマークを復元できませんでした。"
                    )
                  } finally {
                    setPending(false)
                  }
                }}
              >
                {pending ? "復元中…" : "選択項目を復元"}
              </Button>
            </div>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0">
            {snapshot.archived.map((item) => (
              <li
                className="rounded-bm-field border-2 border-bm-border p-4"
                key={item.id}
              >
                <LabeledCheckbox
                  checked={selectedIds.has(item.id)}
                  label={item.title}
                  onCheckedChange={(checked) => {
                    setSelectedIds((current) => {
                      const next = new Set(current)
                      if (checked === true) next.add(item.id)
                      else next.delete(item.id)
                      return next
                    })
                  }}
                />
                <p className="mb-0 mt-2 break-all text-xs text-bm-muted-text">
                  {item.url}
                </p>
                <p className="mb-0 mt-2 text-xs text-bm-muted-text">
                  カテゴリ: {item.categories.join("、") || "なし"} / タグ:{" "}
                  {item.tags.join("、") || "なし"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {failures.length > 0 ? (
        <div
          className="rounded-bm-field border-2 border-bm-danger p-4"
          role="alert"
        >
          <p className="m-0 font-semibold text-bm-danger">
            一部の項目を復元できませんでした。
          </p>
          <ul className="mb-0 mt-2 pl-5 text-sm">
            {failures.map((failure) => (
              <li key={failure.id}>{failure.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p className="m-0 text-sm text-bm-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
