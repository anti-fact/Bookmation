/**
 * 通常・カテゴリ/タグ一覧・設定の3画面で使う共通ヘッダーです。
 * variantごとに利用できる操作を型で限定します。
 */
import {
  ChevronDownIcon,
  Cross2Icon,
  GearIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from "@radix-ui/react-icons"
import * as React from "react"
import { Toggle as TogglePrimitive } from "radix-ui"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../primitives/dropdown-menu"
import { IconButton } from "../primitives/icon-button"
import { joinClassNames } from "../primitives/class-names"

// variantを判別キーにしたunionにより、画面に不要な操作の渡し間違いを防ぎます。
type HeaderCommonProps = {
  className?: string
  logoAlt?: string
  logoSrc?: string
  onLogoClick?: () => void
}

type SearchHeaderProps = {
  onSearchClick?: () => void
  searchAccessibleLabel?: string
  searchPlaceholder?: string
  searchSlot?: React.ReactNode
}

type DefaultHeaderProps = HeaderCommonProps &
  SearchHeaderProps & {
    aiAccessibleLabel?: string
    aiIcon?: React.ReactNode
    onAiSearchClick?: () => void
    onBookmarkAddClick?: () => void
    onSettingsClick?: () => void
    variant: "default"
  }

type LabelsHeaderProps = HeaderCommonProps &
  SearchHeaderProps & {
    manageIcon?: React.ReactNode
    onClose?: () => void
    onCreateCategoryClick?: () => void
    onCreateTagClick?: () => void
    onManageClick?: () => void
    variant: "labels"
  }

type SettingsHeaderProps = HeaderCommonProps & {
  onClose?: () => void
  settingsTitle?: string
  variant: "settings"
}

export type AppHeaderProps =
  | DefaultHeaderProps
  | LabelsHeaderProps
  | SettingsHeaderProps

// 画像がない場合も製品名を残し、移動できる場合だけbuttonとして扱います。
const Logo = ({
  alt,
  onClick,
  src
}: {
  alt: string
  onClick?: () => void
  src?: string
}) => {
  const wordmark = src ? (
    <img
      alt={alt}
      className="h-auto w-[7rem] max-w-full object-contain sm:w-[9.9375rem]"
      height={48}
      src={src}
      width={159}
    />
  ) : (
    <span className="text-lg font-black tracking-[0.08em] sm:text-2xl">
      Bookmation
    </span>
  )

  if (!onClick) {
    return <div className="flex shrink-0 items-center">{wordmark}</div>
  }

  return (
    <button
      aria-label="ホームへ移動"
      className="flex shrink-0 items-center rounded-bm-field outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
      onClick={onClick}
      type="button"
    >
      {wordmark}
    </button>
  )
}

// ここでは文字を直接入力せず、全画面の検索を開くためbuttonを使います。
const SearchEntry = ({
  accessibleLabel,
  onClick,
  placeholder
}: {
  accessibleLabel: string
  onClick?: () => void
  placeholder: string
}) => (
  <button
    aria-label={accessibleLabel}
    className="group flex h-[3.125rem] w-full min-w-0 items-stretch overflow-hidden rounded-bm-pill border-2 border-bm-ink bg-bm-paper text-left text-bm-ink outline-none transition-colors hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
    onClick={onClick}
    type="button"
  >
    <span className="min-w-0 flex-1 truncate px-5 py-[0.8125rem] text-sm text-bm-muted-text transition-colors group-hover:text-bm-paper">
      {placeholder}
    </span>
    <span
      aria-hidden="true"
      className="inline-flex h-full w-[2.875rem] shrink-0 items-center justify-center bg-bm-ink text-bm-paper self-center"
    >
      <MagnifyingGlassIcon className="size-6" />
    </span>
  </button>
)

const SearchArea = ({
  onSearchClick,
  searchAccessibleLabel = "検索を開く",
  searchPlaceholder = "ブックマーク、カテゴリ、タグを検索",
  searchSlot
}: SearchHeaderProps) => (
  <div className="min-w-0 flex-1 basis-[18rem] sm:max-w-[28.75rem]">
    {searchSlot ?? (
      <SearchEntry
        accessibleLabel={searchAccessibleLabel}
        onClick={onSearchClick}
        placeholder={searchPlaceholder}
      />
    )}
  </div>
)

const LabelsCreateMenu = ({
  onCreateCategoryClick,
  onCreateTagClick
}: {
  onCreateCategoryClick?: () => void
  onCreateTagClick?: () => void
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        aria-label="新規作成メニュー"
        className="group inline-flex h-[3.125rem] w-[9.1875rem] shrink-0 items-center justify-center gap-5 rounded-[5px] border-2 border-bm-ink bg-bm-accent text-xl font-bold text-bm-ink outline-none transition-colors hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper data-[state=open]:bg-bm-ink data-[state=open]:text-bm-paper"
        type="button"
      >
        <span>New</span>
        <ChevronDownIcon className="size-5 transition-transform group-data-[state=open]:rotate-180" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-[9.1875rem]">
      <DropdownMenuItem
        className="border-b border-bm-border"
        onSelect={onCreateCategoryClick}
      >
        Category
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onCreateTagClick}>Tag</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export const AppHeader = (props: AppHeaderProps) => {
  const logoAlt = props.logoAlt ?? "Bookmation"

  // DOMの並びをキーボードのフォーカス順と一致させています。
  return (
    <header
      aria-label="アプリケーションヘッダー"
      className={joinClassNames(
        "sticky top-0 z-bm-sticky w-full shadow-bm-header",
        props.variant === "labels" ? "bg-bm-accent" : "bg-bm-paper",
        props.className
      )}
      data-variant={props.variant}
    >
      <div
        className={joinClassNames(
          "flex min-h-[4.5rem] w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-3 sm:px-6 md:px-[clamp(1.5rem,5vw,4.5rem)]",
          props.variant === "labels"
            ? "lg:min-h-[6.25rem] lg:flex-nowrap lg:justify-start lg:gap-[3rem] lg:py-0"
            : "md:min-h-[6.25rem] md:flex-nowrap md:gap-5 md:py-0 lg:justify-start lg:gap-[3rem]"
        )}
      >
        <Logo alt={logoAlt} onClick={props.onLogoClick} src={props.logoSrc} />

        {props.variant === "settings" ? (
          <div className="ml-2 flex min-w-0 flex-1 items-center gap-4 sm:ml-0 sm:gap-6">
            <span
              aria-orientation="vertical"
              className="h-8 w-0.5 shrink-0 bg-bm-muted sm:h-12"
              role="separator"
            />
            <p className="m-0 min-w-0 flex-1 truncate text-left text-xl font-bold sm:text-2xl">
              {props.settingsTitle ?? "Settings"}
            </p>
          </div>
        ) : (
          <SearchArea {...props} />
        )}

        {props.variant === "default" ? (
          <div
            aria-label="ヘッダー操作"
            className="ml-auto flex max-w-full shrink-0 items-center gap-3 lg:gap-[1.125rem]"
            role="group"
          >
            {props.onBookmarkAddClick ? (
              <IconButton
                label="ブックマークを追加"
                onClick={props.onBookmarkAddClick}
                shape="pill"
              >
                <PlusIcon className="size-6" />
              </IconButton>
            ) : null}
            <IconButton
              label={props.aiAccessibleLabel ?? "AI検索を開く"}
              onClick={props.onAiSearchClick}
              shape="pill"
            >
              {props.aiIcon ?? <MagicWandIcon className="size-6" />}
            </IconButton>
            <IconButton
              label="設定を開く"
              onClick={props.onSettingsClick}
              shape="pill"
            >
              <GearIcon className="size-6" />
            </IconButton>
          </div>
        ) : null}

        {props.variant === "labels" ? (
          <div
            aria-label="カテゴリ・タグ操作"
            className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-3 lg:gap-[3.125rem]"
            role="group"
          >
            <LabelsCreateMenu
              onCreateCategoryClick={props.onCreateCategoryClick}
              onCreateTagClick={props.onCreateTagClick}
            />
            <div className="flex items-center gap-3 lg:gap-[1.125rem]">
              {/* 継続する押下状態と aria-pressed は Radix Toggle に管理させます。 */}
              <TogglePrimitive.Root asChild defaultPressed={false}>
                <IconButton
                  className="data-[state=off]:hover:bg-bm-paper data-[state=off]:hover:text-bm-ink data-[state=on]:bg-bm-ink data-[state=on]:text-bm-paper data-[state=on]:hover:bg-bm-paper data-[state=on]:hover:text-bm-ink [&[data-state=on]_img]:invert [&[data-state]:hover_img]:invert-0"
                  label="管理モードを切り替える"
                  onClick={props.onManageClick}
                  shape="pill"
                  variant="accent"
                >
                  {props.manageIcon ?? <GearIcon className="size-6" />}
                </IconButton>
              </TogglePrimitive.Root>
              <IconButton
                label="カテゴリ・タグ一覧を閉じる"
                onClick={props.onClose}
                shape="pill"
                variant="accent"
              >
                <Cross2Icon className="size-6" />
              </IconButton>
            </div>
          </div>
        ) : null}

        {props.variant === "settings" ? (
          <IconButton label="設定を閉じる" onClick={props.onClose} shape="pill">
            <Cross2Icon className="size-6" />
          </IconButton>
        ) : null}
      </div>
    </header>
  )
}
