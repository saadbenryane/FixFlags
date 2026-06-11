import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionVariants = cva("", {
  variants: {
    spacing: {
      default: "py-16 sm:py-20 lg:py-24",
      tight: "py-12 sm:py-16 lg:py-20",
      compact: "py-8 sm:py-12",
      loose: "py-24 sm:py-28 lg:py-32",
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
