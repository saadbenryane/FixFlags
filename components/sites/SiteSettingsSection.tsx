import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import styles from './SiteSettingsSection.module.css'

export function SiteSettingsSection({ children, className, id, tabIndex = id ? -1 : undefined, ...props }: ComponentProps<'section'>) {
  return <section {...props} id={id} tabIndex={tabIndex} className={cn(styles.section, className)}>{children}</section>
}
