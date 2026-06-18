'use client'

import Link from 'next/link'
import { useMe } from '@/hooks/useMe'
import { Button } from '@/components/ui/button'

export function McpApiKeyLink() {
  const { user } = useMe()
  const href = user ? '/settings/api-keys' : '/sign-in?next=/settings/api-keys'

  return (
    <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
      <Link href={href}>Get API Key</Link>
    </Button>
  )
}
