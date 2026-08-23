import * as React from "react"

import { AppProviders, createBrowserAppRuntime } from "~/ui/app/AppProviders"
import { AppErrorBoundary } from "~/ui/app/ErrorBoundary"
import { ExtensionApp } from "~/ui/app/ExtensionApp"
import { createBrowserHashRouteStore } from "~/ui/app/hash-route"
import type { AiAssistantPort } from "~/ui/features/ai-assistant/ai-assistant-port"
import type { LabelManagementPort } from "~/ui/features/labels/label-management-port"
import type { OnboardingPort } from "~/ui/features/onboarding/onboarding-port"
import type { SearchPort } from "~/ui/features/search/search-port"
import type { ArchiveSettingsPort } from "~/ui/features/settings/archive-settings-port"
import {
  DEFAULT_GENERAL_SETTINGS_SNAPSHOT,
  type GeneralSettingsPort
} from "~/ui/features/settings/general-settings-port"
import type { ShareSettingsPort } from "~/ui/features/settings/share-settings-port"

const fixtureRoutes = [
  ["ホーム", "#/home"],
  ["カテゴリ一覧", "#/labels"],
  ["一般設定", "#/settings/general"],
  ["アーカイブ設定", "#/settings/archive"],
  ["共有設定", "#/settings/share"],
  ["検索結果", "#/search?q=あとで読む"],
  ["初回画面", "#/welcome"],
  ["カテゴリ選択", "#/onboarding/categories"],
  ["不正URL", "#/unknown"]
] as const

const fixtureSearchPort: SearchPort = {
  search: async (keyword) => ({
    bookmarks: [
      {
        id: "bookmark-typescript-handbook",
        normalizedUrl: "https://www.typescriptlang.org/docs/handbook/",
        revision: 1,
        title: `${keyword} Handbook`
      }
    ],
    labels: [
      {
        id: "category-development",
        kind: "CATEGORY",
        name: "開発",
        parentCategoryId: null,
        revision: 1
      },
      {
        id: "tag-typescript",
        kind: "TAG",
        name: "TypeScript",
        parentCategoryId: "category-development",
        revision: 1
      }
    ],
    source: "LEXICAL_FALLBACK"
  }),
  suggest: async (keyword) => [
    {
      displayText: "TypeScript",
      entityId: "tag-typescript",
      entityRevision: 1,
      entityType: "LABEL",
      labelKind: "TAG",
      parentCategoryId: "category-development"
    },
    {
      displayText: `${keyword} Handbook`,
      entityId: "bookmark-typescript-handbook",
      entityRevision: 1,
      entityType: "BOOKMARK",
      labelKind: null,
      parentCategoryId: null
    }
  ]
}

const aiAssistantPort: AiAssistantPort = {
  ask: async (input, options) => {
    options?.onProgress?.("streaming")
    return {
      aiAvailable: true,
      answerText: input.includes("共有")
        ? "未実装: QR、CSV、Google Driveによる共有は現在開発中です。"
        : "2件の候補が見つかりました。",
      candidates: input.includes("共有")
        ? []
        : [
            {
              entityType: "LABEL",
              id: "tag-typescript",
              kind: "TAG",
              name: "TypeScript",
              parentCategoryId: "category-development",
              revision: 1
            },
            {
              entityType: "BOOKMARK",
              id: "bookmark-typescript-handbook",
              normalizedUrl: "https://www.typescriptlang.org/docs/handbook/",
              revision: 1,
              title: "TypeScript Handbook"
            }
          ],
      intent: input.includes("共有") ? "PRODUCT_HELP" : "SEARCH_LIBRARY",
      query: input.includes("共有") ? null : "TypeScript"
    }
  }
}

const onboardingState = (status: "IN_PROGRESS" | "COMPLETED") => ({
  categorySelection: {},
  currentStepId: status === "COMPLETED" ? null : "categories",
  initializedBy: "INSTALL" as const,
  schemaVersion: 1 as const,
  status,
  updatedAt: Date.now()
})

const onboardingPort: OnboardingPort = {
  complete: async () => onboardingState("COMPLETED"),
  load: async () => null,
  saveSelection: async (categorySelection) => ({
    ...onboardingState("IN_PROGRESS"),
    categorySelection: Object.fromEntries(
      Object.entries(categorySelection).map(([id, tags]) => [id, [...tags]])
    )
  }),
  start: async () => onboardingState("IN_PROGRESS")
}

