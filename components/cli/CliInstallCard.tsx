'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

interface Release {
  available: boolean
  version: string
  tag: 'beta' | 'latest'
}

export function CliInstallCard() {
  const [release, setRelease] = useState<Release | null>(null)
  const [copied, setCopied] = useState<'install' | 'skill' | null>(null)

  useEffect(() => {
    void fetch('/api/cli/release')
      .then((response) => response.json())
      .then((value: Release) => setRelease(value))
      .catch(() => setRelease(null))
  }, [])

  const command = release?.available
    ? `npm install --global fixflags@${release.version}`
    : null
  async function copy(value: string, target: 'install' | 'skill') {
    await navigator.clipboard.writeText(value)
    setCopied(target)
    window.setTimeout(() => setCopied(null), 1800)
  }

  return (
    <Surface variant="nested" className="space-y-4">
      <div>
        <h3 className="font-semibold">Connect FixFlags</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Install the CLI, connect your editor, then check your deployed product.
        </p>
      </div>
      {command ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-[var(--radius-control)] bg-muted/50 px-3 py-3 text-xs">
            {command}
          </code>
          <Button
            size="icon"
            variant="outline"
            aria-label="Copy CLI install command"
            onClick={() => void copy(command, 'install')}
          >
            {copied === 'install' ? <Check /> : <Copy />}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {release
            ? `CLI ${release.version} is awaiting its verified npm release.`
            : 'Checking the npm release'}
        </p>
      )}
      <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
        <li>Run <code>fixflags login</code>.</li>
        <li>Run <code>fixflags init https://your-product.com</code>.</li>
        <li>Run <code>fixflags check https://your-product.com --wait --plan</code>.</li>
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" asChild>
          <a href="/.well-known/skills/fixflags/SKILL.md" download>
            <Download aria-hidden />
            Download customer skill
          </a>
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void copy(
              `${window.location.origin}/.well-known/skills/fixflags/SKILL.md`,
              'skill'
            )
          }
        >
          {copied === 'skill' ? <Check aria-hidden /> : <Copy aria-hidden />}
          Copy skill URL
        </Button>
      </div>
    </Surface>
  )
}
