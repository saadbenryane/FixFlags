import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[8px] whitespace-nowrap rounded-[var(--radius-control)] text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-[16px] [&_svg]:shrink-0 motion-reduce:transition-none motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-foreground/90 hover:shadow-md",
        brand:
          "bg-brand text-brand-foreground shadow-sm hover:bg-brand-hover hover:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "border border-border bg-background shadow-sm hover:bg-muted hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-link underline-offset-4 hover:text-link-hover hover:underline",
        ink: "bg-foreground text-background shadow-sm hover:bg-foreground/90",
        gradient:
          "border-0 bg-gradient-score-animated text-brand-foreground shadow-sm hover:brightness-110 hover:shadow-md motion-safe:hover:animate-gradient-shift motion-safe:focus-visible:animate-gradient-shift",
      },
      size: {
        default: "h-[44px] min-w-[44px] px-[20px]",
        xs: "h-[44px] min-w-[44px] px-[12px] text-xs",
        sm: "h-[44px] min-w-[44px] px-[16px] text-sm",
        lg: "h-[48px] min-w-[44px] px-[32px]",
        icon: "h-[44px] w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingLabel?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    children,
    className,
    variant,
    size,
    asChild = false,
    disabled,
    loading = false,
    loadingLabel,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    const content = loading && loadingLabel ? loadingLabel : children

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {asChild ? (
          loading && loadingLabel ? (
            <Slottable child={children}>{() => content}</Slottable>
          ) : (
            <Slottable>{content}</Slottable>
          )
        ) : (
          content
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
