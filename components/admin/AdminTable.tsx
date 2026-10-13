import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AdminTable({
  children,
  emptyMessage,
  isEmpty,
}: {
  children: React.ReactNode
  emptyMessage: string
  isEmpty: boolean
}) {
  if (isEmpty) {
    return (
      <Card variant="solid">
        <div className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      </Card>
    )
  }

  return (
    <Card variant="solid" className="min-w-0 p-0">
      <div
        className="overflow-x-auto rounded-[inherit]"
        role="region"
        aria-label="Admin records"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The overflow region needs keyboard scrolling.
        tabIndex={0}
      >
        <table className="w-full text-sm">{children}</table>
      </div>
    </Card>
  )
}

export function AdminTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className=" bg-muted/50">{children}</tr>
    </thead>
  )
}

export function AdminTableHeaderCell({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <th scope="col" className={cn('text-left px-4 py-3 font-medium', className)}>
      {children}
    </th>
  )
}

export function AdminTableRow({ children, index }: { children: React.ReactNode; index: number }) {
  return <tr className={cn(' ', index % 2 === 0 ? '' : 'bg-muted/20')}>{children}</tr>
}

export function AdminTableCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={cn('px-4 py-3', className)}>{children}</td>
}
