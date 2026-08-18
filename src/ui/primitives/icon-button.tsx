import * as React from "react"

import { joinClassNames } from "./class-names"
import { Tooltip } from "./tooltip"

type IconButtonSize = "compact" | "regular"
type IconButtonShape = "pill" | "square"
type IconButtonVariant = "outline" | "quiet" | "solid"

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
  outline:
    "border-bm-ink bg-bm-paper text-bm-ink hover:bg-bm-accent active:bg-bm-ink active:text-bm-paper",
  quiet:
    "border-transparent bg-transparent text-bm-ink hover:border-bm-ink hover:bg-bm-paper active:bg-bm-accent",
  solid:
    "border-bm-ink bg-bm-ink text-bm-paper hover:bg-bm-panel active:bg-bm-black"
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

    return (
      <Tooltip content={tooltip ?? label} side={tooltipSide}>
        {control}
      </Tooltip>
    )
  }
)

IconButton.displayName = "IconButton"
