'use client'

import { AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { URL_PLACEHOLDER } from '@/lib/marketing/copy'

interface ToolUrlFormProps {
  url: string
  onUrlChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  error: string
  ctaLabel: string
  loadingLabel: string
}

export function ToolUrlForm({
  url,
  onUrlChange,
  onSubmit,
  loading,
  error,
  ctaLabel,
  loadingLabel,
}: ToolUrlFormProps) {
  return (
    <Card variant="strong" className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="text"
          inputMode="url"
          placeholder={URL_PLACEHOLDER}
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={loading}
          className="flex-1 text-base"
          aria-label="Website URL"
        />
        <Button
          type="submit"
          loading={loading}
          loadingLabel={loadingLabel}
          className="shrink-0 gap-2"
        >
          <Search className="h-4 w-4" /> {ctaLabel}
        </Button>
      </form>
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden /> {error}
        </p>
      )}
    </Card>
  )
}
