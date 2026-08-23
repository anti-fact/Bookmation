// オン・オフ設定を、ラベル・説明・保存待ち状態込みで表示する共通スイッチです。
import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export type SwitchProps = Omit<
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
  "id"
> & {
  controlOnly?: boolean
  description?: string
  descriptionClassName?: string
  id?: string
  label: string
  labelClassName?: string
  pending?: boolean
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(
  (
    {
      className,
      controlOnly = false,
      description,
      descriptionClassName,
      disabled,
      id,
      label,
      labelClassName,
      pending = false,
      ...props
    },
    ref
  ) => {
    // useId から各 ID を作り、見える文言と Radix の操作部分を ARIA で結び付けます。
    const generatedId = React.useId()
    const controlId = id ?? `bm-switch-${generatedId}`
    const labelId = `${controlId}-label`
    const descriptionId = description ? `${controlId}-description` : undefined
    // 保存処理中も操作を止め、連続クリックで状態が食い違うのを防ぎます。
    const isDisabled = disabled || pending

    if (controlOnly) {
      return (
        <SwitchPrimitive.Root
          {...props}
          aria-busy={pending || undefined}
          className={joinClassNames(
            "relative h-[30px] w-20 shrink-0 rounded-bm-switch bg-bm-control-muted p-0.5 outline-none transition-colors data-[state=checked]:bg-bm-ink disabled:cursor-not-allowed",
            isDisabled ? "cursor-not-allowed opacity-50" : undefined,
            className
          )}
          disabled={isDisabled}
          id={controlId}
          ref={ref}
        >
          <SwitchPrimitive.Thumb
            className="block h-[26px] w-8 translate-x-0 rounded-bm-switch bg-bm-paper shadow-bm-control transition-transform data-[state=checked]:translate-x-11"
          />
        </SwitchPrimitive.Root>
      )
    }

    return (
      <label
        className={joinClassNames(
          "flex w-full max-w-xl items-center justify-between gap-6 rounded-bm-field p-2 outline-none focus-within:ring-2 focus-within:ring-bm-focus focus-within:ring-offset-2 focus-within:ring-offset-bm-paper",
          isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className
        )}
        htmlFor={controlId}
      >
        <span className="min-w-0">
          <span
            className={joinClassNames(
              "block text-sm font-semibold text-bm-ink",
              labelClassName
            )}
            id={labelId}
          >
            {label}
          </span>
          {description ? (
            <span
              className={joinClassNames(
                "mt-1 block text-xs leading-5 text-bm-muted-text",
                descriptionClassName
              )}
              id={descriptionId}
            >
              {description}
            </span>
          ) : null}
        </span>
        <SwitchPrimitive.Root
          {...props}
          aria-busy={pending || undefined}
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          className="relative h-[30px] w-20 shrink-0 rounded-bm-switch bg-bm-control-muted p-0.5 outline-none transition-colors data-[state=checked]:bg-bm-ink disabled:cursor-not-allowed"
          disabled={isDisabled}
          id={controlId}
          ref={ref}
        >
          <SwitchPrimitive.Thumb className="block h-[26px] w-8 translate-x-0 rounded-bm-switch bg-bm-paper shadow-bm-control transition-transform data-[state=checked]:translate-x-11" />
        </SwitchPrimitive.Root>
      </label>
    )
  }
)

Switch.displayName = "Switch"
