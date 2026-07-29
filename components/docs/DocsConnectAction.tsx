'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { useMe } from '@/hooks/useMe'
import { Button } from '@/components/ui/button'
import {
  getEditorIntegration,
  type EditorIntegrationKey,
} from '@/lib/integrations/editor-catalog'
import { buildEditorSetupPath } from '@/lib/integrations/editor-config'

export function DocsConnectAction({ editorKey }: { editorKey: EditorIntegrationKey }) {
  const { user, isLoading } = useMe()
  const editor = getEditorIntegration(editorKey)
  const setupPath = buildEditorSetupPath(editorKey)
  const href: Route = user
    ? setupPath
    : (`/sign-in?next=${encodeURIComponent(setupPath)}` as Route)
  const requiresUpgrade = Boolean(user && !user.entitlements.canUseMcp)

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Button variant="brand" asChild disabled={isLoading}>
        <Link href={href}>
          {requiresUpgrade ? <LockKeyhole aria-hidden /> : null}
          {requiresUpgrade ? `Upgrade to connect ${editor.label}` : `Connect ${editor.label}`}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
      {requiresUpgrade ? (
        <span className="text-xs text-muted-foreground">MCP connection is included with Pro.</span>
      ) : null}
    </div>
  )
}
