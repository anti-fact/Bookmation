/** テストで注入可能な時刻 Port。 */
export interface ClockPort {
  now(): number
}

export const systemClock: ClockPort = {
  now(): number {
    return Date.now()
  },
}
