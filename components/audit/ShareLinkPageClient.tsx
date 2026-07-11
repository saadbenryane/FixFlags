'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { toast } from 'sonner'

interface Props {
  token: string
  auditId: string
}

export function ShareLinkPageClient({ token, auditId }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        toast.error('Incorrect password')
        return
      }
      router.push(`/report/${auditId}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-12">
      <Card className="w-full max-w-sm p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle>Password required</CardTitle>
        <p className="text-sm text-muted-foreground">
          This report is protected. Enter the password to view it.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? 'Checking...' : 'View report'}
          </Button>
        </form>
      </Card>
    </Container>
  )
}
