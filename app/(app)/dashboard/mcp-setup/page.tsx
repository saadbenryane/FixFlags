import { McpSetup } from '@/components/settings/McpSetup'
import { isEditorIntegrationKey } from '@/lib/integrations/editor-catalog'

export default async function McpSetupPage({ searchParams }: {
  searchParams: Promise<{ builder?: string | string[] }>
}) {
  const { builder } = await searchParams
  return <McpSetup initialEditor={isEditorIntegrationKey(builder) ? builder : undefined} />
}
