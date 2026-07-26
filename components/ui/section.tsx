import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionVariants = cva("", {
  variants: {
    spacing: {
      default: 'py-[var(--space-section-default)]',
      tight: 'py-8 sm:py-11 lg:py-14',
      compact: 'py-6 sm:py-8',
      /** Homepage hero fold. Keep this authoritative; pages do not add padding overrides. */
      hero: 'pt-[var(--space-hero-start)] pb-[var(--space-hero-end)]',
      /** Report-style marketing pages (samples) - minimal top chrome */
      report: 'pt-2 pb-6 sm:pt-3 sm:pb-8',
      loose: 'py-16 sm:py-20 lg:py-24',
      marketing: 'py-[var(--space-section-marketing)]',
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
