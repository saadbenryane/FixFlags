'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackEvent } from '@/lib/analytics/events'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'
import { useMe } from '@/hooks/useMe'
import { useSiteAction } from '@/hooks/useSiteAction'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'
import { httpsDestinationReceipt } from '@/lib/api/https-destination'
import { SiteActionError } from '@/lib/sites/client-actions'

interface Props {
  label?: string
}

export function ManageSubscriptionButton({ label = 'Manage subscription' }: Props) {
  const { user } = useMe()
  const { busy: loading, submit } = useSiteAction({ scope: `billing-portal:${user?.id ?? ''}` })

  async function handleClick() {
    const result = await submit(async signal => {
      let received: Awaited<ReturnType<typeof fetchJsonWithDeadline>>
      try { received = await fetchJsonWithDeadline('/api/stripe/portal', { method: 'POST', signal }) }
      catch { throw new SiteActionError(SYSTEM_COPY.errors.billingPortal) }
      const { response: res, body } = received
      if (!res.ok) {
        throw new SiteActionError((await parseApiErrorResponse(res, body)).message)
      }
      const destination = httpsDestinationReceipt.safeParse(body)
      if (!destination.success) throw new SiteActionError('The billing portal did not return a destination.')
      return destination.data.url
    }, url => {
      trackEvent('managed_subscription')
      window.location.assign(url)
      return null
    })
    if (result.kind === 'refused') toast.error(result.error.message)
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      loading={loading}
      disabled={!user}
      loadingLabel="Opening billing…"
    >
      {label}
    </Button>
  )
}
