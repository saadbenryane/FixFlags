import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shared loading placeholder for the client-rendered settings pages
 * (API keys, Integrations) so sibling routes share one loading shape.
 */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-8 w-40 rounded-md" />
      <Card variant="subtle">
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-2/5 rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-9 w-full rounded-card" />
        </CardContent>
      </Card>
      <Card variant="subtle">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-card" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
