// Bookmation 全体で使うボタンの見た目と操作規則を一か所にまとめるファイルです。
import * as React from "react"
import { Slot } from "radix-ui"

import { joinClassNames } from "./class-names"

type ButtonVariant = "solid" | "outline" | "quiet"
type ButtonTone = "default" | "danger"
type ButtonSize = "compact" | "regular"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  loading?: boolean
  size?: ButtonSize
  tone?: ButtonTone
  variant?: ButtonVariant
}

const baseClass =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 border-2 font-semibold leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45"

// size・tone・variant を表にして、画面ごとに Tailwind の指定がばらつくのを防ぎます。
const sizeClass: Record<ButtonSize, string> = {
  compact: "min-h-9 rounded-bm-chip px-4 text-xs",
  regular: "min-h-12 min-w-32 rounded-bm-pill px-5 text-sm"
}

const appearanceClass: Record<ButtonTone, Record<ButtonVariant, string>> = {
  default: {
    solid:
      "border-bm-ink bg-bm-ink text-bm-paper hover:bg-bm-panel active:bg-bm-black",
    outline:
      "border-bm-ink bg-bm-paper text-bm-ink hover:bg-bm-accent active:bg-bm-ink active:text-bm-paper",
    quiet:
      "border-transparent bg-transparent text-bm-ink hover:border-bm-ink hover:bg-bm-paper active:bg-bm-accent"
  },
  danger: {
    solid:
      "border-bm-danger bg-bm-danger text-bm-paper hover:brightness-90 active:brightness-75",
    outline:
      "border-bm-danger bg-bm-paper text-bm-danger hover:bg-bm-accent active:bg-bm-danger active:text-bm-paper",
    quiet:
      "border-transparent bg-transparent text-bm-danger hover:border-bm-danger hover:bg-bm-accent active:bg-bm-danger active:text-bm-paper"
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      className,
      disabled,
      loading = false,
      onClick,
      size = "regular",
      tone = "default",
      type,
      variant = "outline",
      ...props
    },
    ref
  ) => {
    // asChild=true では Radix の Slot が子要素（例: <a>）へ属性と ref を合成します。
    // そのため、リンクをボタンの中へ入れる不正な HTML を作らずに同じ見た目を使えます。
    const Component = asChild ? Slot.Root : "button"
    const isDisabled = disabled || loading

    // <a> には disabled 属性がないため、asChild の無効状態はクリックも明示的に止めます。
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      onClick?.(event)
    }

    return (
      <Component
        {...props}
        aria-busy={loading || undefined}
        aria-disabled={asChild && isDisabled ? true : undefined}
        className={joinClassNames(
          baseClass,
          sizeClass[size],
          appearanceClass[tone][variant],
          className
        )}
        disabled={asChild ? undefined : isDisabled}
        onClick={handleClick}
        ref={ref}
        tabIndex={asChild && isDisabled ? -1 : props.tabIndex}
        type={asChild ? undefined : (type ?? "button")}
      />
    )
  }
)

Button.displayName = "Button"
