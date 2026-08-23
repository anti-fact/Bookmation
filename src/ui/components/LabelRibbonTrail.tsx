import { Cross2Icon } from "@radix-ui/react-icons"
import * as React from "react"

import { joinClassNames } from "~/ui/primitives/class-names"

export const LABEL_RIBBON_CLIP_PATH =
  "polygon(0 0, calc(100% - 29px) 0, 100% 50%, calc(100% - 29px) 100%, 0 100%, 29px 50%)"

export const LABEL_RIBBON_SEGMENT_CLASS =
  "inline-flex h-[63px] shrink-0 items-center bg-bm-black pl-[41px] pr-[41px] text-2xl font-bold leading-none text-bm-paper sm:text-3xl"

type LabelRibbonTrailProps = {
  className?: string
  items: ReadonlyArray<{ id: string; label: string }>
  onRemove?: (id: string) => void
}

export function LabelRibbonTrail({
  className,
  items,
  onRemove
}: LabelRibbonTrailProps) {
  return (
    <ol
      aria-label="現在の絞り込み"
      className={joinClassNames(
        "isolate m-0 flex min-w-0 max-w-full list-none overflow-x-auto p-0",
        className
      )}
    >
      {items.map(({ id, label }, index) => (
        <li
          className={joinClassNames(
            LABEL_RIBBON_SEGMENT_CLASS,
            onRemove
              ? "group relative transition-colors hover:bg-bm-ink hover:text-bm-paper focus-within:bg-bm-ink focus-within:text-bm-paper"
              : "",
            index > 0 ? "-ml-[15px]" : ""
          )}
          key={id}
          style={{
            clipPath: LABEL_RIBBON_CLIP_PATH,
            zIndex: index + 1
          }}
        >
          <span
            className={joinClassNames(
              "whitespace-nowrap transition-opacity",
              onRemove
                ? "group-hover:opacity-20 group-focus-within:opacity-20"
                : ""
            )}
          >
            #{label}
          </span>
          {onRemove ? (
            <button
              aria-label={`「${label}」の絞り込みを解除`}
              className="absolute left-1/2 top-1/2 z-10 inline-flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-bm-border bg-bm-paper text-bm-ink opacity-0 shadow-bm-control outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-on-panel"
              onClick={() => onRemove(id)}
              type="button"
            >
              <Cross2Icon aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
