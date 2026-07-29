export default function DocsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" aria-busy="true" aria-label="Loading documentation">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-12 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-5 h-6 w-full animate-pulse rounded bg-muted" />
      <div className="mt-16 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
