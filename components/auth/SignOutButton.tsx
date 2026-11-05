'use client'
import { Button } from '@/components/ui/button'
import { useSignOut } from '@/hooks/useSignOut'
import { AUTH } from '@/lib/marketing/copy/auth'

export function SignOutButton() {
  const { busy, signOut } = useSignOut()

  return (
    <Button variant="ghost" size="sm" loading={busy} onClick={() => void signOut()} className="text-muted-foreground">
      {busy ? AUTH.signOut.working : AUTH.signOut.cta}
    </Button>
  )
}
