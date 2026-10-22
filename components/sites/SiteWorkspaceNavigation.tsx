import { Clock3, LayoutGrid, Plug, Settings2, type LucideIcon } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { useFixedBottomNotice } from '@/components/system/useFixedBottomNotice'
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
  const root = useRef<HTMLElement>(null)
  useFixedBottomNotice(root, mobile, -10)
  return <nav ref={root} aria-label={label} className={cn(mobile ? styles.mobileNavigation : styles.navigation, className, mobile && 'grid text-2xs')}>
    {SITE_ROUTES.filter(([id]) => id !== 'settings' || showSettings).map(([id, label, Icon]) => renderItem({ id, label, icon: Icon, selected: activeRoute === id,
      className: mobile ? cn('flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1 text-center text-2xs [overflow-wrap:anywhere]', activeRoute === id ? 'text-foreground' : 'text-muted-foreground') : cn(styles.navLink, activeRoute === id && styles.selected),
      content: <><Icon className="shrink-0" size={mobile ? 20 : 17} aria-hidden /><span className="min-w-0 max-w-full">{label}</span></>,
    }))}
  </nav>
}
