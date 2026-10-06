import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ApiKeyManager } from '@/components/settings/ApiKeyManager'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="min-h-11">
        <Link href="/settings"><ArrowLeft className="mr-2 h-4 w-4" /> Settings</Link>
      </Button>
      <PageHeader
        title="Developer keys"
        description="Choose what your tooling may do and when access expires. Every key can reach only Sites this account owns."
      />
      <Card>
        <CardHeader>
          <CardTitle>Create and revoke keys</CardTitle>
          <CardDescription>Keys can access only Sites owned by this account. A secret is shown once.</CardDescription>
        </CardHeader>
        <CardContent><ApiKeyManager /></CardContent>
      </Card>
    </div>
  )
}
