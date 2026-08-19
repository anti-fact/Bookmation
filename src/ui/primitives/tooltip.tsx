// 短い操作名をホバーまたはキーボードフォーカスで補足する共通ツールチップです。
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
 * 各 Tooltip が Provider を持つため、IconButton を単独で配置しても表示できます。
 * Trigger の asChild は、受け取った button 自体へ Radix の操作を合成します。
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
      {/* Portal へ出して、親要素の overflow で説明が切れるのを避けます。 */}
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
