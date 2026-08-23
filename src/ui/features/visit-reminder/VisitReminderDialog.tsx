import * as React from "react"

import type { PendingVisitReminderView } from "~/application/get-pending-visit-reminder"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "~/ui/primitives"

import type { VisitReminderPort } from "./visit-reminder-port"

export function VisitReminderDialog({
  open,
  pending,
  port,
  onClose,
  onSaved
}: {
  open: boolean
  pending: PendingVisitReminderView | null
  port: VisitReminderPort
  onClose: () => void
  onSaved?: () => void
}) {
  const [suppressFuture, setSuppressFuture] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const respondedRef = React.useRef(false)

  React.useEffect(() => {
    if (open) {
      respondedRef.current = false
      setSuppressFuture(false)
      setError(null)
    }
  }, [open, pending?.reminderId])

  const handleResponse = async (response: "yes" | "no") => {
    if (!pending) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await port.respond({
        reminderId: pending.reminderId,
        response,
        suppressFuture: suppressFuture,
      })
      respondedRef.current = true
      if (response === "yes") {
        onSaved?.()
      }
      onClose()
    } catch (respondError: unknown) {
      setError(
        respondError instanceof Error
          ? respondError.message
          : "リマインダーへの応答に失敗しました。"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async () => {
    if (!pending || respondedRef.current || submitting) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      await port.respond({
        reminderId: pending.reminderId,
        response: "dismissed",
        suppressFuture: suppressFuture,
      })
      respondedRef.current = true
    } catch {
      // 閉じる操作自体は妨げない
    } finally {
      setSubmitting(false)
      onClose()
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void handleDismiss()
        }
      }}
      open={open}
    >
      <DialogContent closeLabel="訪問リマインダーを閉じる">
        <DialogHeader>
          <DialogTitle>よく訪問しているページを保存しますか？</DialogTitle>
          <DialogDescription>
            {pending
              ? `${pending.title}（訪問日数: ${pending.visitDays}日）`
              : "候補を読み込んでいます。"}
          </DialogDescription>
        </DialogHeader>
        {pending ? (
          <div className="space-y-4">
            <p className="m-0 break-all text-sm text-bm-muted-text">{pending.normalizedUrl}</p>
            <label className="flex items-center gap-2 text-sm text-bm-ink">
              <input
                checked={suppressFuture}
                disabled={submitting}
                onChange={(event) => setSuppressFuture(event.target.checked)}
                type="checkbox"
              />
              次回から表示しない
            </label>
            {error ? (
              <p className="m-0 text-sm text-bm-danger" role="alert">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                disabled={submitting}
                onClick={() => {
                  void handleResponse("no")
                }}
                variant="outline"
              >
                いいえ
              </Button>
              <Button
                disabled={submitting}
                onClick={() => {
                  void handleResponse("yes")
                }}
              >
                はい
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
