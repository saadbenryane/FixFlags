import { z } from 'zod'
import { capturePageKey } from './browser/observation-scope'

export type ConsoleMessage = { type: string; text: string; identity?: string }
const viewport = z.object({
  complete: z.boolean(), finalUrl: z.string().url().nullable(), profile: z.string().min(1), errors: z.number().int().nonnegative(),
  observedMs: z.number().int().min(0).max(90000), minimumMs: z.number().int().min(0).max(90000),
}).strict()
export const consoleCoverageSchema = z.object({
  phase: z.enum(['page_load', 'page_load_and_public_action']), pageUrl: z.string().url(), access: z.string().min(1), desktop: viewport, mobile: viewport,
  messagesTruncated: z.boolean().optional(),
}).strict()
export type ConsoleCoverage = z.infer<typeof consoleCoverageSchema>
export const CONSOLE_VERIFICATION_RULE = 'Console observation: repeat desktop and mobile page-load captures at the same requested and final URLs, capture profiles and access conditions, through the recorded failure horizon. Unavailable or truncated windows cannot establish recovery.'

export function actionableConsoleErrors(errors: ConsoleMessage[]) {
  return errors.filter(error => error.type === 'error' && !/net::ERR_BLOCKED_BY_CLIENT\.Inspector\b/i.test(error.text))
}
export function consoleContext(device: 'desktop' | 'mobile', pageUrl: string, finalUrl: string | null, profile: string, access: string, milliseconds: number) {
  return 'console:page_load:' + device + ':' + access + ':' + capturePageKey(pageUrl) + ':' + profile + ':' + (finalUrl ? capturePageKey(finalUrl) : 'unknown') + ':window:' + milliseconds
}
export function readConsoleContext(context: string) {
  const match = /^(console:page_load:.+):window:(\d+)$/.exec(context)
  const milliseconds = match ? Number(match[2]) : NaN
  return match && Number.isSafeInteger(milliseconds) && milliseconds <= 90000 ? { key: match[1], milliseconds } : null
}
export function consoleObservationMinimum(targets: unknown, pageUrl?: string): number {
  const pageKey = pageUrl ? capturePageKey(pageUrl) : null
  return Array.isArray(targets) ? targets.reduce((maximum, target) => {
    const value = target && typeof target === 'object' && typeof target.context === 'string' ? readConsoleContext(target.context) : null
    return Math.max(maximum, value && (!pageKey || value.key.split(':').at(-3) === pageKey) ? value.milliseconds : 0)
  }, 0) : 0
}
