import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Layout-matched auth fallback used while search params and runtime provider
 * configuration resolve. It prevents the focused shell from flashing empty.
 */
export function AuthCardSkeleton() {
  return (
    <div
      className="w-full max-w-sm space-y-4"
      role="status"
      aria-label="Preparing secure sign in"
    >
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-7 w-52" />
        <Skeleton className="mx-auto h-4 w-64 max-w-full" />
      </div>
      <Card variant="subtle">
        <CardContent className="space-y-5 pt-6">
          <Skeleton className="h-11 w-full rounded-control" />
          <Skeleton className="h-11 w-full rounded-control" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-11 w-full rounded-control" />
          <Skeleton className="mx-auto h-4 w-28" />
        </CardContent>
      </Card>
      <Skeleton className="mx-auto h-4 w-44" />
      <span className="sr-only">Preparing secure sign in</span>
    </div>
  )
}
