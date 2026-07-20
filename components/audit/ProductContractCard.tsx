'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ProductContract } from '@/lib/audit/product-contract'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface ProductContractCardProps {
  contract: ProductContract
  auditId?: string
  canEdit?: boolean
  className?: string
}

export function ProductContractCard({
  contract: initial,
  auditId,
  canEdit = false,
  className,
}: ProductContractCardProps) {
  const [contract, setContract] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [purpose, setPurpose] = useState(initial.purpose)
  const [firstValueJourney, setFirstValueJourney] = useState(initial.firstValueJourney)
  const [outcomesText, setOutcomesText] = useState(initial.criticalOutcomes.join('\n'))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setPurpose(contract.purpose)
    setFirstValueJourney(contract.firstValueJourney)
    setOutcomesText(contract.criticalOutcomes.join('\n'))
    setError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    if (!auditId) return
    setSaving(true)
    setError(null)
    const criticalOutcomes = outcomesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    try {
      const res = await fetch(`/api/reports/${auditId}/product-contract`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, firstValueJourney, criticalOutcomes }),
      })
      const data = (await res.json().catch(() => null)) as
        | { productContract?: ProductContract; error?: string; message?: string }
        | null
      if (!res.ok) {
        setError(data?.error || data?.message || 'Could not save product contract')
        return
      }
      if (data?.productContract) {
        setContract(data.productContract)
      } else {
        setContract({
          purpose: purpose.trim(),
          firstValueJourney: firstValueJourney.trim(),
          criticalOutcomes,
          inferredAt: new Date().toISOString(),
          source: 'user',
        })
      }
      setEditing(false)
    } catch {
      setError('Could not save product contract')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className={cn('rounded-card bg-card/60 px-5 py-4 shadow-card glass-surface', className)}
      aria-labelledby="product-contract-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {REPORT_COPY.sectionTitles.productContract}
            {contract.source === 'user' ? ' · edited' : ' · inferred'}
          </p>
          <h2 id="product-contract-heading" className="mt-1 font-serif text-lg text-foreground">
            {REPORT_COPY.sectionTitles.productContractHeading}
          </h2>
        </div>
        {canEdit && auditId && !editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={startEdit}>
            Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contract-purpose">Purpose</Label>
            <Textarea
              id="contract-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              maxLength={280}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract-journey">First-value journey</Label>
            <Input
              id="contract-journey"
              value={firstValueJourney}
              onChange={(e) => setFirstValueJourney(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract-outcomes">Critical outcomes (one per line, 1–5)</Label>
            <Textarea
              id="contract-outcomes"
              value={outcomesText}
              onChange={(e) => setOutcomesText(e.target.value)}
              rows={4}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-foreground/90">{contract.purpose}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">First-value journey:</span>{' '}
            {contract.firstValueJourney}
          </p>
          {contract.criticalOutcomes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {contract.criticalOutcomes.map((outcome) => (
                <li key={outcome}>{outcome}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
