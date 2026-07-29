'use client'

import { Button } from '@/components/ui/button'

export default function DocsError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[28rem] max-w-2xl flex-col items-start justify-center px-5 py-16">
      <p className="font-mono text-xs font-semibold uppercase tracking-label text-brand">Docs</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold">This page could not be loaded.</h1>
      <p className="mt-4 text-muted-foreground">Try the page again. Your product data was not changed.</p>
      <Button className="mt-7" onClick={reset}>Try again</Button>
    </div>
  )
}
