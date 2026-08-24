export type VisitReminderCandidate = Readonly<{
  id: string
  title: string
  url: string
  visitedDayCount: number
  windowLabel: string
}>

export interface VisitReminderPort {
  loadCandidate(): Promise<VisitReminderCandidate | null>
  save(candidateId: string): Promise<void>
  dismiss(candidateId: string, suppress: boolean): Promise<void>
}

function unavailable(): never {
  throw new Error("この機能は現在利用できません。")
}

export const emptyVisitReminderPort: VisitReminderPort = {
  loadCandidate: async () => null,
  save: async () => unavailable(),
  dismiss: async () => unavailable()
}
