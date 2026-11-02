'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { Textarea } from '@/components/ui/textarea'
import { ApiKeyManager } from './ApiKeyManager'
import { EDITOR_INTEGRATIONS, getEditorIntegration, type EditorIntegrationKey } from '@/lib/integrations/editor-catalog'
import { buildEditorMcpConfiguration } from '@/lib/integrations/editor-config'
import { MCP_SETUP_COPY as C } from '@/lib/marketing/copy/mcp-setup'

function CopyableText({ label, value }: { label: string; value: string }) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [message, setMessage] = useState('')
  async function copy() {
    try { await navigator.clipboard.writeText(value); setMessage(C.copied) }
    catch { input.current?.focus(); input.current?.select(); setMessage(C.manualCopy) }
  }
  return <div className="space-y-2">
    <Textarea ref={input} readOnly aria-label={label} value={value} rows={Math.min(14, value.split('\n').length + 2)}
      onFocus={event => event.currentTarget.select()} className="font-mono text-xs leading-relaxed" />
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={() => void copy()} aria-label={`${C.copy} ${label}`}>{C.copy}</Button>
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
}

export function McpSetup({ initialEditor = 'cursor' }: { initialEditor?: EditorIntegrationKey }) {
  const [editorKey, setEditorKey] = useState(initialEditor)
  const editor = getEditorIntegration(editorKey)
  const config = buildEditorMcpConfiguration(editorKey)
  return <div className="mx-auto max-w-3xl space-y-7 px-5 py-8 sm:px-8">
    <PageHeader title={C.title} description={C.description} />
    <label htmlFor="mcp-editor" className="block space-y-2 text-sm font-medium">
      {C.editor}
      <InteractiveSelect id="mcp-editor" value={editorKey} onChange={event => setEditorKey(event.currentTarget.value as EditorIntegrationKey)}
        className="flex h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm">
        {EDITOR_INTEGRATIONS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </InteractiveSelect>
    </label>
    <Card>
      <CardHeader><CardTitle as="h2">{C.keyTitle}</CardTitle><CardDescription>{C.keyDescription}</CardDescription></CardHeader>
      <CardContent><ApiKeyManager client={editor.apiKeyClient} headingAs="h3" /></CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle as="h2">{C.configTitle}</CardTitle><CardDescription>{C.configDescription}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">{config.location}</p>
        <CopyableText key={editorKey} label={C.configLabel} value={config.value} />
        <p className="text-sm text-muted-foreground">{config.credentialMode === 'environment' ? C.environment(editor.label) : C.placeholder}</p>
        {editor.setupMode === 'hosted-connector' ? <p className="text-sm text-muted-foreground">{C.hosted}</p> : null}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle as="h2">{C.verifyTitle}</CardTitle><CardDescription>{C.verifyDescription}</CardDescription></CardHeader>
      <CardContent><CopyableText label={C.verifyLabel} value={C.verifyPrompt} /></CardContent>
    </Card>
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{C.workTitle}</h2>
      <p className="text-sm text-muted-foreground">{C.workDescription}</p>
      <p className="text-sm text-muted-foreground">{C.workDetail}</p>
      <p className="text-sm text-muted-foreground">{C.privacy}</p>
    </section>
    <details className="rounded-card bg-muted p-5">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">{C.troubleshooting}</summary>
      <ul className="space-y-3 text-sm text-muted-foreground">{C.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>
    </details>
    <Button asChild variant="outline"><Link href="/docs/mcp">{C.guide}</Link></Button>
  </div>
}
