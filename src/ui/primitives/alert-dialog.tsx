// 取り消せない操作を明示確認するための共通警告ダイアログです。
import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

// 開閉状態、Esc キー、フォーカス移動は Radix に任せます。
export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogCancel = AlertDialogPrimitive.Cancel
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

// 通常の Dialog と区別できるよう、危険色の枠を持つ alertdialog として表示します。
export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ children, className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-bm-dialog bg-[var(--bm-color-overlay)] data-[state=open]:animate-bm-overlay-in" />
    <AlertDialogPrimitive.Content
      {...props}
      className={joinClassNames(
        "fixed left-1/2 top-1/2 z-bm-dialog max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-bm-dialog border-2 border-bm-danger bg-bm-paper p-6 text-bm-ink outline-none data-[state=open]:animate-bm-dialog-in sm:p-8",
        className
      )}
      ref={ref}
    >
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPrimitive.Portal>
))

AlertDialogContent.displayName = "AlertDialogContent"

export const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={joinClassNames("mb-6 space-y-2", className)} />
)

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    {...props}
    className={joinClassNames("m-0 text-xl font-bold", className)}
    ref={ref}
  />
))

AlertDialogTitle.displayName = "AlertDialogTitle"

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    {...props}
    className={joinClassNames(
      "m-0 text-sm leading-6 text-bm-muted-text",
      className
    )}
    ref={ref}
  />
))

AlertDialogDescription.displayName = "AlertDialogDescription"

export const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={joinClassNames(
      "mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:justify-end",
      className
    )}
  />
)
