import Link from 'next/link'
import { CreditCard, Flag, Rocket, Terminal, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { HelpCategory } from '@/lib/help/types'
import { helpCategoryPath } from '@/lib/help/types'
import { HELP_CENTER } from '@/lib/marketing/copy'
import { Heading, Body } from '@/components/ui/typography'

const ICONS: Record<HelpCategory['icon'], LucideIcon> = {
  rocket: Rocket,
  flag: Flag,
  creditCard: CreditCard,
  terminal: Terminal,
  user: User,
}

export function HelpCategoryGrid({ categories }: { categories: readonly HelpCategory[] }) {
  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-lg">
        {HELP_CENTER.categoriesHeading}
      </Heading>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const Icon = ICONS[cat.icon]
          return (
            <li key={cat.id}>
              <Link
                href={helpCategoryPath(cat.id)}
                className="flex h-full gap-3 rounded-card glass-surface shadow-card p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-nested-md bg-muted/50">
                  <Icon className="h-4 w-4 text-foreground" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{cat.title}</span>
                  <Body className="mt-1 text-xs text-muted-foreground">{cat.description}</Body>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
