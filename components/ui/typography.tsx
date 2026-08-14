import * as React from 'react'
import { cn } from '@/lib/utils'

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'

const headingStyles: Record<HeadingLevel, string> = {
  h1: 'text-3xl sm:text-4xl lg:text-5xl',
  h2: 'text-2xl sm:text-[1.75rem] md:text-[2rem]',
  h3: 'text-xl md:text-[1.25rem]',
  h4: 'text-lg md:text-xl',
}

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel
}

export function PageTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        'font-sans text-[1.625rem] font-medium leading-heading tracking-heading text-balance sm:text-[2rem]',
        className
      )}
      {...props}
    >
      {children}
    </h1>
  )
}

export function Heading({ as: Tag = 'h2', className, ...props }: HeadingProps) {
  const isDisplay = Tag === 'h1' || Tag === 'h2'
  return (
    <Tag
      className={cn(
        isDisplay
          ? 'font-sans font-semibold leading-display tracking-display text-balance'
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
        'max-w-prose text-base leading-body tracking-body text-pretty text-foreground',
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
        'max-w-prose text-base leading-relaxed tracking-body text-pretty text-foreground',
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
        'font-mono text-2xs font-medium uppercase tracking-label text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

/** In-page section heading (dashboard lists, admin groups) */
export function SectionTitle({
  as: Tag = 'h2',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' }) {
  return (
    <Tag
      className={cn(
        'text-sm font-semibold leading-heading tracking-heading text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}
