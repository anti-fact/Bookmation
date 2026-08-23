/**
 * 分類 Host 検証用の Category 一覧。
 * Tag は利用者 UI からだけ作成する（seed／AI では作らない）。
 */
export type DevClassificationCategorySpec = Readonly<{
  slug: string
  name: string
}>

export const DEV_CLASSIFICATION_LABEL_SEED_VERSION = "dev-seed-v2" as const

export const DEV_CLASSIFICATION_CATEGORY_SEED: readonly DevClassificationCategorySpec[] =
  [
    { slug: "frequently-used", name: "よく使う" },
    { slug: "read-later", name: "あとで見る" },
    { slug: "work-school", name: "仕事・学校" },
    { slug: "tools", name: "ツール" },
    { slug: "hobbies", name: "趣味" },
  ] as const

/** @deprecated 互換 alias。`DEV_CLASSIFICATION_CATEGORY_SEED` を使う。 */
export const DEV_CLASSIFICATION_LABEL_TREE = DEV_CLASSIFICATION_CATEGORY_SEED

export function devCategoryCreationRequestId(slug: string): string {
  return `${DEV_CLASSIFICATION_LABEL_SEED_VERSION}:category:${slug}`
}
