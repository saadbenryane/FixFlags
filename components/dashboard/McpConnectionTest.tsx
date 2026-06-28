'use client'

import { useState } from 'react'
import { Loader2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'

interface Props {
  endpoint: string
  apiKey: string
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function McpConnectionTest({ endpoint, apiKey }: Props) {
  const [state, setState] = useState<TestState>('idle')
  const [toolCount, setToolCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  async function runTest() {
    setState('testing')
    setErrorMsg('')
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 'test-1' }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 401) {
        throw new Error('Invalid API key - create a new one and try again')
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const msg = text
          ? `Server returned HTTP ${res.status}: ${text.slice(0, 200)}`
          : `Server returned HTTP ${res.status}`
        throw new Error(msg)
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error.message || `MCP error code ${data.error.code}`)
      }

      const tools = data.result?.tools ?? []
      setToolCount(tools.length)
      setState('success')
    } catch (err) {
      setState('error')
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErrorMsg('Connection timed out. Check your endpoint URL.')
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Connection failed')
      }
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
        disabled={state === 'testing'}
        className="gap-1.5"
      >
        {state === 'testing' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        {state === 'testing' ? 'Testing...' : 'Test Connection'}
      </Button>

      {state === 'success' && (
        <Callout variant="success" title="Connected!" className="text-xs">
          <p>
            {toolCount > 0
              ? `Found ${toolCount} tools available.`
              : 'MCP server responded successfully.'}{' '}
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
