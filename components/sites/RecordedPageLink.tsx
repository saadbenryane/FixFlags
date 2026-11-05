import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { parseWebsiteAddress } from '@/lib/utils/website-address'

/** Visit the recorded address. Its live page remains separate from saved evidence. */
export function RecordedPageLink({ url, children = url, className }: { url: string; children?: ReactNode; className?: string }) {
  const address = parseWebsiteAddress(url)
  if (!address.ok) return <span>{children}</span>
  return <a className={className} href={address.url} target="_blank" rel="noopener noreferrer" aria-label={C.open(url)} title={url}>
    <span className="min-w-0">{children}</span><ExternalLink size={12} className="shrink-0" aria-hidden />
  </a>
}
