import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { User } from '@prisma/client'
import { registerTaskTools } from '@/lib/mcp/task-tools'
import { registerCheckStatusTools } from './check-status'
import { registerFlagTools } from './flags'
import { registerCompareTools } from './compare'
import { registerRepoScanTools } from './repo-scan'
import { registerPromptGeneratorTools } from './prompt-generator'

export { assertAuditAccess } from '@/lib/mcp/access'

export function registerAllTools(
  server: McpServer,
  user: User,
  options?: { signal?: AbortSignal }
) {
  registerTaskTools(server, user, options)
  registerCheckStatusTools(server, user)
  registerFlagTools(server, user)
  registerCompareTools(server, user)
  registerRepoScanTools(server, user)
  registerPromptGeneratorTools(server, user)
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
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } })
  return {
    user: apiKey.user,
    apiKey: {
      id: apiKey.id,
      client: apiKey.client,
    },
  }
}
