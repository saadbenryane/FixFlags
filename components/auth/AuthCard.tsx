import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/brand/Logo'
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
      <div className="flex flex-col items-center space-y-3 text-center">
        <Logo variant="lockup" size="md" href="/" />
        <div className="space-y-1">
          <h1 className="font-sans text-xl font-semibold tracking-heading">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {trustLine && <Muted className="text-xs">{trustLine}</Muted>}
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardContent className="space-y-4 pt-6">{children}</CardContent>
      </Card>
      {footer}
    </div>
  )
}
