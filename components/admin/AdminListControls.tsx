import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ADMIN_PAGE_SIZE } from '@/lib/admin/list-query'

export function AdminListSearch({
  path,
  q,
  label,
  filters = {},
  statusOptions,
}: {
  path: string
  q: string
  label: string
  filters?: Record<string, string | undefined>
  statusOptions?: readonly string[]
}) {
  return (
    <form action={path} className="flex flex-wrap items-end gap-3">
      {Object.entries(filters).map(([name, value]) =>
        value && !(name === 'status' && statusOptions) ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      <div className="min-w-0 flex-1 space-y-1 sm:max-w-sm">
        <label htmlFor="admin-search" className="text-sm font-medium">
          {label}
        </label>
        <Input id="admin-search" name="q" defaultValue={q} key={q} maxLength={200} />
      </div>
      {statusOptions && (
        <div className="space-y-1">
          <label htmlFor="admin-status" className="block text-sm font-medium">
            Status
          </label>
          <select
            id="admin-status"
            name="status"
            defaultValue={filters.status ?? ''}
            key={filters.status ?? ''}
            className="h-11 rounded-input border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit" variant="outline">
        Search
      </Button>
      <Button variant="ghost" asChild>
        <Link href={path as Route}>Reset</Link>
      </Button>
    </form>
  )
}

export function AdminPagination({
  path,
  page,
  pages,
  total,
  filters = {},
}: {
  path: string
  page: number
  pages: number
  total: number
  filters?: Record<string, string | undefined>
}) {
  function href(nextPage: number) {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(filters)) if (value) params.set(name, value)
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    return (query ? `${path}?${query}` : path) as Route
  }
  return (
    <nav
      aria-label="Record pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted-foreground">
        {total === 0
          ? '0 records'
          : `${((page - 1) * ADMIN_PAGE_SIZE + 1).toLocaleString()} to ${Math.min(page * ADMIN_PAGE_SIZE, total).toLocaleString()} of ${total.toLocaleString()}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page - 1)}>Previous</Link>
          </Button>
        )}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages && (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page + 1)}>Next</Link>
          </Button>
        )}
      </div>
    </nav>
  )
}
