/**
 * 各画面で共通の背景・メイン領域・見出しを提供し、
 * ページ全体をひとつのスクロール領域として保つ土台です。
 */
import * as React from "react"

import { joinClassNames } from "~/ui/primitives/class-names"

export type AppShellProps = React.PropsWithChildren<{
  description?: string
  eyebrow?: string
  header?: React.ReactNode
  heading: string
  headingRef?: React.Ref<HTMLHeadingElement>
  tone?: "accent" | "paper"
}>

export function AppShell({
  children,
  description,
  eyebrow,
  header,
  heading,
  headingRef,
  tone = "paper"
}: AppShellProps) {
  // h1は通常のTab順へ加えず、ルート変更時だけコードからフォーカスできるようにします。
  return (
    <div
      className={joinClassNames(
        "min-h-dvh overflow-x-clip text-bm-ink",
        tone === "accent" ? "bg-bm-accent" : "bg-bm-paper"
      )}
    >
      {header}
      <main
        className="mx-auto w-full max-w-[90rem] px-4 pb-16 pt-8 sm:px-8 lg:px-[4.5rem] lg:pt-12"
        id="main-content"
      >
        <header className="max-w-4xl">
          {eyebrow ? (
            <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-bm-muted-text">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="mb-0 mt-2 scroll-mt-64 rounded-bm-field text-2xl font-bold outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-4 sm:text-3xl lg:scroll-mt-32"
            ref={headingRef}
            tabIndex={-1}
          >
            {heading}
          </h1>
          {description ? (
            <p className="mb-0 mt-3 max-w-3xl text-sm leading-6 text-bm-muted-text sm:text-base">
              {description}
            </p>
          ) : null}
        </header>
        {children ? <div className="mt-8">{children}</div> : null}
      </main>
    </div>
  )
}
