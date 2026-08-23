import { BookmarkFormPortError } from "~/ui/features/bookmarks/bookmark-form-port"

/** message-router が許可する requestId 用に preset ID の `.` を置き換えます。 */
export function toOnboardingRequestToken(presetId: string): string {
  return presetId.replaceAll(".", "_")
}

export class OnboardingPortError extends Error {
  constructor(
    readonly code:
      | "ONBOARDING_CATEGORY_UNKNOWN"
      | "ONBOARDING_TAG_UNKNOWN"
      | "ONBOARDING_TAG_CONFLICT"
  ) {
    super(code)
    this.name = "OnboardingPortError"
  }
}

export function getOnboardingErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message.includes("Extension context invalidated")
  ) {
    return "拡張機能を更新したため、このタブを再読み込みしてください。"
  }

  if (error instanceof OnboardingPortError) {
    switch (error.code) {
      case "ONBOARDING_TAG_CONFLICT":
        return "同じ名前のタグが別カテゴリにあります。名前を変えるか、既存のタグを使ってください。"
      case "ONBOARDING_CATEGORY_UNKNOWN":
      case "ONBOARDING_TAG_UNKNOWN":
        return "候補が更新されたため、選び直してから保存してください。"
    }
  }

  if (error instanceof BookmarkFormPortError) {
    return "カテゴリとタグを保存できませんでした。ページを再読み込みしてからもう一度お試しください。"
  }

  return "設定を保存できませんでした。選択内容を確認して再試行してください。"
}
