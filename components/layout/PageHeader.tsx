import { PageTitle, Muted } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

/** App/admin page title - smaller Fraunces scale, not marketing hero size */
export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 space-y-1.5">
        <PageTitle>{title}</PageTitle>
        {description && <Muted>{description}</Muted>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
