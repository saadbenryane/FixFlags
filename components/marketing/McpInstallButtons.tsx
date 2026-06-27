'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { buildCursorInstallLink, buildVscodeInstallLink } from '@/lib/mcp/deeplinks'
import { SITE_URL } from '@/lib/marketing/copy'

/**
 * Mints a fresh API key just-in-time rather than embedding a long-lived key in a
 * clickable link, which would otherwise land in shell/browser history or clipboard
 * managers - same trust boundary as the existing manual copy-paste MCP config flow.
 */
async function mintMcpKeyAndBuildLink(build: (apiKey: string) => string): Promise<string> {
  const res = await fetch('/api/api-keys', { method: 'PUT' })
  if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)
  const data = await res.json()
  return build(data.key)
}

export function McpInstallButtons() {
  const { user } = useMe()
  const router = useRouter()
  const [loading, setLoading] = useState<'cursor' | 'vscode' | null>(null)

  async function handleInstall(editor: 'cursor' | 'vscode') {
    if (!user) {
      router.push('/sign-in?next=/docs/mcp')
      return
    }

    setLoading(editor)
    try {
      const link = await mintMcpKeyAndBuildLink((apiKey) =>
        editor === 'cursor'
          ? buildCursorInstallLink({ baseUrl: SITE_URL, apiKey })
          : buildVscodeInstallLink({ baseUrl: SITE_URL, apiKey })
      )
      window.location.href = link
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate an install link')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <Button
        size="sm"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={loading !== null}
        onClick={() => handleInstall('cursor')}
      >
        Add to Cursor
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={loading !== null}
        onClick={() => handleInstall('vscode')}
      >
        Add to VS Code
      </Button>
    </div>
  )
}
