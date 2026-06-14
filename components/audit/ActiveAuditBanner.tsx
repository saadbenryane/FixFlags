'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useActiveAudit } from '@/hooks/useActiveAudit'
import { auditHostname } from '@/lib/audit/active-audit'

export function ActiveAuditBanner() {
  const { active } = useActiveAudit()
  const pathname = usePathname()

  if (!active) return null
  if (pathname === `/audit/${active.auditId}`) return null

  const hostname = auditHostname(active.url)

  return (
    <div className="border-b bg-brand/5">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" aria-hidden />
        <span>
          Audit running for{' '}
          <span className="font-medium text-foreground">{hostname}</span>
        </span>
        <Link
          href={`/audit/${active.auditId}`}
          className="font-medium text-brand link-underline-grow"
        >
          Return to audit
        </Link>
      </div>
    </div>
  )
}
