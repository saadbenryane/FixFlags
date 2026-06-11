import * as React from "react"
import { cn } from "@/lib/utils"

type HeadingLevel = "h1" | "h2" | "h3" | "h4"

const headingStyles: Record<HeadingLevel, string> = {
  h1: "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl",
  h2: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
  h3: "text-xl sm:text-2xl md:text-3xl",
  h4: "text-lg sm:text-xl md:text-2xl",
}

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel
}

export function Heading({ as: Tag = "h2", className, ...props }: HeadingProps) {
  return (
    <Tag
      className={cn("font-bold tracking-tight", headingStyles[Tag], className)}
      {...props}
    />
  )
}

export function Body({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-base sm:text-lg text-foreground", className)} {...props} />
  )
}

export function Muted({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs sm:text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export function Prose({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("max-w-3xl text-base sm:text-lg text-foreground", className)}
      {...props}
    />
  )
}
