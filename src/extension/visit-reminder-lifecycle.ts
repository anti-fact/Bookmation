import { evaluateVisitReminders } from "~/application/evaluate-visit-reminders"
import { createChromeHistoryPort } from "~/adapters/chrome-history-port"
import { ChromeLocalSettingsStore } from "~/adapters/chrome-local-settings-store"
import { safeLogError } from "~/adapters/security/log-redaction"

export const VISIT_REMINDER_ALARM_NAME = "bookmation.evaluate-visit-reminders"

type VisitReminderChromeApi = Readonly<{
  alarms: Pick<typeof chrome.alarms, "create" | "onAlarm">
  history: typeof chrome.history
}>

export function registerVisitReminderLifecycle(chromeApi: VisitReminderChromeApi): void {
  void chromeApi.alarms.create(VISIT_REMINDER_ALARM_NAME, { periodInMinutes: 60 })

  chromeApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== VISIT_REMINDER_ALARM_NAME) {
      return
    }
    void evaluateVisitReminders({
      settingsStore: new ChromeLocalSettingsStore(),
      history: createChromeHistoryPort(chromeApi.history),
    }).catch((error: unknown) => {
      safeLogError("Visit reminder evaluation", error)
    })
  })
}
