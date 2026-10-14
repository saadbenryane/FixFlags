'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'

/** A contextual invitation. Reading evidence never opens an account modal. */
export function SiteSignupPrompt({ siteId, checking, paused = false }: {
  siteId: string; auditId: string | null; checking: boolean; paused?: boolean
}) {
  const { user, isLoading, error } = useMe()
  if (user || isLoading || error || checking || paused) return null
  const next = encodeURIComponent(`/sites/${siteId}`)
  return <section className="space-y-3 rounded-card bg-muted/20 p-5" aria-labelledby="save-site-heading">
    <h2 id="save-site-heading" className="text-base font-semibold">{C.signupPrompt.title}</h2>
    <p className="text-sm text-muted-foreground">{C.signupPrompt.body}</p>
    <div className="flex flex-wrap gap-3">
      <Button asChild><Link href={`/sign-up?next=${next}`}>{C.access.save}</Link></Button>
    </div>
  </section>
}
