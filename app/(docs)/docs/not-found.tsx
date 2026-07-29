import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DocsNotFound() {
  return (
    <div className="mx-auto flex min-h-[28rem] max-w-2xl flex-col items-start justify-center px-5 py-16">
      <p className="font-mono text-xs font-semibold uppercase tracking-label text-brand">404</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold">Documentation page not found.</h1>
      <p className="mt-4 text-muted-foreground">The guide may have moved into the canonical docs structure.</p>
      <Button className="mt-7" asChild>
        <Link href="/docs">Open documentation</Link>
      </Button>
    </div>
  )
}
