// 見出しをクリックして中身を開閉する共通アコーディオンです。
// 高さのアニメーションを効かせるため、余白は AccordionContent の子要素側に付けます。
import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export const Accordion = AccordionPrimitive.Root

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    {...props}
    className={joinClassNames("min-w-0", className)}
    ref={ref}
  />
))

AccordionItem.displayName = "AccordionItem"

export type AccordionTriggerProps = React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> & {
  headerClassName?: string
}

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({ className, headerClassName, ...props }, ref) => (
  <AccordionPrimitive.Header
    className={joinClassNames("m-0 flex font-normal", headerClassName)}
  >
    <AccordionPrimitive.Trigger
      {...props}
      className={joinClassNames(
        "flex w-full items-center gap-3 bg-transparent text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper disabled:cursor-not-allowed disabled:opacity-45",
        className
      )}
      ref={ref}
    />
  </AccordionPrimitive.Header>
))

AccordionTrigger.displayName = "AccordionTrigger"

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Content
    {...props}
    className={joinClassNames(
      "overflow-hidden data-[state=closed]:animate-bm-accordion-up data-[state=open]:animate-bm-accordion-down",
      className
    )}
    ref={ref}
  />
))

AccordionContent.displayName = "AccordionContent"
