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
1. Plan 3-8 steps maximum. Each step should be meaningful.
2. Start from the landing page and work toward a conversion goal.
3. Use the accessibility tree to understand what interactive elements are available.
4. Prefer clicking actual links/buttons over navigating to URLs directly.
5. After navigation steps, add an "evaluate" step to assess what the visitor sees.
6. Focus on the PRIMARY user journey, not edge cases.
7. Each step's expectedResult should be specific and verifiable.
8. Each step's evidence should list what screenshots or data to capture.

Available link candidates from the current page will be provided. Use them to plan realistic navigation targets.

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
    : '\nNo scored navigation targets found. Plan based on the accessibility tree.'

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
