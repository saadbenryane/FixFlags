import { History, FileText, RefreshCw } from 'lucide-react'
import { AUTH } from '@/lib/marketing/copy'

const ICONS = {
  history: History,
  reports: FileText,
  monitoring: RefreshCw,
} as const

export function AuthValueProps() {
  return (
    <ul className="space-y-2 text-xs text-muted-foreground">
      {AUTH.valueProps.map((item) => {
        const Icon = ICONS[item.icon]
        return (
          <li key={item.text} className="flex items-start gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-brand" />
            <span>{item.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
