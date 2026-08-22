import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { joinClassNames } from "./class-names"

export type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  "defaultValue" | "onValueChange" | "value"
> & {
  defaultValue?: number
  formatValue?: (value: number) => string
  label: string
  onValueChange?: (value: number) => void
  showMarks?: boolean
  value?: number
}

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      defaultValue,
      disabled,
      formatValue = (currentValue) => String(currentValue),
      label,
      max = 100,
      min = 0,
      onValueChange,
      showMarks = false,
      step = 1,
      value,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const labelId = `bm-slider-${generatedId}-label`
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
      defaultValue ?? min
    )
    const currentValue = value ?? uncontrolledValue
    const marks = showMarks
      ? Array.from(
          { length: Math.floor((max - min) / step) + 1 },
          (_, index) => min + index * step
        )
      : []

    const handleValueChange = ([nextValue]: number[]) => {
      if (value === undefined) {
        setUncontrolledValue(nextValue)
      }
      onValueChange?.(nextValue)
    }

    return (
      <div
        className={joinClassNames(
          "inline-grid gap-3",
          disabled && "opacity-50",
          className
        )}
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-semibold" id={labelId}>
            {label}
          </span>
          <output
            aria-live="polite"
            className="min-w-8 rounded-bm-field bg-bm-ink px-2 py-1 text-center text-xs font-semibold text-bm-paper"
          >
            {formatValue(currentValue)}
          </output>
        </div>
        <SliderPrimitive.Root
          {...props}
          aria-labelledby={labelId}
          className="relative flex h-5 w-[140px] touch-none select-none items-center outline-none"
          defaultValue={value === undefined ? [defaultValue ?? min] : undefined}
          disabled={disabled}
          max={max}
          min={min}
          onValueChange={handleValueChange}
          ref={ref}
          step={step}
          value={value === undefined ? undefined : [value]}
        >
          <SliderPrimitive.Track className="relative h-[15px] grow overflow-hidden rounded-full bg-bm-control-muted">
            <SliderPrimitive.Range className="absolute h-full bg-bm-ink" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-labelledby={labelId}
            aria-valuetext={formatValue(currentValue)}
            className="block size-5 rounded-full border-2 border-bm-ink bg-bm-paper shadow-bm-control outline-none focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bm-paper"
          />
        </SliderPrimitive.Root>
        {showMarks ? (
          <div
            aria-hidden="true"
            className="flex w-[140px] justify-between text-[10px] text-bm-muted-text"
          >
            {marks.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
        ) : null}
      </div>
    )
  }
)

Slider.displayName = "Slider"
