// 選択状態を四角形で示す共通チェックボックスです。ラベルとの結び付けは利用側が行います。
import * as React from "react"
import { CheckIcon, DividerHorizontalIcon } from "@radix-ui/react-icons"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export type CheckboxProps = React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
>

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    {...props}
    className={joinClassNames(
      "inline-flex size-4 shrink-0 items-center justify-center border border-bm-border bg-bm-paper text-bm-paper outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:bg-bm-ink data-[state=indeterminate]:bg-bm-ink",
      className
    )}
    ref={ref}
  >
    {/* data-state は Indicator 側に付くため、group で 2 種類の印を切り替えます。 */}
    <CheckboxPrimitive.Indicator className="group inline-flex items-center justify-center">
      <CheckIcon
        aria-hidden="true"
        className="size-3.5 group-data-[state=indeterminate]:hidden"
      />
      <DividerHorizontalIcon
        aria-hidden="true"
        className="hidden size-3.5 group-data-[state=indeterminate]:block"
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))

Checkbox.displayName = "Checkbox"
