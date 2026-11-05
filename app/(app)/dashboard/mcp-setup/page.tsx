import { McpSetup } from '@/components/settings/McpSetup'
import { isEditorIntegrationKey } from '@/lib/integrations/editor-catalog'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'
import { redirect } from 'next/navigation'

export default async function McpSetupPage({ searchParams }: {
  searchParams: Promise<{ builder?: string | string[] }>
}) {
  const { builder } = await searchParams
  const viewer = await getAppViewer()
  if (!viewer) redirect(signInUrl(await getRequestedPath('/dashboard/mcp-setup')))
  return <McpSetup key={viewer.user.id} ownerId={viewer.user.id} initialEditor={isEditorIntegrationKey(builder) ? builder : undefined} />
}
