import * as React from 'react'
import { cn } from '@/lib/utils'

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'

const headingStyles: Record<HeadingLevel, string> = {
  h1: 'text-[2rem] sm:text-[2.625rem] md:text-[2.875rem] lg:text-[3.25rem] xl:text-[3.5rem]',
  h2: 'text-[1.75rem] sm:text-[1.875rem] md:text-[2.125rem] lg:text-[2.375rem]',
  h3: 'text-xl sm:text-[1.375rem] md:text-2xl',
  h4: 'text-lg sm:text-xl',
}

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel
}

export function PageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        'font-display text-[1.625rem] font-normal leading-heading tracking-heading text-balance sm:text-[1.875rem]',
        className
      )}
      {...props}
    />
  )
}

export function Heading({ as: Tag = 'h2', className, ...props }: HeadingProps) {
  const isDisplay = Tag === 'h1' || Tag === 'h2'
  return (
    <Tag
      className={cn(
        isDisplay
          ? 'font-display font-normal leading-display tracking-display text-balance'
          : 'font-sans font-semibold leading-heading tracking-heading text-balance',
        headingStyles[Tag],
        className
      )}
      {...props}
    />
  )
}

export function Lead({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'max-w-prose text-lg sm:text-xl leading-body tracking-body text-pretty text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

export function Body({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'max-w-prose text-base sm:text-lg leading-body tracking-body text-pretty text-foreground',
        className
      )}
      {...props}
    />
  )
}

export function Muted({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-sm leading-[1.45] tracking-body text-pretty text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

export function Prose({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'max-w-prose text-base sm:text-lg leading-relaxed tracking-body text-pretty text-foreground',
        className
      )}
      {...props}
    />
  )
}

export function LabelCaps({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'font-mono text-[11px] uppercase tracking-label text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

/** In-page section heading (dashboard lists, admin groups) */
export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-sm font-semibold leading-heading tracking-heading text-foreground',
        className
      )}
      {...props}
    />
  )
}
