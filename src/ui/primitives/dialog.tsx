// Radix Dialog に Bookmation 共通の見た目と閉じる操作を付けるファイルです。
import { Cross2Icon } from "@radix-ui/react-icons"
import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

// 開閉状態・フォーカス移動・Esc キー処理は Radix 側に任せ、その機能をそのまま公開します。
export const Dialog = DialogPrimitive.Root
export const DialogClose = DialogPrimitive.Close
export const DialogTrigger = DialogPrimitive.Trigger

// Portal によりオーバーレイとモーダルを document.body 側へ移し、画面内の重なりに埋もれにくくします。
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    closeLabel?: string
    showClose?: boolean
  }
>(
  (
    { children, className, closeLabel = "閉じる", showClose = true, ...props },
    ref
  ) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-bm-dialog bg-[var(--bm-color-overlay)] data-[state=open]:animate-bm-overlay-in" />
      <DialogPrimitive.Content
        {...props}
        className={joinClassNames(
          "fixed left-1/2 top-1/2 z-bm-dialog max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),51.125rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-6 text-bm-ink outline-none data-[state=open]:animate-bm-dialog-in sm:p-8",
          className
        )}
        ref={ref}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <button
              aria-label={closeLabel}
              className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border-2 border-transparent text-bm-ink outline-none hover:border-bm-ink hover:bg-bm-accent focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
              type="button"
            >
              <Cross2Icon aria-hidden="true" className="size-5" />
            </button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
)

DialogContent.displayName = "DialogContent"

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={joinClassNames("mb-6 space-y-2 pr-12", className)}
  />
)

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    {...props}
    className={joinClassNames("m-0 text-xl font-bold", className)}
    ref={ref}
  />
))

DialogTitle.displayName = "DialogTitle"

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    {...props}
    className={joinClassNames(
      "m-0 text-sm leading-6 text-bm-muted-text",
      className
    )}
    ref={ref}
  />
))

DialogDescription.displayName = "DialogDescription"

export const DialogFooter = ({
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
