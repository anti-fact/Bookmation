export type HistoryVisitCandidate = Readonly<{
  lastVisitTime: number
  title: string
  url: string
}>

export interface HistoryPort {
  searchCandidatesSince(startTime: number): Promise<HistoryVisitCandidate[]>
  getVisitTimes(url: string): Promise<number[]>
}
