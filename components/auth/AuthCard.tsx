import { Card, CardContent } from '@/components/ui/card'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-xl tracking-heading">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">{children}</CardContent>
      </Card>
      {footer}
    </div>
  )
}
