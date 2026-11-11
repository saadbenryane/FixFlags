import { Clock3, Files, LayoutGrid, Plug, Settings2, type LucideIcon } from 'lucide-react'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { useRef, type ReactNode } from 'react'
import { useFixedBottomNotice } from '@/components/system/useFixedBottomNotice'
import styles from './SiteShell.module.css'
import { cn } from '@/lib/utils'

export type SiteRoute = 'home' | 'pages' | 'timeline' | 'integrations' | 'settings'

export const SITE_ROUTES = [
  ['home', SITE_WORKSPACE_COPY.navigation.home, LayoutGrid],
  ['pages', SITE_WORKSPACE_COPY.navigation.pages, Files],
  ['timeline', SITE_WORKSPACE_COPY.navigation.timeline, Clock3],
  ['integrations', SITE_WORKSPACE_COPY.navigation.integrations, Plug],
  ['settings', SITE_WORKSPACE_COPY.navigation.settings, Settings2],
] as const

export function SiteWorkspaceNavigation({ activeRoute, label, showSettings = true, mobile = false, className, renderItem, foldIntegrations = false }: {
  activeRoute: SiteRoute; label: string; showSettings?: boolean; mobile?: boolean; className?: string;
  /** While only one integration is live, owners find it in Settings rather than a separate tab. */
  foldIntegrations?: boolean;
  renderItem: (item: { id: SiteRoute; label: string; selected: boolean; className: string; content: ReactNode; icon: LucideIcon }) => ReactNode;
}) {
  const folded = foldIntegrations && showSettings
  const root = useRef<HTMLElement>(null)
  useFixedBottomNotice(root, mobile, -10)
  return <nav ref={root} aria-label={label} className={cn(mobile ? styles.mobileNavigation : styles.navigation, className, mobile && 'grid text-2xs')}>
    {SITE_ROUTES.filter(([id]) => (id !== 'settings' || showSettings) && !(id === 'integrations' && folded)).map(([id, label, Icon]) => { const selected = activeRoute === id || (folded && id === 'settings' && activeRoute === 'integrations'); return renderItem({ id, label, icon: Icon, selected,
      className: mobile ? cn('flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1 text-center text-2xs [overflow-wrap:anywhere]', selected ? 'text-foreground' : 'text-muted-foreground') : cn(styles.navLink, selected && styles.selected),
      content: <><Icon className="shrink-0" size={mobile ? 20 : 17} aria-hidden /><span className="min-w-0 max-w-full">{label}</span></>,
    }) })}
  </nav>
}
