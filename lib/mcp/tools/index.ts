import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { User } from '@prisma/client'
import { registerConnectionInfoTool } from '@/lib/mcp/contract'
import { registerSiteOutcomeTools } from '@/lib/mcp/tools/sites'

export { assertAuditAccess } from '@/lib/mcp/access'

export function registerAllTools(
  server: McpServer,
  user: User | null,
  options?: { signal?: AbortSignal }
) {
  registerConnectionInfoTool(server, Boolean(user))
  if (!user) return
  void options
  registerSiteOutcomeTools(server, user)
}

export async function validateApiKey(key: string | null) {
  const { prisma } = await import('../../db')
  const { hashApiKey } = await import('../../security/api-keys')

  if (!key) return null
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    include: { user: true },
  })
  if (!apiKey || apiKey.revokedAt) return null
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) return null
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } })
  return {
    user: apiKey.user,
    apiKey: {
      id: apiKey.id,
      client: apiKey.client,
      scopes: apiKey.scopes,
      audience: apiKey.audience,
    },
  }
}
