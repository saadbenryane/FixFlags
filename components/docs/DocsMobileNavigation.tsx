'use client'

import { Menu } from 'lucide-react'
import { useState } from 'react'
import type { DocsSearchEntry } from '@/lib/docs/content'
import { Button } from '@/components/ui/button'
import { DocsNavigation } from '@/components/docs/DocsNavigation'
import { DocsSearch } from '@/components/docs/DocsSearch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export function DocsMobileNavigation({ entries }: { entries: readonly DocsSearchEntry[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Open documentation navigation">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[min(22rem,88vw)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Documentation</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-7">
            <DocsSearch entries={entries} compact />
            <DocsNavigation onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1">
        <DocsSearch entries={entries} compact />
      </div>
    </div>
  )
}
