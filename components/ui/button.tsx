import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 motion-reduce:transition-none motion-reduce:active:scale-100",
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

      },
      size: {
        default: "h-11 min-w-11 px-5",
        xs: "h-11 min-w-11 px-3 text-xs",
        sm: "h-11 min-w-11 px-4 text-sm",
        lg: "h-12 min-w-11 px-8",
        icon: "h-11 w-11 shrink-0",
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
    onClick,
    tabIndex,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    const content = loading && loadingLabel ? loadingLabel : children
    const isDisabled = Boolean(disabled || loading)

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          asChild && isDisabled && 'pointer-events-none',
          className
        )}
        ref={ref}
        disabled={asChild ? undefined : isDisabled}
        aria-disabled={asChild && isDisabled ? true : undefined}
        aria-busy={loading || undefined}
        tabIndex={asChild && isDisabled ? -1 : tabIndex}
        onClick={isDisabled ? undefined : onClick}
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
