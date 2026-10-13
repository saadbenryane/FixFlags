"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer group/checkbox flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-sm border border-input group-data-[state=checked]/checkbox:bg-primary group-data-[state=checked]/checkbox:text-primary-foreground group-data-[state=indeterminate]/checkbox:bg-primary group-data-[state=indeterminate]/checkbox:text-primary-foreground">
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
