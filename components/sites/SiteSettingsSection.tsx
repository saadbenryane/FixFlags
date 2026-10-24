import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import styles from './SiteSettingsSection.module.css'

export function SiteSettingsSection({ children, className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn(styles.section, className)}>{children}</section>
}
