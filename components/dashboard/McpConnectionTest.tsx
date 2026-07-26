'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

interface Props {
  endpoint: string
  apiKey: string
  onConnectedChange?: (connected: boolean) => void
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function McpConnectionTest({ endpoint, apiKey, onConnectedChange }: Props) {
  const [state, setState] = useState<TestState>('idle')
  const [toolCount, setToolCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  async function runTest() {
    setState('testing')
    onConnectedChange?.(false)
    setErrorMsg('')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    let client: Client | null = null
    try {
      const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        },
      })
      client = new Client({ name: 'fixflags-connection-test', version: '1.0.0' })
      await client.connect(transport)
      const { tools } = await client.listTools()
      const discovered = new Set(tools.map((tool) => tool.name))
      const missing = MCP_TOOL_DEFINITIONS
        .map((tool) => tool.name)
        .filter((name) => !discovered.has(name))
      if (missing.length > 0) {
        throw new Error(
          `Connected, but ${missing.length} FixFlags tools are unavailable. Try again before finishing setup.`
        )
      }
      setToolCount(tools.length)
      setState('success')
      onConnectedChange?.(true)
    } catch (err) {
      setState('error')
      onConnectedChange?.(false)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErrorMsg('Connection timed out. Check your endpoint URL.')
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Connection failed')
      }
    } finally {
      clearTimeout(timer)
      await client?.close().catch(() => undefined)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Step 3: Test your connection
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={runTest}
        loading={state === 'testing'}
        loadingLabel="Testing…"
        className="gap-1.5"
      >
        {state !== 'testing' && (
          <Zap className="h-3.5 w-3.5" />
        )}
        Test connection
      </Button>

      {state === 'success' && (
        <Callout variant="success" title="Connected!" className="text-xs">
          <p>
            {`Found all ${toolCount} FixFlags tools.`}{' '}
            Your editor is ready to run FixFlags checks.
          </p>
        </Callout>
      )}

      {state === 'error' && (
        <Callout variant="danger" title="Connection failed" className="text-xs">
          <p className="font-mono break-all">{errorMsg}</p>
          <p className="mt-1">
            Make sure your endpoint URL and API key are correct, then try again.
          </p>
        </Callout>
      )}
    </div>
  )
}
