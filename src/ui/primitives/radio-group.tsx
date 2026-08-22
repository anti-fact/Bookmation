import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    {...props}
    className={joinClassNames("flex", className)}
    ref={ref}
  />
))

RadioGroup.displayName = "RadioGroup"

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    {...props}
    className={joinClassNames(
      "inline-flex select-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper disabled:cursor-not-allowed disabled:opacity-45",
      className
    )}
    ref={ref}
  />
))

RadioGroupItem.displayName = "RadioGroupItem"
