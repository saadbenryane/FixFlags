import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type TextLinkProps = {
  className?: string
  children: React.ReactNode
} & (
  | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className' | 'children'>)
  | ({ href?: undefined } & Omit<React.ComponentPropsWithoutRef<'a'>, 'className' | 'children'>)
)

const linkClassName =
  'inline-flex items-center gap-1 text-link transition-colors duration-200 ease-out hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm'

export function TextLink({ className, children, href, ...props }: TextLinkProps) {
  if (href) {
    return (
      <Link href={href} className={cn(linkClassName, className)} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <a className={cn(linkClassName, className)} {...props}>
      {children}
    </a>
  )
}
