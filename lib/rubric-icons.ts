import {
  Accessibility,
  BarChart3,
  DollarSign,
  Globe2,
  MessageSquare,
  Search,
  Share2,
  ShieldCheck,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export function rubricIcon(name: string): LucideIcon {
  const map: Record<string, LucideIcon> = {
    MESSAGE: MessageSquare,
    EXPERIENCE: Zap,
    REACH: Globe2,
  }
  return map[name] ?? MessageSquare
}

export function impactTagIcon(tag: string | null | undefined): LucideIcon | null {
  if (!tag) return null
  const map: Record<string, LucideIcon> = {
    CONVERSION: TrendingUp,
    REVENUE: DollarSign,
    TRUST: ShieldCheck,
    MEASUREMENT: BarChart3,
    SHARING: Share2,
    SEO: Search,
    ACCESSIBILITY: Accessibility,
  }
  return map[tag] ?? null
}
