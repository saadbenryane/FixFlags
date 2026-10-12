import { Clock3, LayoutGrid, Plug, Settings2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './SiteShell.module.css'
import { cn } from '@/lib/utils'

export type SiteRoute = 'home' | 'timeline' | 'integrations' | 'settings'

export const SITE_ROUTES = [
  ['home', 'Overview', LayoutGrid],
  ['timeline', 'Timeline', Clock3],
  ['integrations', 'Integrations', Plug],
  ['settings', 'Settings', Settings2],
] as const

export function SiteWorkspaceNavigation({ activeRoute, label, showSettings = true, mobile = false, className, renderItem }: {
  activeRoute: SiteRoute; label: string; showSettings?: boolean; mobile?: boolean; className?: string;
  renderItem: (item: { id: SiteRoute; label: string; selected: boolean; className: string; content: ReactNode; icon: LucideIcon }) => ReactNode;
}) {
  return <nav aria-label={label} className={cn(mobile ? undefined : styles.navigation, className)}>
    {SITE_ROUTES.filter(([id]) => id !== 'settings' || showSettings).map(([id, label, Icon]) => renderItem({ id, label, icon: Icon, selected: activeRoute === id,
      className: mobile ? cn('flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-2xs', activeRoute === id ? 'text-foreground' : 'text-muted-foreground') : cn(styles.navLink, activeRoute === id && styles.selected),
      content: <><Icon size={mobile ? 20 : 17} aria-hidden /><span>{label}</span></>,
    }))}
  </nav>
}
