'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        throw new Error('Invalid API key — create a new one and try again')
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
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950/30">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="text-xs text-green-800 dark:text-green-300">
            <p className="font-medium">Connected!</p>
            <p>
              {toolCount > 0
                ? `Found ${toolCount} tools available.`
                : 'MCP server responded successfully.'}{' '}
              Your editor is ready to run FixFlags checks.
            </p>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-xs text-red-800 dark:text-red-300">
            <p className="font-medium">Connection failed</p>
            <p className="font-mono break-all">{errorMsg}</p>
            <p className="mt-1">
              Make sure your endpoint URL and API key are correct, then try again.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
