// 候補の表示だけで何も選ばれないこと、選んだ内容だけが保存へ渡ることを確認します。
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import type { CategoryPresetCatalog } from "~/catalogs/onboarding-category-presets"

import { OnboardingCategoriesPage } from "./OnboardingCategoriesPage"

const catalog: CategoryPresetCatalog = {
  version: "test",
  locale: "ja",
  sets: [
    {
      id: "study",
      name: "学習・研究",
      englishName: "Study & Research",
      categories: [
        {
          id: "study.lecture",
          name: "授業・講義",
          icon: "backpack",
          tags: ["授業ページ", "資料"]
        },
        {
          id: "study.tools",
          name: "学習ツール",
          icon: "ruler",
          tags: ["ノート"]
        }
      ]
    }
  ]
}

function renderPage(onSubmit = vi.fn()) {
  render(
    <OnboardingCategoriesPage
      catalog={catalog}
      description={"1行目\n2行目"}
      heading="あなたにあったカテゴリを選ぶ"
      onSubmit={onSubmit}
    />
  )

  return { onSubmit }
}

describe("OnboardingCategoriesPage", () => {
  it("lists every set and keeps the tags collapsed at first", () => {
    renderPage()

    expect(
      screen.getByRole("heading", { level: 2, name: /学習・研究/ })
    ).not.toBeNull()
    expect(screen.getByRole("button", { name: /授業・講義/ })).not.toBeNull()
    expect(screen.queryByRole("checkbox", { name: "授業ページ" })).toBeNull()
  })

  it("submits nothing when the user only browses the catalog", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPage()

    await user.click(screen.getByRole("button", { name: /授業・講義/ }))
    await user.click(screen.getByRole("button", { name: "設定を保存" }))

    expect(onSubmit).toHaveBeenCalledWith({})
  })

  it("reports the picked tags per category and shows the count on the trigger", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPage()

    await user.click(screen.getByRole("button", { name: /授業・講義/ }))
    await user.click(screen.getByRole("checkbox", { name: "授業ページ" }))
    await user.click(screen.getByRole("checkbox", { name: "資料" }))

    expect(
      screen.getByRole("button", { name: /授業・講義.*2件選択/ })
    ).not.toBeNull()

    await user.click(screen.getByRole("checkbox", { name: "資料" }))
    await user.click(screen.getByRole("button", { name: "設定を保存" }))

    expect(onSubmit).toHaveBeenCalledWith({ "study.lecture": ["授業ページ"] })
  })

  it("shows a skip action on the category onboarding step", () => {
    render(
      <OnboardingCategoriesPage
        catalog={catalog}
        description="説明"
        heading="あなたにあったカテゴリを選ぶ"
        onSkip={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "スキップ" })).not.toBeNull()
  })

  it("calls onSkip when the skip action is used", async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    render(
      <OnboardingCategoriesPage
        catalog={catalog}
        description="説明"
        heading="あなたにあったカテゴリを選ぶ"
        onSkip={onSkip}
        onSubmit={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "スキップ" }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it("restores a saved selection and reports each later change", async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    render(
      <OnboardingCategoriesPage
        catalog={catalog}
        description="説明"
        heading="あなたにあったカテゴリを選ぶ"
        initialSelection={{ "study.lecture": ["授業ページ"] }}
        onSelectionChange={onSelectionChange}
        onSubmit={vi.fn()}
      />
    )

    expect(
      screen.getByRole("button", { name: /授業・講義.*1件選択/ })
    ).not.toBeNull()
    await user.click(screen.getByRole("button", { name: /授業・講義/ }))
    expect(
      screen
        .getByRole("checkbox", { name: "授業ページ" })
        .getAttribute("aria-checked")
    ).toBe("true")
    await user.click(screen.getByRole("checkbox", { name: "資料" }))
    expect(onSelectionChange).toHaveBeenCalledWith({
      "study.lecture": ["授業ページ", "資料"]
    })
  })
})
