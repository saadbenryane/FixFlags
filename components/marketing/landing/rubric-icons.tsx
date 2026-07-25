import { Crosshair, MessageSquare, Sparkles, type LucideIcon } from 'lucide-react'

export type RubricIconId = 'message' | 'experience' | 'reach'

export const RUBRIC_ICONS: Record<RubricIconId, LucideIcon> = {
  message: MessageSquare,
  experience: Sparkles,
  reach: Crosshair,
}
