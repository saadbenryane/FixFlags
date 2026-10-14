import { PageSpeedResult } from '../pagespeed'
import type { DeterministicFlag } from '../flag-types'
import { runLabVitalsChecks, runResourceChecks } from './performance'
import { TAP_TARGET_VERIFICATION_RULE } from '../pagespeed-tap-targets'

export function runMobileChecks(mobile: PageSpeedResult | null): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!mobile) return findings

  if (mobile.score !== null && mobile.score < 50) {
    findings.push({
      checkId: 'mobile-perf-critical',
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      problem: `Mobile performance is critically low (${mobile.score}/100)`,
      evidence: `Google PageSpeed mobile score: ${mobile.score}/100`,
      fix: '1. Optimize images for mobile (WebP, responsive sizes)\n2. Enable code splitting to reduce initial JavaScript\n3. Reduce JavaScript execution time with lazy loading and defer',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (mobile.score !== null && mobile.score < 75) {
    findings.push({
      checkId: 'mobile-perf-poor',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: `Mobile performance needs improvement (${mobile.score}/100)`,
      evidence: `Google PageSpeed mobile score: ${mobile.score}/100`,
      fix: '1. Compress images and serve responsive sizes for mobile\n2. Lazy load below-the-fold content (IntersectionObserver)\n3. Minimize render-blocking resources with defer and async',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const tapTargets = mobile.tapTargetAudits !== undefined
    ? mobile.tapTargetAudits.find(audit => audit.score !== null && audit.score < 1)
    : mobile.opportunities.find(
    (o) =>
      o.id === 'tap-targets-too-small' ||
      o.id === 'tap-targets' ||
      o.id === 'target-size'
  )
  if (tapTargets) {
    const itemCount = tapTargets.itemsCount ? ` (${tapTargets.itemsCount} element${tapTargets.itemsCount > 1 ? 's' : ''})` : ''
    findings.push({
      checkId: 'tap-targets-small',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: 'Some mobile controls are too small or too close together',
      evidence: `Lighthouse mobile audit ${tapTargets.id}: ${tapTargets.title}${itemCount}. The measured controls fail this audit's size or spacing criteria.`,
      fix: '1. Review the controls identified by the mobile audit\n2. Increase their size or spacing to meet its criteria, aiming for 48x48px touch areas where practical\n3. Use min-height, min-width and padding to keep controls easy to tap on small screens',
      confidence: 1.0,
      source: 'DETERMINISTIC',
      ...(mobile.tapTargetAudits?.some(audit => audit.score !== null && audit.score < 1) ? {
        verificationRule: TAP_TARGET_VERIFICATION_RULE,
        evidenceTargets: mobile.tapTargetAudits.filter(audit => audit.score !== null && audit.score < 1).map(audit => ({
          kind: 'page' as const, source: 'measured' as const, device: 'mobile' as const,
          label: audit.id, context: 'pagespeed-tap-targets:' + audit.id,
        })),
      } : {}),
    })
  }

  findings.push(...runLabVitalsChecks(mobile), ...runResourceChecks(mobile))

  return findings
}
