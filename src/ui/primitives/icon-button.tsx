// アイコンだけのボタンに、共通の見た目・読み上げ名・ツールチップを与えるファイルです。
import * as React from "react"

import { joinClassNames } from "./class-names"
import { Tooltip } from "./tooltip"

type IconButtonSize = "compact" | "regular"
type IconButtonShape = "pill" | "square"
type IconButtonVariant = "accent" | "outline" | "quiet" | "solid"

export type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  children: React.ReactNode
  label: string
  shape?: IconButtonShape
  size?: IconButtonSize
  tooltip?: React.ReactNode | false
  tooltipSide?: "bottom" | "left" | "right" | "top"
  variant?: IconButtonVariant
}

const baseClass =
  "inline-flex shrink-0 select-none items-center justify-center border-2 font-semibold leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper disabled:cursor-not-allowed disabled:opacity-45"

const sizeAndShapeClass: Record<
  IconButtonSize,
  Record<IconButtonShape, string>
> = {
  compact: {
    pill: "h-10 w-16 rounded-bm-pill",
    square: "size-10 rounded-bm-pill"
  },
  regular: {
    pill: "h-[3.125rem] w-[5.3125rem] rounded-bm-pill",
    square: "size-[3.125rem] rounded-bm-pill"
  }
}

const appearanceClass: Record<IconButtonVariant, string> = {
  accent:
    "border-bm-ink bg-bm-accent text-bm-ink hover:bg-bm-ink hover:text-bm-paper active:bg-bm-ink active:text-bm-paper [&:active_img]:invert [&:hover_img]:invert",
  outline:
    "border-bm-ink bg-bm-paper text-bm-ink hover:bg-bm-ink hover:text-bm-paper active:bg-bm-ink active:text-bm-paper [&:active_img]:invert [&:hover_img]:invert",
  quiet:
    "border-transparent bg-transparent text-bm-ink hover:border-bm-ink hover:bg-bm-ink hover:text-bm-paper active:border-bm-ink active:bg-bm-ink active:text-bm-paper [&:active_img]:invert [&:hover_img]:invert",
  solid:
    "border-bm-ink bg-bm-paper text-bm-ink hover:bg-bm-ink hover:text-bm-paper active:bg-bm-ink active:text-bm-paper [&:active_img]:invert [&:hover_img]:invert"
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      className,
      label,
      shape = "square",
      size = "regular",
      tooltip,
      tooltipSide = "bottom",
      type = "button",
      variant = "outline",
      ...props
    },
    ref
  ) => {
    // 見えるアイコンとは別に aria-label を必須にし、支援技術にもボタンの目的を伝えます。
    const control = (
      <button
        {...props}
        aria-label={label}
        className={joinClassNames(
          baseClass,
          sizeAndShapeClass[size][shape],
          appearanceClass[variant],
          className
        )}
        ref={ref}
        type={type}
      >
        {/* アイコン名の重複読み上げを避け、label だけをボタン名として使います。 */}
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center"
        >
          {children}
        </span>
      </button>
    )

    if (tooltip === false) {
      return control
    }

    // Tooltip の Trigger は asChild なので、余分なラッパー要素を増やさず button を再利用します。
    return (
      <Tooltip content={tooltip ?? label} side={tooltipSide}>
        {control}
      </Tooltip>
    )
  }
)

IconButton.displayName = "IconButton"
