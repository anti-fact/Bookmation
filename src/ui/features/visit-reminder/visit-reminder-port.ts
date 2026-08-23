import type { PendingVisitReminderView } from "~/application/get-pending-visit-reminder"

export type VisitReminderResponse = "yes" | "no" | "dismissed"

export interface VisitReminderPort {
  getPending(): Promise<PendingVisitReminderView | null>
  respond(input: {
    reminderId: string
    response: VisitReminderResponse
    suppressFuture?: boolean
  }): Promise<void>
}

export const emptyVisitReminderPort: VisitReminderPort = {
  async getPending() {
    return null
  },
  async respond() {
    return undefined
  },
}
