import { Suspense } from 'react'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { AdminInbox } from '@/components/admin/AdminInbox'

export default function AdminInboxPage() {
  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader title="Inbox" description="Live chat sessions from public visitors." />
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading inbox…</div>}>
        <AdminInbox />
      </Suspense>
    </Container>
  )
}
