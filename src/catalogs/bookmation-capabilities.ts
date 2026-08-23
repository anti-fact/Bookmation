export const BOOKMATION_CAPABILITY_CATALOG_VERSION = 1

export const bookmationCapabilities = [
  {
    keywords: ["保存", "ブックマーク", "追加"],
    status: "実装済み",
    summary:
      "現在のページまたはURLを保存し、タグを選んで整理できます。保存操作はポップアップまたはメイン画面の追加ボタンから行います。"
  },
  {
    keywords: ["カテゴリ", "タグ", "分類"],
    status: "実装済み",
    summary:
      "カテゴリとタグの一覧・作成・編集・削除を管理画面から行えます。タグは1つの親カテゴリに属します。"
  },
  {
    keywords: ["検索", "探す"],
    status: "実装済み",
    summary:
      "カテゴリ、タグ、ブックマークをキーワードまたはAIアシスタントから検索できます。"
  },
  {
    keywords: ["設定", "右クリック"],
    status: "一部実装済み",
    summary:
      "一般設定と右クリック保存を利用できます。未実装の設定項目は画面上で区別して案内します。"
  },
  {
    keywords: ["アーカイブ", "復元", "履歴権限"],
    status: "未実装",
    summary:
      "自動アーカイブ、履歴権限の要求、アーカイブからの復元は現在開発中です。"
  },
  {
    keywords: ["共有", "QR", "CSV", "Drive", "インポート"],
    status: "未実装",
    summary: "QR、CSV、Google Driveによる共有とインポートは現在開発中です。"
  }
] as const

export function getStaticCapabilityAnswer(input: string) {
  const found = bookmationCapabilities.find((capability) =>
    capability.keywords.some((keyword) => input.includes(keyword))
  )
  return found
    ? `${found.status}: ${found.summary}`
    : "Bookmationでは、ブックマーク保存、カテゴリ・タグ整理、検索、設定を扱えます。詳しい操作を知りたい機能名を入力してください。"
}
