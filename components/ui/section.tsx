import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionVariants = cva("", {
  variants: {
    spacing: {
      default: 'py-11 sm:py-14 lg:py-16',
      tight: 'py-8 sm:py-11 lg:py-14',
      compact: 'py-6 sm:py-8',
      /** Report-style marketing pages (samples) - minimal top chrome */
      report: 'pt-2 pb-6 sm:pt-3 sm:pb-8',
      loose: 'py-16 sm:py-20 lg:py-24',
      marketing: 'py-14 sm:py-20 lg:py-24',
    },
  },
  defaultVariants: {
    spacing: "default",
  },
})

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {}

export function Section({ className, spacing, ...props }: SectionProps) {
  return <section className={cn(sectionVariants({ spacing }), className)} {...props} />
}
