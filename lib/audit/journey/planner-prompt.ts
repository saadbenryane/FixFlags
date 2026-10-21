import type { ProductContract } from '@/lib/audit/product-contract'
import type { JourneyLinkCandidate } from './discover'

/**
 * Byte-identical across all audits for prompt cache reuse.
 * User-specific data goes in the user prompt.
 */
export function buildPlannerSystemPrompt(): string {
  return `You are a UX journey planner. You plan multi-step user journeys through websites to evaluate their experience quality.

Your job is to determine the best sequence of steps to evaluate a website's user experience, focusing on:
- Whether the value proposition is clear
- Whether the primary CTA is obvious and reachable
- Whether the user can complete key flows (signup, pricing, contact)
- Whether there are dead ends, confusing navigation, or friction points
- Whether the experience feels trustworthy and professional

Rules:
1. Plan 1-8 meaningful steps within the recorded scope. Stop where further controls or routes are unknown.
2. Start from the supplied landing page and plan a read-only inspection of its public routes.
3. Use the accessibility tree to understand what interactive elements are available.
4. Use only navigate, click and evaluate actions. Never plan filling fields, submitting forms, scrolling, account creation, purchases or other external mutations. Authorized account and form checks have separate executors.
5. After navigation steps, add an "evaluate" step to assess what the visitor sees.
6. Focus on the PRIMARY user journey, not edge cases.
7. Each step's expectedResult describes an unverified intention, never observed behavior or a completed customer outcome.
8. Each step's evidence should list what screenshots or data to capture.

Available link candidates from the landing page will be provided. For navigation and clicks, use an exact recorded label or URL. Do not invent paths, routes or controls. After leaving the landing page, plan only targets whose presence on that destination is actually established; otherwise stop and evaluate the recorded destination.

Output a structured plan with a clear goal, numbered steps, and evidence requirements for each step.`
}

export interface PlannerUserPromptInput {
  url: string
  contract: ProductContract | null
  initialTree: string
  metadata: {
    title: string
    description: string
    h1s: string[]
  }
  links: JourneyLinkCandidate[]
}

/**
 * Per-audit user prompt. Contains the specific page data for this journey.
 */
export function buildPlannerUserPrompt(input: PlannerUserPromptInput): string {
  const contractSection = input.contract
    ? `\nProduct Contract:
- Purpose: ${input.contract.purpose}
- First-value journey: ${input.contract.firstValueJourney}
- Critical outcomes: ${input.contract.criticalOutcomes.join('; ')}`
    : '\nNo product contract available. Infer the product purpose from the page content.'

  const linksSection = input.links.length > 0
    ? `\nAvailable navigation targets on the landing page:\n${input.links
        .slice(0, 10)
        .map((l) => `- [${l.category}] "${l.text}" → ${l.href} (score: ${l.score})`)
        .join('\n')}`
    : '\nNo scored navigation targets were recorded. Evaluate the current page without inventing a navigation target.'

  const a11ySection = input.initialTree
    ? `\nAccessibility tree of landing page (truncated):\n${input.initialTree.slice(0, 3000)}`
    : '\nNo accessibility tree available.'

  return `Website: ${input.url}
Title: ${input.metadata.title}
Description: ${input.metadata.description}
H1s: ${input.metadata.h1s.join(' | ') || 'none'}
${contractSection}
${linksSection}
${a11ySection}

Plan a multi-step journey to evaluate this website's user experience. Focus on the primary conversion path.`
}
