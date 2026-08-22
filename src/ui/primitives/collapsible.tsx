import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"

export const Collapsible = CollapsiblePrimitive.Root

export const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>
>((props, ref) => <CollapsiblePrimitive.Trigger {...props} ref={ref} />)

CollapsibleTrigger.displayName = "CollapsibleTrigger"

export const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>((props, ref) => <CollapsiblePrimitive.Content {...props} ref={ref} />)

CollapsibleContent.displayName = "CollapsibleContent"
