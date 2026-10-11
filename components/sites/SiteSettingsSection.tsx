import type { ComponentProps } from 'react'
import { Surface } from '@/components/ui/surface'

export function SiteSettingsSection({ children, ...props }: ComponentProps<'section'>) {
  return <section {...props}><Surface variant="solid">{children}</Surface></section>
}
