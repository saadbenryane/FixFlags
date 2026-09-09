import * as React from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type TextLinkProps = {
  className?: string
  children: React.ReactNode
  variant?: 'default' | 'brand'
} & (
  | ({ href: string } & Omit<
      React.ComponentPropsWithoutRef<typeof Link>,
      'className' | 'children' | 'href'
    >)
  | ({ href?: undefined } & Omit<
      React.ComponentPropsWithoutRef<'a'>,
      'className' | 'children' | 'href'
    >)
)

const linkClassName =
  'inline-flex max-w-full flex-wrap items-center gap-1 transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm'

const variantClassName = {
  default: 'text-link hover:text-link-hover',
  brand: 'font-medium text-brand hover:text-brand-hover underline-offset-4 hover:underline',
} as const

export function TextLink({ className, children, href, variant = 'default', ...props }: TextLinkProps) {
  const classes = cn(linkClassName, variantClassName[variant], className)

  if (href) {
    return (
      <Link href={href as Route} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <a className={classes} {...props}>
      {children}
    </a>
  )
}
