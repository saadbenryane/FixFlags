import { PageTitle, Muted } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

/** App/admin page title — smaller Fraunces scale, not marketing hero size */
export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <PageTitle>{title}</PageTitle>
        {description && <Muted>{description}</Muted>}
      </div>
      {children}
    </div>
  )
}
