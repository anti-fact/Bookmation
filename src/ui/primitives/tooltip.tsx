import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export const TooltipProvider = TooltipPrimitive.Provider

export type TooltipProps = {
  children: React.ReactElement
  className?: string
  content: React.ReactNode
  delayDuration?: number
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"]
  sideOffset?: number
}

/**
 * A self-contained tooltip for terse controls. Each instance owns a provider so
 * primitives such as IconButton remain accessible when rendered in isolation.
 */
export const Tooltip = ({
  children,
  className,
  content,
  delayDuration = 300,
  side = "bottom",
  sideOffset = 8
}: TooltipProps) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className={joinClassNames(
            "z-bm-popover max-w-64 select-none rounded-bm-field bg-bm-panel px-3 py-2 text-center text-xs font-semibold leading-5 text-bm-on-panel shadow-bm-control",
            className
          )}
          collisionPadding={12}
          side={side}
          sideOffset={sideOffset}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-bm-panel" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
)
