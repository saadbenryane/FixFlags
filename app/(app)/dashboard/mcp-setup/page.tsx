'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, CheckCircle, Copy, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Callout } from '@/components/ui/callout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Surface } from '@/components/ui/surface'
import { useMe } from '@/hooks/useMe'
import { McpConnectionTest } from '@/components/dashboard/McpConnectionTest'
import { McpToolMark } from '@/components/brand/EditorMarks'
import { SITE_URL, URL_PLACEHOLDER } from '@/lib/marketing/copy'
import { createApiKey as createApiKeyRequest } from '@/lib/api/api-key-client'
import {
  EDITOR_INTEGRATIONS,
  getEditorIntegration,
  isEditorIntegrationKey,
  type EditorIntegrationKey,
} from '@/lib/integrations/editor-catalog'
import {
  buildEditorMcpConfiguration,
  buildMcpTestCurl,
  getMcpEndpoint,
} from '@/lib/integrations/editor-config'

type SetupClient = EditorIntegrationKey | 'other'

const OTHER_CLIENT = {
  key: 'other' as const,
  label: 'Other MCP client',
  setupMode: 'hosted-connector' as const,
  setupLocation: 'Your client’s custom MCP server settings',
  apiKeyClient: 'other' as const,
}

function safeReturnTo(value: string | null): Route {
  return value?.startsWith('/docs/') ? (value as Route) : '/dashboard'
}

