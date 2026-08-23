/**
 * フロントの Category／Tag 作成 UI が揃うまでの分類 Host 検証用ラベル木。
 * 本番 onboarding catalog（ISSUE-022）とは別物。
 */
export type DevClassificationTagSpec = Readonly<{
  /** creationRequestId 用の ASCII slug */
  slug: string
  name: string
}>

export type DevClassificationCategorySpec = Readonly<{
  slug: string
  name: string
  tags: readonly DevClassificationTagSpec[]
}>

export const DEV_CLASSIFICATION_LABEL_SEED_VERSION = "dev-seed-v1" as const

export const DEV_CLASSIFICATION_LABEL_TREE: readonly DevClassificationCategorySpec[] = [
  {
    slug: "frequently-used",
    name: "よく使う",
    tags: [
      { slug: "daily", name: "毎日使う" },
      { slug: "temporary", name: "一時保存" },
    ],
  },
  {
    slug: "read-later",
    name: "あとで見る",
    tags: [
      { slug: "article", name: "記事" },
      { slug: "video", name: "動画" },
      { slug: "other", name: "その他" },
    ],
  },
  {
    slug: "work-school",
    name: "仕事・学校",
    tags: [
      { slug: "portal", name: "ポータル" },
      { slug: "materials", name: "資料" },
      { slug: "tools", name: "ツール" },
    ],
  },
  {
    slug: "tools",
    name: "ツール",
    tags: [
      { slug: "web-tools", name: "Webツール" },
      { slug: "ai-tools", name: "AIツール" },
      { slug: "utilities", name: "ユーティリティ" },
    ],
  },
  {
    slug: "hobbies",
    name: "趣味",
    tags: [
      { slug: "content", name: "コンテンツ" },
      { slug: "community", name: "コミュニティ" },
    ],
  },
] as const

export function devCategoryCreationRequestId(slug: string): string {
  return `${DEV_CLASSIFICATION_LABEL_SEED_VERSION}:category:${slug}`
}

export function devTagCreationRequestId(categorySlug: string, tagSlug: string): string {
  return `${DEV_CLASSIFICATION_LABEL_SEED_VERSION}:tag:${categorySlug}:${tagSlug}`
}
