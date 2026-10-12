import { actionableConsoleErrors, consoleContext, CONSOLE_VERIFICATION_RULE, type ConsoleCoverage, type ConsoleMessage } from '../console-evidence'
import type { CheckAssertion } from './assertion'
import type { DeterministicFlag } from '../flag-types'

export function consoleObservations(coverage?: ConsoleCoverage): CheckAssertion[] {
  return (['desktop', 'mobile'] as const).map(device => {
    const window = coverage?.[device]
    const complete = coverage?.phase === 'page_load' && !coverage.access.endsWith(':unknown') && window?.complete === true && Boolean(window.finalUrl)
    return { key: 'console-errors', name: `${device === 'desktop' ? 'Desktop' : 'Mobile'} console errors`,
      expected: 'No actionable JavaScript console errors during the recorded page-load window',
      observed: window ? `${window.errors} distinct actionable errors recorded during page load; ${window.observedMs}ms observed after the load event. ${complete ? 'The page-load capture completed.' : 'Comparable page-load coverage is unavailable.'}` : 'Console collection coverage is unavailable.',
      passed: complete && window!.errors === 0, complete,
      context: coverage && window ? consoleContext(device, coverage.pageUrl, window.finalUrl, window.profile, coverage.access, window.observedMs) : 'console:page_load:' + device + ':unknown' }
  })
}

export function runConsoleChecks(errors: ConsoleMessage[], coverage?: ConsoleCoverage): DeterministicFlag[] {
  const criticalErrors = actionableConsoleErrors(errors)
  if (!criticalErrors.length) return []
  const critical = criticalErrors.length >= 3
  const count = (coverage?.messagesTruncated ? 'At least ' : '') + criticalErrors.length
  return [{ checkId: critical ? 'console-errors-critical' : 'console-errors-some', rubric: 'EXPERIENCE', impactTag: 'TRUST',
    severity: critical ? 'IMPORTANT' : 'POLISH',
    problem: critical ? `${count} JavaScript console errors detected` : `${count} JavaScript console error${criticalErrors.length > 1 ? 's' : ''} detected`,
    evidence: `Console errors: ${(critical ? criticalErrors.slice(0, 2) : criticalErrors).map(error => error.text.slice(0, 80)).join('; ')}`,
    fix: critical ? '1. Open Chrome DevTools Console tab\n2. Resolve each error by fixing the source code causing it\n3. Verify all errors are gone after the fix'
      : '1. Open Chrome DevTools Console tab and inspect the errors\n2. Trace each error to the source and fix accordingly\n3. Test the affected features after fixing',
    confidence: 1, source: 'DETERMINISTIC',
    ...(coverage?.phase === 'page_load' ? { verificationRule: CONSOLE_VERIFICATION_RULE,
      evidenceTargets: (['desktop', 'mobile'] as const).map(device => ({ kind: 'page' as const, source: 'measured' as const, device,
        label: `${device} page-load console`, context: consoleContext(device, coverage.pageUrl, coverage[device].finalUrl, coverage[device].profile, coverage.access, coverage[device].minimumMs) })) } : {}),
  }]
}
