import { Globe2, MessageSquare, Zap, type LucideIcon } from 'lucide-react'

export type RubricIconId = 'message' | 'experience' | 'reach'

/** Matches product rubric icons in `lib/rubric-icons.ts`. */
export const RUBRIC_ICONS: Record<RubricIconId, LucideIcon> = {
  message: MessageSquare,
  experience: Zap,
  reach: Globe2,
}
