export type BindingDispositionName = 'SUCCEEDED' | 'FAILED' | 'BLOCKED'

export type RequiredBinding = {
  key: string
  required: boolean
}

export type BindingObservation = {
  key: string
  disposition: BindingDispositionName
  reason: string
}

export type BindingVerdict = {
  state: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY'
  reason: string
  summary: string
  requiredBindings: string[]
  observedBindings: string[]
}

const FAILURE_COPY: Record<string, { summary: string; problem: string; evidence: string; fix: string }> = {
  http_unavailable: {
    summary: 'The page was unavailable.',
    problem: 'A required page did not respond successfully.',
    evidence: 'FixFlags requested the bound page and received an unsuccessful response.',
    fix: 'Restore the page so a public request succeeds, then verify this Outcome again.',
  },
}

export function assessRequiredBindings(
  bindings: RequiredBinding[],
  observations: BindingObservation[],
): BindingVerdict {
  const required = bindings.filter((binding) => binding.required).map((binding) => binding.key)
  const byKey = new Map(observations.map((observation) => [observation.key, observation]))
  const observed = required.filter((key) => {
    const observation = byKey.get(key)
    return observation?.disposition === 'SUCCEEDED' || observation?.disposition === 'FAILED'
  })
  if (required.length === 0) {
    return {
      state: 'COULD_NOT_VERIFY',
      reason: 'required_coverage_incomplete',
      summary: 'This Outcome has no required execution binding.',
      requiredBindings: [],
      observedBindings: [],
    }
  }
  const failed = required
    .map((key) => byKey.get(key))
    .find((observation) => observation?.disposition === 'FAILED')
  if (failed) {
    return {
      state: 'FLAG',
      reason: failed.reason,
      summary: summaryFor(failed.reason, 'FLAG'),
      requiredBindings: required,
      observedBindings: observed,
    }
  }
  const blocked = required.some((key) => {
    const observation = byKey.get(key)
    return !observation || observation.disposition === 'BLOCKED'
  })
  if (blocked) {
    const reason = required
      .map((key) => byKey.get(key))
      .find((observation) => !observation || observation.disposition === 'BLOCKED')
    return {
      state: 'COULD_NOT_VERIFY',
      reason: reason?.reason ?? 'required_coverage_incomplete',
      summary: summaryFor(reason?.reason ?? 'required_coverage_incomplete', 'COULD_NOT_VERIFY'),
      requiredBindings: required,
      observedBindings: observed,
    }
  }
  return {
    state: 'CLEAR',
    reason: 'required_bindings_succeeded',
    summary: 'FixFlags completed every required check for this Outcome.',
    requiredBindings: required,
    observedBindings: observed,
  }
}

export function summaryFor(reason: string, state: BindingVerdict['state']): string {
  if (state === 'CLEAR') return 'FixFlags completed every required check for this Outcome.'
  if (reason === 'protected_or_irreversible') {
    return 'This flow is protected, so FixFlags did not submit it.'
  }
  if (reason === 'safe_fixture_required') {
    return 'FixFlags did not submit this form because no safe fixture is authorized.'
  }
  if (reason === 'http_unavailable') return FAILURE_COPY.http_unavailable.summary
  if (reason === 'redirect_unfollowed') {
    return 'The page redirected, so FixFlags could not verify the final response.'
  }
  if (reason === 'not_public') {
    return 'FixFlags only verifies publicly reachable pages.'
  }
  if (state === 'FLAG') return 'A required check failed.'
  return 'FixFlags could not complete the required coverage for this Outcome.'
}

export function availabilityFlagCopy(reason: string): {
  summary: string
  problem: string
  evidence: string
  fix: string
} {
  return FAILURE_COPY[reason] ?? {
    summary: summaryFor(reason, 'FLAG'),
    problem: 'A required page could not be verified as available.',
    evidence: 'FixFlags did not receive a successful public response for the bound page.',
    fix: 'Restore the bound page and verify this Outcome again.',
  }
}
