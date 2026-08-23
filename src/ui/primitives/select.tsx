// Radix Select を、ラベル・説明・選択肢込みで再利用できる入力部品にするファイルです。
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from "@radix-ui/react-icons"
import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export type SelectOption = {
  disabled?: boolean
  label: string
  value: string
}

export type SelectProps = {
  className?: string
  defaultValue?: string
  description?: string
  disabled?: boolean
  id?: string
  label: string
  name?: string
  onValueChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  size?: "compact" | "default"
  value?: string
}

export const Select = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectProps
>(
  (
    {
      className,
      defaultValue,
      description,
      disabled,
      id,
      label,
      name,
      onValueChange,
      options,
      placeholder = "選択してください",
      size = "default",
      value
    },
    ref
  ) => {
    // useId で画面内だけの一意な ID を作り、表示ラベルと説明を操作部分へ関連付けます。
    const generatedId = React.useId()
    const triggerId = id ?? `bm-select-${generatedId}`
    const labelId = `${triggerId}-label`
    const descriptionId = description ? `${triggerId}-description` : undefined

    return (
      <div className={joinClassNames("grid gap-2", className)}>
        <label
          className="text-sm font-semibold text-bm-ink"
          htmlFor={triggerId}
          id={labelId}
        >
          {label}
        </label>
        {description ? (
          <p
            className="m-0 text-xs leading-5 text-bm-muted-text"
            id={descriptionId}
          >
            {description}
          </p>
        ) : null}
        {/* value があれば親が状態を管理し、defaultValue なら Radix が初期値以降を管理します。 */}
        <SelectPrimitive.Root
          defaultValue={defaultValue}
          disabled={disabled}
          name={name}
          onValueChange={onValueChange}
          value={value}
        >
          <SelectPrimitive.Trigger
            aria-describedby={descriptionId}
            aria-labelledby={labelId}
            className={joinClassNames(
              "inline-flex min-w-[9.0625rem] items-center justify-between gap-3 rounded-bm-field border-2 border-bm-border bg-bm-paper text-left text-sm text-bm-ink outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper disabled:cursor-not-allowed disabled:opacity-45 data-[placeholder]:text-bm-muted-text",
              size === "compact" ? "h-10 px-3" : "h-12 px-4"
            )}
            id={triggerId}
            ref={ref}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon aria-hidden="true">
              <ChevronDownIcon className="size-4" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          {/* 選択肢は Portal へ出し、親要素の overflow や重なり順で切れにくくします。 */}
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className="z-bm-popover min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-bm-field border-2 border-bm-border bg-bm-accent text-bm-ink shadow-bm-header"
              position="popper"
              sideOffset={6}
            >
              <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center bg-bm-accent">
                <ChevronUpIcon aria-hidden="true" />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    className="relative flex min-h-10 select-none items-center rounded-bm-field py-2 pl-8 pr-3 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-bm-ink data-[highlighted]:text-bm-paper"
                    disabled={option.disabled}
                    key={option.value}
                    value={option.value}
                  >
                    <span className="absolute left-2 inline-flex size-4 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <CheckIcon aria-hidden="true" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center bg-bm-accent">
                <ChevronDownIcon aria-hidden="true" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </div>
    )
  }
)

Select.displayName = "Select"
