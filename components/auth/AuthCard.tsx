import { Card, CardContent } from '@/components/ui/card'
import { Muted } from '@/components/ui/typography'

interface AuthCardProps {
  title: string
  subtitle?: string
  trustLine?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthCard({ title, subtitle, trustLine, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="font-serif text-xl font-semibold tracking-heading">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {trustLine && <Muted className="text-xs">{trustLine}</Muted>}
      </div>
      <Card variant="subtle">
        <CardContent className="space-y-4 pt-6">{children}</CardContent>
      </Card>
      {footer}
    </div>
  )
}
