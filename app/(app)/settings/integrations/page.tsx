'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

export default function IntegrationsPage() {
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const { confirm, confirmDialog } = useConfirm()

  async function disconnectGithub() {
    const approved = await confirm({
      title: 'Disconnect GitHub?',
      description: 'This revokes FixFlags access to your GitHub account.',
      confirmLabel: 'Disconnect',
      destructive: true,
    })
    if (!approved) return
    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/github/disconnect', { method: 'POST' })
      if (!response.ok) {
        toast.error((await parseApiErrorResponse(response)).message)
        return
      }
      setDisconnected(true)
      toast.success('GitHub disconnected')
    } catch {
      toast.error('Could not disconnect GitHub. Try again.')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Container variant="narrow" className="space-y-6 py-8">
      <PageHeader title="Connections" description="Repository scanning is currently unavailable." />
      <Surface variant="nested" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">GitHub access</h2>
          <p className="mt-1 text-sm text-muted-foreground">If you previously connected GitHub, you can revoke that access here.</p>
        </div>
        <Button type="button" variant="outline" onClick={disconnectGithub} loading={disconnecting} disabled={disconnected}>
          {disconnected ? 'Disconnected' : 'Disconnect GitHub'}
        </Button>
      </Surface>
      {confirmDialog}
    </Container>
  )
}
