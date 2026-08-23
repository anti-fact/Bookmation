import { describe, expect, it } from "vitest"

import {
  countDistinctVisitDays,
  localCalendarDayKey,
  windowStartMs,
} from "./visit-reminder"

describe("visit-reminder", () => {
  it("counts distinct local calendar days within the window after reset", () => {
    const windowStart = windowStartMs("LAST_7_DAYS", Date.UTC(2026, 7, 23, 12))
    const dayOneMorning = Date.UTC(2026, 7, 20, 9)
    const dayOneEvening = Date.UTC(2026, 7, 20, 21)
    const dayTwo = Date.UTC(2026, 7, 21, 10)

    expect(
      countDistinctVisitDays(
        [dayOneMorning, dayOneEvening, dayTwo],
        windowStart,
        null,
      ),
    ).toBe(2)
  })

  it("excludes visits before countingResetAt", () => {
    const windowStart = windowStartMs("LAST_7_DAYS", Date.UTC(2026, 7, 23, 12))
    const beforeReset = Date.UTC(2026, 7, 22, 8)
    const afterReset = Date.UTC(2026, 7, 22, 18)

    expect(
      countDistinctVisitDays([beforeReset, afterReset], windowStart, afterReset - 1),
    ).toBe(1)
  })

  it("groups visits on the same local calendar day", () => {
    const evening = new Date(2026, 7, 20, 23, 0, 0, 0).getTime()
    const morning = new Date(2026, 7, 20, 1, 0, 0, 0).getTime()
    expect(localCalendarDayKey(evening)).toBe(localCalendarDayKey(morning))
  })
})
