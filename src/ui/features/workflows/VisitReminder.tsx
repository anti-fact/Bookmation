import * as React from "react"

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "~/ui/primitives"

import type {
  VisitReminderCandidate,
  VisitReminderPort
} from "./workflow-ports"

export function VisitReminder({ port }: { port: VisitReminderPort }) {
  const [candidate, setCandidate] =
    React.useState<VisitReminderCandidate | null>(null)
  const [suppress, setSuppress] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    void port.loadCandidate().then((next) => {
      if (active) setCandidate(next)
    })
    return () => {
      active = false
    }
  }, [port])

  const answer = async (action: "SAVE" | "DISMISS") => {
    if (!candidate || pending) return
    setPending(true)
    setError(null)
    try {
      if (action === "SAVE") await port.save(candidate.id)
      else await port.dismiss(candidate.id, suppress)
      setCandidate(null)
      setSuppress(false)
    } catch (answerError: unknown) {
      setError(
        answerError instanceof Error
          ? answerError.message
          : "回答を保存できませんでした。"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={candidate !== null}>
      <DialogContent
        aria-label="訪問リマインダー"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        showClose={false}
      >
        {candidate ? (
          <>
            <DialogHeader>
              <DialogTitle>このページをブックマークしますか？</DialogTitle>
              <DialogDescription>
                {candidate.windowLabel}のうち{candidate.visitedDayCount}
                日訪問しています。
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-bm-field border-2 border-bm-border p-4">
              <p className="m-0 font-semibold text-bm-ink">{candidate.title}</p>
              <p className="mb-0 mt-2 break-all text-sm text-bm-muted-text">
                {candidate.url}
              </p>
            </div>
            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={suppress}
                onCheckedChange={(checked) => setSuppress(checked === true)}
              />
              <span>次回から表示しない</span>
            </label>
            {error ? (
              <p className="mt-4 text-sm text-bm-danger" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() => void answer("DISMISS")}
                variant="outline"
              >
                いいえ
              </Button>
              <Button
                disabled={pending}
                loading={pending}
                onClick={() => void answer("SAVE")}
                variant="solid"
              >
                はい、保存する
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
