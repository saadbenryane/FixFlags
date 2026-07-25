import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionVariants = cva("", {
  variants: {
    spacing: {
      default: 'py-11 sm:py-14 lg:py-16',
      tight: 'py-8 sm:py-11 lg:py-14',
      compact: 'py-6 sm:py-8',
      /** Homepage hero fold, one coherent rhythm (no compact + override stack) */
      hero: 'pt-4 pb-5 sm:pt-5 sm:pb-6 lg:pt-6 lg:pb-8',
      /** Report-style marketing pages (samples) - minimal top chrome */
      report: 'pt-2 pb-6 sm:pt-3 sm:pb-8',
      loose: 'py-16 sm:py-20 lg:py-24',
      /** ~40% tighter than prior py-14/20/24 rhythm */
      marketing: 'py-8 sm:py-12 lg:py-14',
    },
    tint: {
      none: '',
      subtle: 'bg-muted/20',
    },
  },
  defaultVariants: {
    spacing: "default",
    tint: "none",
  },
})

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {}

export function Section({ className, spacing, tint, ...props }: SectionProps) {
  return <section className={cn(sectionVariants({ spacing, tint }), className)} {...props} />
}
