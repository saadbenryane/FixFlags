'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Callout } from '@/components/ui/callout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Surface } from '@/components/ui/surface'
import { useMe } from '@/hooks/useMe'
import { McpConnectionTest } from '@/components/dashboard/McpConnectionTest'
import { McpToolMark } from '@/components/brand/EditorMarks'
import { buildMcpConfigExample, getMcpEndpoint } from '@/lib/mcp/docs-content'
import { SITE_URL } from '@/lib/marketing/copy'

type EditorKey = 'cursor' | 'claudeCode' | 'windsurf'
type VibecodingLevel = 'beginner' | 'regular' | 'advanced'

const ALL_EDITORS: { key: EditorKey; label: string }[] = [
  { key: 'cursor', label: 'Cursor' },
  { key: 'claudeCode', label: 'Claude Code' },
  { key: 'windsurf', label: 'Windsurf' },
]

const LEVELS: { key: VibecodingLevel; label: string }[] = [
  { key: 'beginner', label: 'New to AI coding tools' },
  { key: 'regular', label: 'Use them regularly' },
  { key: 'advanced', label: 'I know what I\'m doing' },
]

export default function McpSetupWizard() {
  const { refresh } = useMe()
  const [step, setStep] = useState(0)
  const [vibecodingLevel, setVibecodingLevel] = useState<VibecodingLevel | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creatingKey, setCreatingKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editor, setEditor] = useState<EditorKey | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)

  async function saveProfile() {
    setSavingProfile(true)
    try {
      await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vibecodingLevel: vibecodingLevel || undefined,
          preferredTools: editor ? [editor] : undefined,
        }),
      })
      await refresh()
    } catch {
      // non-blocking
    } finally {
      setSavingProfile(false)
    }
  }

  async function createApiKey() {
    setCreatingKey(true)
    setKeyError(null)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'PUT',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setKeyError(data.message || 'Could not create API key')
        return
      }
      const data = await res.json()
      setNewKey(data.key)
    } catch {
      setKeyError('Could not create the key. Try again.')
    } finally {
      setCreatingKey(false)
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleNext() {
    if (step === 0) {
      await saveProfile()
    }
    if (step < 2) {
      setStep((s) => s + 1)
    }
  }

  function canProceed(): boolean {
    if (step === 0) return vibecodingLevel !== null && editor !== null
    if (step === 1) return newKey !== null
    return true
  }

  if (step === 0) {
    return (
      <Container variant="narrow" className="py-8 space-y-8">
        <PageHeader
          title="Connect your AI coding tool"
          description="Tell us about your setup so we can show the right config for your editor."
        />
        <Surface variant="nested" className="space-y-6 sm:p-6">
          <div className="space-y-3">
            <p className="text-sm font-medium">What&apos;s your experience with AI coding tools?</p>
            <div className="space-y-2">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setVibecodingLevel(l.key)}
                  className={`w-full text-left rounded-card p-3 text-sm transition-[box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ${
                    vibecodingLevel === l.key
                      ? 'bg-brand/5 ring-2 ring-brand/20 shadow-glass'
                      : 'glass-surface hover:bg-[var(--glass-bg)]'
                  }`}
                >
                  <span className="font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Which editor do you use with MCP?</p>
            <div className="space-y-2">
              {ALL_EDITORS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => setEditor(e.key)}
                  className={`w-full text-left rounded-card p-4 transition-[box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ${
                    editor === e.key
                      ? 'bg-brand/5 ring-2 ring-brand/20 shadow-glass'
                      : 'glass-surface hover:bg-[var(--glass-bg)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <McpToolMark toolKey={e.key} className="h-5 w-5 shrink-0 text-brand" />
                    <span className="font-medium">{e.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Skip</Link>
            </Button>
            <Button size="sm" onClick={handleNext} disabled={savingProfile || !vibecodingLevel || !editor}>
              {savingProfile ? 'Saving...' : 'Continue'}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </Surface>
      </Container>
    )
  }

  if (step === 1) {
    return (
      <Container variant="narrow" className="py-8 space-y-8">
        <PageHeader
          title="Create an API key"
          description="This key lets your editor talk to FixFlags. Copy it now - you won't see it again."
        />
        <Surface variant="nested" className="space-y-6 sm:p-6">
          {!newKey ? (
            <>
              <Button onClick={createApiKey} disabled={creatingKey} size="lg" className="w-full">
                {creatingKey ? 'Creating...' : 'Create API Key'}
              </Button>
              {keyError && (
                <p className="text-xs text-destructive text-center">{keyError}</p>
              )}
            </>
          ) : (
            <>
              <Callout variant="success" title="Key created">
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 break-all rounded border bg-background px-3 py-2 font-mono text-xs">
                    {newKey}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyKey(newKey)}
                    aria-label="Copy API Key"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </Callout>
            </>
          )}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <Button size="sm" onClick={handleNext} disabled={!canProceed()}>
              {newKey ? 'Continue' : 'Skip'}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </Surface>
      </Container>
    )
  }

  const endpoint = getMcpEndpoint(SITE_URL)
  const config = editor ? buildMcpConfigExample(editor, SITE_URL) : ''
  const editorLabel = ALL_EDITORS.find((e) => e.key === editor)?.label ?? 'your editor'

  return (
    <Container variant="narrow" className="py-8 space-y-8">
      <PageHeader
        title="Configure your editor"
        description={`Paste this into your ${editorLabel} config file.`}
      />

      <Surface variant="nested" className="space-y-6 sm:p-6">
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Step 1: Copy this config
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-card bg-muted/40 p-4 font-mono text-xs">
            <code>{config}</code>
          </pre>
          <Button
            size="icon"
            variant="outline"
            className="absolute right-2 top-2"
            onClick={async () => {
              await navigator.clipboard.writeText(config)
            }}
            aria-label="Copy config"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Step 2: Verify with curl
        </p>
        <pre className="overflow-x-auto rounded-card bg-muted/40 p-4 font-mono text-xs">
          <code>{`curl -s -X POST "${endpoint}" \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: ${newKey ?? '$FF_API_KEY'}" \\\n  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`}</code>
        </pre>
      </div>

      {newKey && (
        <McpConnectionTest endpoint={endpoint} apiKey={newKey} />
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <Button asChild size="sm">
          <Link href="/dashboard">
            Done, go to dashboard
            <CheckCircle className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
      </Surface>

      <p className="text-center text-xs text-muted-foreground">
        Need help?{' '}
        <Link href="/docs/mcp" className="underline underline-offset-2 hover:text-foreground">
          Full MCP docs
        </Link>
        <span className="mx-1.5">·</span>
        <Link href="/settings/api-keys" className="underline underline-offset-2 hover:text-foreground">
          Manage API keys
        </Link>
      </p>
    </Container>
  )
}
