'use client'
import { useId, useState } from 'react'
import { AdminActionButton } from './AdminActionButton'
export function RefundControl({
  id,
  amountMinor,
  currency,
  digits,
}: {
  id: string
  amountMinor: number
  currency: string
  digits: number
}) {
  const field = useId(),
    [amount, setAmount] = useState((amountMinor / 10 ** digits).toFixed(digits)),
    minor = Math.round(Number(amount) * 10 ** digits),
    valid = Number.isFinite(minor) && minor > 0 && minor <= amountMinor
  return (
    <div className="space-y-2">
      <label htmlFor={field} className="block text-sm">
        Refund amount ({currency.toUpperCase()})
      </label>
      <input
        id={field}
        type="number"
        min={1 / 10 ** digits}
        max={amountMinor / 10 ** digits}
        step={1 / 10 ** digits}
        className="h-11 w-full rounded-input border bg-background px-3 text-sm"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {valid && (
        <AdminActionButton action="BILLING_REFUND" targetId={id} input={{ amountMinor: minor }} />
      )}
      {!valid && (
        <p className="text-xs text-destructive">Choose a positive amount within this payment.</p>
      )}
    </div>
  )
}
