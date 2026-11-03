'use client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const { authClient } = await import('@/lib/auth-client')
    const result = await authClient.signOut()
    if (result.error) return
    const { clearSettingsDrafts } = await import('@/lib/settings/drafts')
    clearSettingsDrafts()
    router.push('/')
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
      Sign out
    </Button>
  )
}
