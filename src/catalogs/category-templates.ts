/**
 * BE-19 の同梱 Category template catalog。
 * ISSUE-022 が未決のため、候補名をここへ追加してはならない。
 */
export type CategoryTemplate = Readonly<{
  id: string
  name: string
  setId: string
}>

export type CategoryTemplateCatalog = Readonly<{
  version: string
  locale: "ja"
  templates: readonly CategoryTemplate[]
}>

export const CATEGORY_TEMPLATE_CATALOG: CategoryTemplateCatalog = {
  version: "pending-issue-022",
  locale: "ja",
  templates: [],
}
