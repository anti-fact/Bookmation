/**
 * 初回オンボーディングでカテゴリとタグを選ぶ画面です。
 * Figma「初期画面」に合わせ、共通ヘッダーを持たない独立した1枚として組みます。
 * 選択は画面内の state だけに持ち、保存操作まで Label を作りません。
 */
import * as React from "react"
import { MinusIcon, PlusIcon } from "@radix-ui/react-icons"

import {
  CATEGORY_PRESET_CATALOG,
  type CategoryPreset,
  type CategoryPresetCatalog
} from "~/catalogs/onboarding-category-presets"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox
} from "~/ui/primitives"

import { CATEGORY_PRESET_ICONS } from "./category-preset-icons"

// モジュール相対URLにすることで、ビルド時に画像を拡張機能へ同梱できます。
const bookmationLogo = new URL(
  "../../assets/bookmation-logo.svg",
  import.meta.url
).href

/** カテゴリIDごとに、選ばれたタグ名を持ちます。 */
export type CategoryPresetSelection = Readonly<Record<string, readonly string[]>>

export type OnboardingCategoriesPageProps = {
  catalog?: CategoryPresetCatalog
  description: string
  heading: string
  headingRef?: React.Ref<HTMLHeadingElement>
  onSubmit: (selection: CategoryPresetSelection) => void
}

function toggleTag(
  selection: CategoryPresetSelection,
  categoryId: string,
  tag: string
): CategoryPresetSelection {
  const current = selection[categoryId] ?? []
  const next = current.includes(tag)
    ? current.filter((selected) => selected !== tag)
    : [...current, tag]

  // 空配列を残すと「カテゴリだけ選ばれた」状態と区別が付かないため、key ごと消します。
  if (next.length === 0) {
    const rest = { ...selection }
    delete rest[categoryId]
    return rest
  }

  return { ...selection, [categoryId]: next }
}

type CategoryPresetCardProps = {
  category: CategoryPreset
  fieldIdPrefix: string
  onToggleTag: (categoryId: string, tag: string) => void
  selectedTags: readonly string[]
}

function CategoryPresetCard({
  category,
  fieldIdPrefix,
  onToggleTag,
  selectedTags
}: CategoryPresetCardProps) {
  const CategoryIcon = CATEGORY_PRESET_ICONS[category.icon]

  return (
    <AccordionItem value={category.id}>
      <AccordionTrigger className="group border-b border-bm-ink pb-2 pt-1 text-lg hover:bg-bm-accent">
        <CategoryIcon
          aria-hidden="true"
          className="size-[1.125rem] shrink-0"
        />
        <span className="min-w-0 flex-1 break-all">{category.name}</span>
        {selectedTags.length > 0 ? (
          <span className="shrink-0 text-xs text-bm-muted-text">
            {selectedTags.length}件選択
          </span>
        ) : null}
        <PlusIcon
          aria-hidden="true"
          className="size-5 shrink-0 group-data-[state=open]:hidden"
        />
        <MinusIcon
          aria-hidden="true"
          className="hidden size-5 shrink-0 group-data-[state=open]:block"
        />
      </AccordionTrigger>
      <AccordionContent>
        <ul className="m-0 flex list-none flex-col gap-1 border-x border-b border-bm-ink px-5 pb-4 pt-4">
          {category.tags.map((tag, index) => {
            const controlId = `${fieldIdPrefix}-${category.id}-${index}`

            return (
              <li key={tag}>
                <label
                  className="flex cursor-pointer items-center gap-[0.3125rem] py-0.5"
                  htmlFor={controlId}
                >
                  <Checkbox
                    checked={selectedTags.includes(tag)}
                    id={controlId}
                    onCheckedChange={() => onToggleTag(category.id, tag)}
                  />
                  <span className="min-w-0 break-all">{tag}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </AccordionContent>
    </AccordionItem>
  )
}

export function OnboardingCategoriesPage({
  catalog = CATEGORY_PRESET_CATALOG,
  description,
  heading,
  headingRef,
  onSubmit
}: OnboardingCategoriesPageProps) {
  const fieldIdPrefix = React.useId()
  const [selection, setSelection] = React.useState<CategoryPresetSelection>({})

  const handleToggleTag = React.useCallback(
    (categoryId: string, tag: string) => {
      setSelection((current) => toggleTag(current, categoryId, tag))
    },
    []
  )

  return (
    <div className="min-h-dvh overflow-x-clip bg-bm-paper text-bm-ink">
      <main
        className="mx-auto w-full max-w-[90rem] px-4 pb-16 pt-6 sm:px-8 lg:px-[4.5rem]"
        id="main-content"
      >
        <img
          alt="Bookmation"
          className="h-auto w-40"
          height={121}
          src={bookmationLogo}
          width={400}
        />
        <header className="mt-10">
          <h1
            className="mb-0 mt-0 scroll-mt-8 rounded-bm-field text-2xl font-normal leading-tight outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-4 sm:text-[1.75rem]"
            ref={headingRef}
            tabIndex={-1}
          >
            {heading}
          </h1>
          <p className="mb-0 mt-3 text-base leading-6 text-bm-muted">
            {description.split("\n").map((line) => (
              <span className="block" key={line}>
                {line}
              </span>
            ))}
          </p>
        </header>
        {catalog.sets.map((set) => (
          <section aria-labelledby={`${fieldIdPrefix}-${set.id}`} key={set.id}>
            <h2
              className="mb-0 mt-12 text-xl font-bold"
              id={`${fieldIdPrefix}-${set.id}`}
            >
              {set.name}
              <span className="ml-3 text-sm font-normal text-bm-muted">
                {set.englishName}
              </span>
            </h2>
            <Accordion
              className="mt-6 grid grid-cols-1 items-start gap-x-12 gap-y-8 sm:grid-cols-2 xl:grid-cols-3"
              type="multiple"
            >
              {set.categories.map((category) => (
                <CategoryPresetCard
                  category={category}
                  fieldIdPrefix={fieldIdPrefix}
                  key={category.id}
                  onToggleTag={handleToggleTag}
                  selectedTags={selection[category.id] ?? []}
                />
              ))}
            </Accordion>
          </section>
        ))}
        <div className="mt-16 flex justify-end">
          <Button
            className="h-[3.25rem] w-full max-w-[15rem] !rounded-none px-6 !font-normal sm:!text-[1.125rem]"
            onClick={() => onSubmit(selection)}
          >
            設定を保存
          </Button>
        </div>
      </main>
    </div>
  )
}
