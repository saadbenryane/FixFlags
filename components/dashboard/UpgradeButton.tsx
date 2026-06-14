'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

export function UpgradeButton() {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'BUILDER' }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Checkout did not return a destination.')
      }
    } catch {
      toast.error('Could not start checkout. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleUpgrade} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Sparkles className="h-4 w-4 mr-2" />
      )}
      Upgrade
    </Button>
  )
}
