'use client'

import { Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SiteActionError } from '@/lib/sites/client-actions'
import { withClientDeadline } from '@/lib/api/client-request'
import { passkeyCreatedReceipt, passkeyListReceipt } from '@/lib/auth/client-passkey-receipt'

interface Props {
  onComplete: () => void
  ownerId: string | null
}

export function PasskeyEnrollPrompt({ onComplete, ownerId }: Props) {
  const { busy, submit } = useSiteAction({ scope: JSON.stringify(['passkey-enrollment', ownerId]) })

  async function handleCreate() {
    if (!ownerId) return
    const completion = await submit(async signal => {
      try {
        // Start inside the gesture. The authenticator owns native ceremony timing.
        const result = await authClient.passkey.addPasskey({ fetchOptions: { signal } })
        const saved = passkeyCreatedReceipt.safeParse(result?.data)
        if (result?.error || !saved.success) throw new SiteActionError(result?.error?.message || AUTH.passkeyEnroll.createError)
        return saved.data
      } catch (error) {
        throw error instanceof SiteActionError ? error : new SiteActionError(AUTH.passkeyEnroll.createFailed)
      }
    }, () => {
      toast.success(AUTH.passkeyEnroll.success)
      onComplete()
      return null
    })
    if (completion.kind === 'refused') toast.error(completion.error.message)
  }

  return (
    <Card className="border-0 p-5 shadow-card">
      <div className="space-y-4 text-center">
        <Fingerprint className="mx-auto h-8 w-8 text-brand" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{AUTH.passkeyEnroll.title}</p>
          <p className="text-sm text-muted-foreground">{AUTH.passkeyEnroll.body}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() => void handleCreate()}
            loading={busy}
            disabled={!ownerId}
            loadingLabel={AUTH.passkeyEnroll.cta}
            className="min-h-11"
          >
            {!busy && (
              <Fingerprint className="mr-2 h-4 w-4" />
            )}
            {AUTH.passkeyEnroll.cta}
          </Button>
          <Button variant="ghost" onClick={onComplete} disabled={busy} className="min-h-11">
            {AUTH.passkeyEnroll.skip}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export async function shouldShowPasskeyEnroll(parent?: AbortSignal): Promise<boolean> {
  try {
    return await withClientDeadline(async signal => {
      if (typeof PublicKeyCredential === 'undefined' || typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function') return false
      const available = await PublicKeyCredential.isConditionalMediationAvailable()
      if (!available || signal.aborted) return false
      const result = await authClient.passkey.listUserPasskeys({ fetchOptions: { signal } })
      const passkeys = passkeyListReceipt.safeParse(result?.data)
      return !signal.aborted && !result?.error && passkeys.success && passkeys.data.length === 0
    }, parent, 15_000)
  } catch {
    return false
  }
}
