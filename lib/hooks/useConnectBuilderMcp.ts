'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useMe } from '@/hooks/useMe'
import { createApiKey } from '@/lib/api/api-key-client'
import { buildCursorInstallLink } from '@/lib/mcp/deeplinks'
import { SITE_URL } from '@/lib/marketing/copy'
import {
  apiKeyClientForTool,
  getBuilder,
  isPromptToolKey,
  type PromptToolKey,
} from '@/lib/mcp/builders'

/**
 * Shared "Connect {builder} to FixFlags" flow used by both `PromptActionRow`
 * and `MarkdownPromptBox`. Resolves the active builder from a tool key and
 * runs the sign-in redirect / cursor install link.
 */
export function useConnectBuilderMcp(tool?: string) {
  const { user } = useMe()
  const [installing, setInstalling] = useState(false)

  const actionTool: PromptToolKey =
    tool && isPromptToolKey(tool) && tool !== 'universal' ? tool : 'cursor'
  const actionBuilder = getBuilder(actionTool)

  async function connect() {
    const setupPath = `/dashboard/mcp-setup?builder=${actionBuilder.apiKeyClient ?? actionTool}`
    if (!user) {
      window.location.href = `/sign-in?next=${encodeURIComponent(setupPath)}`
      return
    }

    if (actionTool !== 'cursor') {
      window.location.href = setupPath
      return
    }

    setInstalling(true)
    try {
      const data = await createApiKey({
        name: `${actionBuilder.label} MCP`,
        client: apiKeyClientForTool(actionTool),
      })
      window.location.href = buildCursorInstallLink({ baseUrl: SITE_URL, apiKey: data.key })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not connect to ${actionBuilder.label}`)
    } finally {
      setInstalling(false)
    }
  }

  return { installing, connect, actionBuilder, actionTool }
}
