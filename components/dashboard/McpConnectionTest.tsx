'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { MCP_TOOLS, inspectMcpToolReadiness } from '@/lib/mcp/tool-manifest'

interface Props {
  endpoint: string
  apiKey: string
  onConnectedChange?: (connected: boolean) => void
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function McpConnectionTest({ endpoint, apiKey, onConnectedChange }: Props) {
  const [state, setState] = useState<TestState>('idle')
  const [toolCount, setToolCount] = useState(0)
  const [optionalCount, setOptionalCount] = useState(0)
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
      const readiness = inspectMcpToolReadiness(tools.map((tool) => tool.name))
      if (!readiness.ready) {
        throw new Error(
          `Connected, but ${readiness.missingCore.length} Contract v1 core tools are unavailable. Try again before finishing setup.`
        )
      }
      const connection = await client.callTool({ name: MCP_TOOLS.getConnectionInfo.name, arguments: {} })
      const info = connection.structuredContent as { contractVersion?: unknown; ready?: unknown } | undefined
      if (info?.contractVersion !== readiness.contractVersion || info.ready !== true) {
        throw new Error('The server did not confirm Contract v1 readiness.')
      }
      setToolCount(tools.length)
      setOptionalCount(readiness.optional.filter((tool) => tool.available).length)
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
            Contract v1 is ready. Found {toolCount} tools, including {optionalCount} optional{' '}
            {optionalCount === 1 ? 'capability' : 'capabilities'}.
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
