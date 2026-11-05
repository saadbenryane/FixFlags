import { ApiKeyManager } from '@/components/settings/ApiKeyManager'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { API_KEY_COPY } from '@/lib/marketing/copy/terminology'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'
import { redirect } from 'next/navigation'

export default async function ApiKeysPage() {
  const viewer = await getAppViewer()
  if (!viewer) redirect(signInUrl(await getRequestedPath('/settings/api-keys')))
  return (
    <div className="space-y-6">
      <PageHeader
        title={API_KEY_COPY.title}
        description={API_KEY_COPY.description}
      />
      <Card>
        <CardHeader>
          <CardTitle>{API_KEY_COPY.createTitle}</CardTitle>
          <CardDescription>{API_KEY_COPY.createDescription}</CardDescription>
        </CardHeader>
        <CardContent><ApiKeyManager ownerId={viewer.user.id} /></CardContent>
      </Card>
    </div>
  )
}
