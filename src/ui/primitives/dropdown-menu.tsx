// Radix DropdownMenu を、Bookmation共通の重なり順と選択状態で使うための薄いwrapperです。
import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ align = "start", className, sideOffset = -2, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      {...props}
      align={align}
      className={joinClassNames(
        "z-bm-popover min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-[5px] border-2 border-bm-border bg-bm-accent text-bm-ink shadow-bm-header",
        className
      )}
      ref={ref}
      sideOffset={sideOffset}
    />
  </DropdownMenuPrimitive.Portal>
))

DropdownMenuContent.displayName = "DropdownMenuContent"

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    {...props}
    className={joinClassNames(
      "flex min-h-10 select-none items-center justify-center px-4 text-xl font-bold outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-bm-ink data-[highlighted]:text-bm-paper",
      className
    )}
    ref={ref}
  />
))

DropdownMenuItem.displayName = "DropdownMenuItem"
