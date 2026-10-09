import { ApiKeyManager } from '@/components/settings/ApiKeyManager'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { API_KEY_COPY } from '@/lib/marketing/copy/terminology'

export default function ApiKeysPage() {
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
        <CardContent><ApiKeyManager /></CardContent>
      </Card>
    </div>
  )
}
