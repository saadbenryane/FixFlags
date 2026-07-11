import { Surface } from '@/components/ui/surface'

/**
 * Shared loading placeholder for the client-rendered settings pages
 * (API keys, Integrations) so sibling routes share one loading shape.
 */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="h-8 w-40 rounded bg-muted" />
      <Surface variant="flat" className="h-24" />
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Surface key={i} variant="flat" className="h-14" />
        ))}
      </div>
    </div>
  )
}
