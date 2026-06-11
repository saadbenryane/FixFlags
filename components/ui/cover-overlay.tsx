import * as React from "react"
import { cn } from "@/lib/utils"

export interface CoverOverlayProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  imageSrc: string
  imageAlt?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  aspectRatio?: string
  variant?: "card" | "hero"
  interactive?: boolean
}

export function CoverOverlay({
  imageSrc,
  imageAlt = "",
  title,
  subtitle,
  aspectRatio = "1600/1508",
  variant = "card",
  interactive = true,
  className,
  children,
  ...props
}: CoverOverlayProps) {
  const isHero = variant === "hero"

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-card shadow-card transition-all duration-300",
        interactive &&
          "hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 motion-reduce:transition-none",
        isHero
          ? "min-h-[21.6rem] sm:min-h-[20rem] md:min-h-[24.2rem] lg:min-h-[28.6rem] rounded-2xl"
          : "",
        className
      )}
      style={!isHero ? { aspectRatio } : undefined}
      {...props}
    >
      <img
        src={imageSrc}
        alt={imageAlt}
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 motion-reduce:transition-none",
          interactive && "group-hover:scale-105 motion-reduce:group-hover:scale-100"
        )}
      />

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--cover-gradient)" }}
      />

      {/* Content */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col justify-end text-foreground",
          isHero
            ? "ps-5 pb-5 sm:ps-7 sm:pb-7 lg:ps-8 lg:pb-8"
            : "p-5 sm:p-6"
        )}
      >
        <h3
          className={cn(
            "font-bold tracking-tight",
            isHero
              ? "text-[1.53rem] sm:text-[1.91rem] md:text-[1.61rem] lg:text-[2.14rem] max-w-full md:max-w-[75%]"
              : "text-[1.3rem] sm:text-[1.6rem] md:text-[1.3rem]"
          )}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  )
}
