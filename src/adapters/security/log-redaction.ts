import { isDomainError, toSafeMessage } from "~/domain"

const URL_PATTERN = /https?:\/\/[^\s]+/gi
const REDACTED = "[redacted]"

export function redactSensitiveText(text: string): string {
  return text.replace(URL_PATTERN, REDACTED)
}

export function safeLogError(scope: string, error: unknown): void {
  if (isDomainError(error)) {
    console.error(`[Bookmation] ${scope}:`, error.code, toSafeMessage(error.code))
    return
  }

  if (error instanceof Error) {
    console.error(`[Bookmation] ${scope}:`, redactSensitiveText(error.message))
    return
  }

  console.error(`[Bookmation] ${scope}: unexpected error`)
}

export function safeLogWarning(scope: string, detail: string): void {
  console.warn(`[Bookmation] ${scope}:`, redactSensitiveText(detail))
}

export function safeLogInfo(scope: string, detail: string): void {
  console.info(`[Bookmation] ${scope}:`, redactSensitiveText(detail))
}
