'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { displayHostname, parsePageLabel } from '@/lib/utils/url-helpers'

export interface JourneyPage {
  id: string
  url: string
  title: string | null
  role: string
  position: number
  flagCount: number
  criticalCount: number
  importantCount: number
}

interface JourneyBarProps {
  pages: JourneyPage[]
  totalFlags: number
  auditId?: string
  primaryUrl?: string
  className?: string
}

const ROLE_LABELS: Record<string, string> = {
  primary: 'Homepage',
  pricing: 'Pricing',
  'primary-cta': 'Signup',
  features: 'Features',
  'secondary-cta': 'CTA Dest',
  trust: 'About',
  resources: 'Resources',
  'pricing-or-plan': 'Pricing',
}

function roleLabel(role: string, url: string): string {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role]
  const label = parsePageLabel(url)
  if (label) return label.charAt(0).toUpperCase() + label.slice(1)
  return role
}

function dotColor(page: JourneyPage): string {
  if (page.criticalCount > 0) return 'bg-destructive'
  if (page.importantCount > 0) return 'bg-brand'
  return 'bg-success'
}

export function JourneyBar({ pages, totalFlags, auditId, primaryUrl, className }: JourneyBarProps) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)

  if (pages.length <= 1) return null

  async function handleScanDeeper() {
    if (!primaryUrl || scanning) return
    setScanning(true)
    try {
      const res = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: primaryUrl,
          parentId: auditId,
          mode: 'critical_path',
        }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      const data = await res.json()
      router.push(`/report/${data.reportId}`)
    } catch {
      toast.error('Could not start the deeper scan. Try again.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div id="report-journey" className={cn('scroll-mt-[var(--header-offset)] space-y-3', className)}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-mono uppercase tracking-label text-muted-foreground">
          Conversion flow
        </p>
        <span className="text-xs text-muted-foreground">
          {pages.length} pages scanned &middot; {totalFlags} flag{totalFlags !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-0">
        {pages.map((page, i) => (
          <div key={page.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_2px_currentColor]',
                    dotColor(page)
                  )}
                  style={{ color: 'hsl(var(--background))' }}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">
                  {roleLabel(page.role, page.url)}
                </span>
                {page.flagCount > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-3xs font-mono tabular-nums text-muted-foreground">
                    {page.flagCount}
                  </span>
                )}
              </div>
              <span className="max-w-[120px] truncate text-3xs text-muted-foreground sm:max-w-[180px]">
                {displayHostname(page.url)}
              </span>
            </div>

            {i < pages.length - 1 && (
              <svg
                className="mx-3 h-4 w-4 shrink-0 text-muted-foreground/40"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <path
                  d="M6 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        ))}

        {primaryUrl && (
          <>
            <svg
              className="mx-3 h-4 w-4 shrink-0 text-muted-foreground/40"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={handleScanDeeper}
              disabled={scanning}
            >
              {scanning ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <ArrowRight className="mr-1.5 h-3 w-3" />
              )}
              Scan deeper
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
