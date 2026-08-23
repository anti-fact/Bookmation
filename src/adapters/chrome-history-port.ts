import type { HistoryPort, HistoryVisitCandidate } from "~/ports/history-port"

type ChromeHistoryItem = Readonly<{
  lastVisitTime?: number
  title?: string
  url?: string
}>

type ChromeVisitItem = Readonly<{
  visitTime?: number
}>

type ChromeHistoryApi = Readonly<{
  search(query: { text: string; startTime: number; maxResults: number }): Promise<ChromeHistoryItem[]>
  getVisits(details: { url: string }): Promise<ChromeVisitItem[]>
}>

export function createChromeHistoryPort(history: ChromeHistoryApi): HistoryPort {
  return {
    async searchCandidatesSince(startTime: number): Promise<HistoryVisitCandidate[]> {
      const items = await history.search({
        text: "",
        startTime,
        maxResults: 5000,
      })
      const candidates: HistoryVisitCandidate[] = []
      for (const item of items) {
        if (
          typeof item.url !== "string" ||
          typeof item.lastVisitTime !== "number" ||
          item.lastVisitTime <= 0
        ) {
          continue
        }
        candidates.push({
          url: item.url,
          title: typeof item.title === "string" ? item.title : "",
          lastVisitTime: item.lastVisitTime,
        })
      }
      return candidates
    },

    async getVisitTimes(url: string): Promise<number[]> {
      const visits = await history.getVisits({ url })
      const times: number[] = []
      for (const visit of visits) {
        if (typeof visit.visitTime === "number" && visit.visitTime > 0) {
          times.push(visit.visitTime)
        }
      }
      return times
    },
  }
}
