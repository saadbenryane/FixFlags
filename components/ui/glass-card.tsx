import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const glassCardVariants = cva("rounded-card border border-border/50", {
  variants: {
    variant: {
      subtle: "bg-[var(--glass-bg-subtle)]",
      medium: "bg-[var(--glass-bg)]",
      strong: "bg-[var(--glass-bg-strong)]",
    },
    elevated: {
      true: "bg-[var(--glass-bg-elevated)]",
      false: "",
    },
    shadow: {
      true: "shadow-card",
      false: "",
    },
  },
  defaultVariants: {
    variant: "medium",
    elevated: false,
    shadow: true,
  },
})

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  blur?: number
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, elevated, shadow, blur = 24, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(glassCardVariants({ variant, elevated, shadow }), className)}
      style={{
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        ...style,
      }}
      {...props}
    />
  )
)
GlassCard.displayName = "GlassCard"

export { GlassCard, glassCardVariants }