export function AppShellFixture() {
  const routeStore = React.useMemo(
    () => createBrowserHashRouteStore(window),
    []
  )
  const runtime = React.useMemo(
    () => createBrowserAppRuntime(window, "web-preview"),
    []
  )
  const labelManagementPort = React.useMemo<LabelManagementPort>(() => {
    const categories = [
      {
        id: "category-development",
        name: "開発",
        origin: "USER",
        revision: 1,
        tags: [
          {
            id: "tag-typescript",
            name: "TypeScript",
            origin: "USER",
            parentCategoryId: "category-development",
            parentCategoryName: "開発",
            revision: 1,
            usageCount: 4
          }
        ]
      },
      {
        id: "category-reading",
        name: "あとで読む",
        origin: "USER",
        revision: 1,
        tags: []
      }
    ]
    return {
      createCategory: async ({ name }) => ({
        id: crypto.randomUUID(),
        name,
        revision: 1
      }),
      createTag: async ({ category, name }) => ({
        id: crypto.randomUUID(),
        name,
        origin: "USER",
        parentCategoryId: category.id,
        parentCategoryName: category.name,
        revision: 1,
        usageCount: 0
      }),
      deleteCategory: async () => undefined,
      deleteTag: async () => undefined,
      getCategoryDetail: async (id) => {
        const category =
          categories.find((item) => item.id === id) ?? categories[0]
        return {
          activeTagCount: category.tags.length,
          activeTags: category.tags,
          category,
          impactFingerprint: `fixture:${id}`,
          referencedActiveBookmarkCount: category.tags.reduce(
            (sum, tag) => sum + tag.usageCount,
            0
          )
        }
      },
      list: async () => categories,
      searchCategories: async () => categories,
      updateTag: async () => undefined
    }
  }, [])
  const generalSettingsPort = React.useMemo<GeneralSettingsPort>(() => {
    let current = DEFAULT_GENERAL_SETTINGS_SNAPSHOT
    const update = async (next: Partial<typeof current>) => {
      current = { ...current, ...next }
      return current
    }
    return {
      getSnapshot: async () => current,
      setAutoArchiveEnabled: async (enabled) =>
        update({ autoArchiveEnabled: enabled }),
      setContextMenuBookmarkEnabled: async (enabled) =>
        update({ contextMenuBookmarkEnabled: enabled }),
      setFrequentVisitReminderEnabled: async (enabled) =>
        update({ frequentVisitReminderEnabled: enabled }),
      subscribePermissionChanges: () => () => undefined,
      updateReminderSettings: update,
      updateSettings: update
    }
  }, [])
  const archiveSettingsPort = React.useMemo<ArchiveSettingsPort>(() => {
    let snapshot = {
      archived: [
        {
          categories: ["開発"],
          id: "archive-react",
          tags: ["React"],
          title: "Reactリファレンス",
          url: "https://react.dev/reference/react"
        },
        {
          categories: ["資料"],
          id: "archive-css",
          tags: ["CSS"],
          title: "CSS仕様",
          url: "https://www.w3.org/Style/CSS/"
        }
      ],
      historyIssues: [
        {
          code: "ARCHIVE_HISTORY_NOT_FOUND" as const,
          id: "history-missing",
          title: "履歴のないページ",
          url: "https://example.com/no-history"
        }
      ]
    }
    return {
      load: async () => snapshot,
      restore: async (ids) => {
        const failures = ids.includes("archive-css")
          ? [
              {
                id: "archive-css",
                reason: "タグが削除されているため復元できません。"
              }
            ]
          : []
        const restoredIds = ids.filter(
          (id) => !failures.some((failure) => failure.id === id)
        )
        snapshot = {
          ...snapshot,
          archived: snapshot.archived.filter(
            (item) => !restoredIds.includes(item.id)
          )
        }
        return { failures, restoredIds, snapshot }
      }
    }
  }, [])
  const shareSettingsPort = React.useMemo<ShareSettingsPort>(
    () => ({
      connectDrive: async () => ({
        drive: {
          accountEmail: "demo@example.com",
          fileName: null,
          lastSyncedAt: "2026-08-23 12:00",
          state: "CONNECTED",
          unsyncedCount: 0
        },
        items: []
      }),
      exportBookmarks: async (ids, format) =>
        format === "QR" && ids.length > 1
          ? { status: "QR_CAPACITY_EXCEEDED" }
          : {
              status: "READY",
              message: `${ids.length}件を${format}へ出力しました。`
            },
      load: async () => ({
        drive: null,
        items: [
          {
            bookmarkIds: ["bookmark-react", "bookmark-ts"],
            id: "category-development",
            kind: "CATEGORY",
            label: "開発"
          },
          {
            bookmarkIds: ["bookmark-react"],
            id: "tag-react",
            kind: "TAG",
            label: "React"
          },
          {
            bookmarkIds: ["bookmark-ts"],
            description: "typescriptlang.org",
            id: "bookmark-ts",
            kind: "BOOKMARK",
            label: "TypeScript Handbook"
          }
        ]
      }),
      openQrReader: async () => undefined
    }),
    []
  )

  return (
    <AppProviders routeStore={routeStore} runtime={runtime}>
      <AppErrorBoundary>
        <ExtensionApp
          aiAssistantPort={aiAssistantPort}
          archiveSettingsPort={archiveSettingsPort}
          generalSettingsPort={generalSettingsPort}
          labelManagementPort={labelManagementPort}
          onboardingPort={onboardingPort}
          searchPort={fixtureSearchPort}
          shareSettingsPort={shareSettingsPort}
        />
      </AppErrorBoundary>

      <aside className="fixed bottom-3 right-3 z-bm-toast max-w-[calc(100vw-1.5rem)] rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-3 text-xs shadow-bm-floating">
        <details>
          <summary className="cursor-pointer select-none font-bold uppercase tracking-[0.12em]">
            Test preview / UI-02
          </summary>
          <nav
            aria-label="App Shell fixture切替"
            className="mt-3 flex max-w-xs flex-wrap gap-2"
          >
            {fixtureRoutes.map(([label, hash]) => (
              <a
                className="rounded-bm-field border border-bm-border bg-bm-paper px-2 py-1 text-bm-ink outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus"
                href={hash}
                key={hash}
              >
                {label}
              </a>
            ))}
            <a
              className="rounded-bm-field border border-bm-border bg-bm-panel px-2 py-1 text-bm-on-panel outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
              href="?view=bookmarks&fixture=grid#/home"
            >
              UI-05 bookmarks
            </a>
            <a
              className="rounded-bm-field border border-bm-border bg-bm-panel px-2 py-1 text-bm-on-panel outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
              href="?view=popup&fixture=assigned"
            >
              UI-03 popup
            </a>
            <a
              className="rounded-bm-field border border-bm-border bg-bm-panel px-2 py-1 text-bm-on-panel outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
              href="?view=components"
            >
              UI-01 component sheet
            </a>
          </nav>
        </details>
      </aside>
    </AppProviders>
  )
}