export default function McpSetupWizard() {
  const { user, isLoading, refresh } = useMe()
  const [step, setStep] = useState(0)
  const [productUrl, setProductUrl] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creatingKey, setCreatingKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editor, setEditor] = useState<SetupClient | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [returnTo, setReturnTo] = useState<Route>('/dashboard')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('builder')
    if (isEditorIntegrationKey(requested) || requested === 'other') setEditor(requested)
    setReturnTo(safeReturnTo(params.get('returnTo')))
  }, [])

  const selectedEditor = useMemo(
    () => (editor === 'other' ? OTHER_CLIENT : editor ? getEditorIntegration(editor) : null),
    [editor]
  )

  async function saveProfile(): Promise<boolean> {
    if (editor === 'other') return true
    setSavingProfile(true)
    setProfileError(null)
    try {
      const response = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredTools: editor ? [editor] : undefined }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || 'Could not save your editor preference')
      }
      await refresh()
      return true
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your editor preference')
      return false
    } finally {
      setSavingProfile(false)
    }
  }

  async function createApiKey() {
    setCreatingKey(true)
    setKeyError(null)
    try {
      if (!selectedEditor) throw new Error('Choose an editor before creating a key')
      const data = await createApiKeyRequest({
        name: `${selectedEditor.label} MCP`,
        client: selectedEditor.apiKeyClient,
      })
      setNewKey(data.key)
      setConnected(false)
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : 'Could not create the key. Try again.')
    } finally {
      setCreatingKey(false)
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function handleNext() {
    if (step === 0 && !(await saveProfile())) return
    if (step < 2) setStep((current) => current + 1)
  }

  function validProductUrl() {
    try {
      return ['http:', 'https:'].includes(new URL(productUrl).protocol)
    } catch {
      return false
    }
  }

  if (isLoading) {
    return <Container variant="narrow" className="py-16 text-sm text-muted-foreground">Loading setup…</Container>
  }

  if (user && !user.entitlements.canUseMcp) {
    return (
      <Container variant="narrow" className="space-y-8 py-12">
        <PageHeader
          title="Connect FixFlags"
          description="MCP connection and editor credentials are included with Pro."
        />
        <Surface variant="nested" className="space-y-5 sm:p-6">
          <LockKeyhole className="h-7 w-7 text-brand" aria-hidden />
          <p className="leading-7 text-muted-foreground">
            The public setup guide is available now. Upgrade when you are ready to create a key
            and test the connection.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="brand" asChild>
              <Link href={`/pricing?next=${encodeURIComponent('/dashboard/mcp-setup')}`}>
                View Pro
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={returnTo}>Return to the guide</Link>
            </Button>
          </div>
        </Surface>
      </Container>
    )
  }

  if (step === 0) {
    return (
      <Container variant="narrow" className="space-y-8 py-8">
        <PageHeader
          title="Connect FixFlags"
          description="Choose the live product and editor. We will create one scoped credential and verify tool discovery."
        />
        <Surface variant="nested" className="space-y-6 sm:p-6">
          <div className="space-y-3">
            <label htmlFor="product-url" className="text-sm font-medium">Product URL</label>
            <input
              id="product-url"
              type="url"
              inputMode="url"
              value={productUrl}
              onChange={(event) => setProductUrl(event.target.value)}
              placeholder={URL_PLACEHOLDER}
              className="h-12 w-full rounded-[var(--radius-control)] border border-input bg-background px-4 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-focus-ring"
              required
            />
            <p className="text-xs text-muted-foreground">Use the deployed URL your customers can open.</p>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Editor</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {EDITOR_INTEGRATIONS.map((candidate) => (
                <button
                  key={candidate.key}
                  type="button"
                  onClick={() => {
                    setEditor(candidate.key)
                    setNewKey(null)
                    setConnected(false)
                  }}
                  aria-pressed={editor === candidate.key}
                  className={`min-h-14 rounded-[var(--radius-control)] px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    editor === candidate.key
                      ? 'bg-brand/10 text-foreground ring-1 ring-brand/30'
                      : 'bg-muted/45 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <McpToolMark toolKey={candidate.key} className="h-5 w-5 shrink-0 text-brand" />
                    <span className="font-medium">{candidate.label}</span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEditor('other')
                  setNewKey(null)
                  setConnected(false)
                }}
                aria-pressed={editor === 'other'}
                className={`min-h-14 rounded-[var(--radius-control)] px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  editor === 'other'
                    ? 'bg-brand/10 text-foreground ring-1 ring-brand/30'
                    : 'bg-muted/45 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <McpToolMark toolKey="other" className="h-5 w-5 shrink-0 text-brand" />
                  <span className="font-medium">Other MCP client</span>
                </span>
              </button>
            </div>
          </fieldset>
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" asChild><Link href={returnTo}>Cancel</Link></Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={savingProfile || !editor || !validProductUrl()}
              loading={savingProfile}
              loadingLabel="Saving"
            >
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
          {profileError ? <p className="text-center text-xs text-destructive" role="alert">{profileError}</p> : null}
        </Surface>
      </Container>
    )
  }

  if (step === 1) {
    return (
      <Container variant="narrow" className="space-y-8 py-8">
        <PageHeader
          title={`Create the ${selectedEditor?.label ?? 'editor'} credential`}
          description="The key is revealed once. Keep it in the editor's secret store and never commit it."
        />
        <Surface variant="nested" className="space-y-6 sm:p-6">
          {!newKey ? (
            <Button
              onClick={createApiKey}
              loading={creatingKey}
              loadingLabel="Creating"
              size="lg"
              className="w-full"
            >
              Create editor credential
            </Button>
          ) : (
            <Callout variant="success" title="Key created">
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded border bg-background px-3 py-2 font-mono text-xs">{newKey}</code>
                <Button size="icon" variant="outline" onClick={() => copyValue(newKey)} aria-label="Copy API key">
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </Callout>
          )}
          {keyError ? <p className="text-center text-xs text-destructive" role="alert">{keyError}</p> : null}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
            <Button size="sm" onClick={handleNext} disabled={!newKey}>
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </Surface>
      </Container>
    )
  }

  const endpoint = getMcpEndpoint(SITE_URL)
  const configuration =
    editor && newKey
      ? editor === 'other'
        ? {
            label: 'Custom MCP server',
            location: OTHER_CLIENT.setupLocation,
            value: `Name: FixFlags\nURL: ${endpoint}\nTransport: Streamable HTTP\nAuthorization: Bearer ${newKey}\n`,
          }
        : buildEditorMcpConfiguration(editor, SITE_URL, newKey)
      : null

  return (
    <Container variant="narrow" className="space-y-8 py-8">
      <PageHeader
        title={`Configure ${selectedEditor?.label ?? 'your editor'}`}
        description={
          selectedEditor?.setupMode === 'hosted-connector'
            ? `Add FixFlags in ${selectedEditor.label}'s hosted connector settings.`
            : `Add FixFlags at ${selectedEditor?.setupLocation ?? 'the editor MCP configuration'}.`
        }
      />
      <Surface variant="nested" className="space-y-7 sm:p-6">
        {configuration ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{configuration.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{configuration.location}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyValue(configuration.value)}
              >
                {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--radius-card)] bg-muted/55 p-4 font-mono text-xs leading-6">
              <code>{configuration.value}</code>
            </pre>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-semibold">Optional terminal connection test</p>
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--radius-card)] bg-muted/55 p-4 font-mono text-xs leading-6">
            <code>{buildMcpTestCurl(SITE_URL)}</code>
          </pre>
        </div>

        {newKey ? (
          <McpConnectionTest endpoint={endpoint} apiKey={newKey} onConnectedChange={setConnected} />
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-semibold">First workflow</p>
          <pre className="whitespace-pre-wrap rounded-[var(--radius-card)] bg-muted/55 p-4 font-mono text-xs leading-6">
            <code>{`Check ${productUrl} and build a Finish Plan. Validate the highest-ranked Flag against its evidence. After I deploy the fix, run an update review and compare it with the original report.`}</code>
          </pre>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          {connected ? (
            <Button asChild size="sm">
              <Link href={returnTo}>
                Done <CheckCircle className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled>Complete connection test</Button>
          )}
        </div>
      </Surface>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/docs/integrations" className="underline underline-offset-2 hover:text-foreground">Integration guide</Link>
        <span className="mx-1.5">·</span>
        <Link href="/settings/api-keys" className="underline underline-offset-2 hover:text-foreground">Manage API keys</Link>
      </p>
    </Container>
  )
}
