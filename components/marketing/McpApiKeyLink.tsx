'use client'

import Link from 'next/link'
import { useMe } from '@/hooks/useMe'
import { Button } from '@/components/ui/button'

export function McpApiKeyLink() {
  const { user } = useMe()
  const href = user ? '/settings/api-keys' : '/sign-in?next=/settings/api-keys'

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>Get API key</Link>
    </Button>
  )
}
