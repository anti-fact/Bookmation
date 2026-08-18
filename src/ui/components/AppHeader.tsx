import {
  Cross2Icon,
  GearIcon,
  MagicWandIcon,
  MagnifyingGlassIcon
} from "@radix-ui/react-icons"
import * as React from "react"

import { IconButton } from "../primitives/icon-button"
import { joinClassNames } from "../primitives/class-names"

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
    aiIcon?: React.ReactNode
    onAiSearchClick?: () => void
    onSettingsClick?: () => void
    variant: "default"
  }

type LabelsHeaderProps = HeaderCommonProps &
  SearchHeaderProps & {
    aiIcon?: React.ReactNode
    manageAction?: React.ReactNode
    newAction?: React.ReactNode
    onAiSearchClick?: () => void
    onClose?: () => void
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
    className="flex h-[3.125rem] w-full min-w-0 items-stretch overflow-hidden rounded-bm-pill border-2 border-bm-ink bg-bm-paper text-left text-bm-ink outline-none transition-colors hover:bg-bm-accent focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
    onClick={onClick}
    type="button"
  >
    <span className="min-w-0 flex-1 truncate px-5 py-[0.8125rem] text-sm text-bm-muted-text">
      {placeholder}
    </span>
    <span
      aria-hidden="true"
      className="inline-flex size-[2.875rem] shrink-0 items-center justify-center bg-bm-ink text-bm-paper"
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

export const AppHeader = (props: AppHeaderProps) => {
  const logoAlt = props.logoAlt ?? "Bookmation"

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
          "flex min-h-[4.5rem] w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-3 sm:px-6",
          props.variant === "labels"
            ? "lg:min-h-[6.25rem] lg:flex-nowrap lg:gap-5 lg:px-[clamp(1.5rem,5vw,4.5rem)] lg:py-0"
            : "md:min-h-[6.25rem] md:flex-nowrap md:gap-5 md:px-[clamp(1.5rem,5vw,4.5rem)] md:py-0"
        )}
      >
        <Logo alt={logoAlt} onClick={props.onLogoClick} src={props.logoSrc} />

        {props.variant === "settings" ? (
          <p className="m-0 min-w-0 flex-1 truncate text-center text-2xl font-bold sm:text-4xl">
            {props.settingsTitle ?? "設定"}
          </p>
        ) : (
          <SearchArea {...props} />
        )}

        {props.variant === "default" ? (
          <div
            aria-label="ヘッダー操作"
            className="flex max-w-full shrink-0 items-center gap-2 sm:gap-3"
            role="group"
          >
            <IconButton
              label="AI検索を開く"
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
            className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3"
            role="group"
          >
            <IconButton
              label="AI検索を開く"
              onClick={props.onAiSearchClick}
              shape="pill"
            >
              {props.aiIcon ?? <MagicWandIcon className="size-6" />}
            </IconButton>
            {props.newAction}
            {props.manageAction}
            <IconButton
              label="カテゴリ・タグ一覧を閉じる"
              onClick={props.onClose}
              shape="pill"
            >
              <Cross2Icon className="size-6" />
            </IconButton>
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
