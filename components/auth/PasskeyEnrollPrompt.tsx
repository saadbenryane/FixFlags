'use client'

import { useState } from 'react'
import { Fingerprint, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'

interface Props {
  onComplete: () => void
}

export function PasskeyEnrollPrompt({ onComplete }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    setBusy(true)
    try {
      const { error } = await authClient.passkey.addPasskey()
      if (error) {
        toast.error(error.message || AUTH.passkeyEnroll.createError)
        setBusy(false)
        return
      }
      toast.success(AUTH.passkeyEnroll.success)
      onComplete()
    } catch {
      toast.error(AUTH.passkeyEnroll.createFailed)
      setBusy(false)
    }
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

export async function shouldShowPasskeyEnroll(): Promise<boolean> {
  try {
    if (
      typeof PublicKeyCredential === 'undefined' ||
      typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function'
    ) {
      return false
    }
    const available = await PublicKeyCredential.isConditionalMediationAvailable()
    if (!available) return false
    const { data } = await authClient.passkey.listUserPasskeys()
    const passkeys = (data as { id: string }[]) ?? []
    return passkeys.length === 0
  } catch {
    return false
  }
}
