import { logger } from '@/lib/logger'

/**
 * Production hardening for AI-powered journey features.
 * Combines a token budget guard and a circuit breaker for LLM providers.
 */

// ---------------------------------------------------------------------------
// Token budget guard
// ---------------------------------------------------------------------------

/** Maximum combined input+output tokens the journey AI calls may spend per audit. */
export const JOURNEY_AI_TOKEN_BUDGET = 15_000

export interface TokenBudgetTracker {
  used: number
  remaining: number
  canSpend(estimatedTokens: number): boolean
  record(inputTokens: number, outputTokens: number): void
}

export function createTokenBudgetTracker(budget = JOURNEY_AI_TOKEN_BUDGET): TokenBudgetTracker {
  let used = 0
  return {
    get used() { return used },
    get remaining() { return Math.max(0, budget - used) },
    canSpend(estimated: number) {
      return used + estimated <= budget
    },
    record(inputTokens: number, outputTokens: number) {
      used += inputTokens + outputTokens
    },
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

export interface CircuitBreakerState {
  /** Number of consecutive failures before the circuit opens. */
  failureThreshold: number
  /** How long the circuit stays open (ms) after failures. */
  cooldownMs: number
  /** Current consecutive failure count. */
  consecutiveFailures: number
  /** Timestamp when the circuit opened, or null if closed. */
  openedAt: number | null
  /** Whether the circuit is currently open (blocking calls). */
  isOpen(): boolean
  /** Record a successful call — resets the failure counter. */
  recordSuccess(): void
  /** Record a failed call — may open the circuit. */
  recordFailure(): void
}

export function createCircuitBreaker(
  failureThreshold = 3,
  cooldownMs = 60_000
): CircuitBreakerState {
  let consecutiveFailures = 0
  let openedAt: number | null = null

  return {
    failureThreshold,
    cooldownMs,
    get consecutiveFailures() { return consecutiveFailures },
    get openedAt() { return openedAt },
    isOpen() {
      if (openedAt === null) return false
      if (Date.now() - openedAt >= cooldownMs) {
        // Cooldown expired — allow a trial call (half-open).
        return false
      }
      return true
    },
    recordSuccess() {
      consecutiveFailures = 0
      openedAt = null
    },
    recordFailure() {
      consecutiveFailures++
      if (consecutiveFailures >= failureThreshold) {
        openedAt = Date.now()
        logger.warn('Journey AI circuit breaker opened', {
          consecutiveFailures,
          cooldownMs,
        })
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Combined wrapper: budget + circuit breaker for planner/evaluator calls
// ---------------------------------------------------------------------------

export interface JourneyAIGuard {
  tokenBudget: TokenBudgetTracker
  circuitBreaker: CircuitBreakerState
  /** Check whether an LLM call is allowed (budget + circuit). */
  canCall(estimatedTokens?: number): { allowed: boolean; reason?: string }
  /** Record the outcome of a completed LLM call. */
  recordOutcome(inputTokens: number, outputTokens: number, error?: unknown): void
}

export function createJourneyAIGuard(): JourneyAIGuard {
  const tokenBudget = createTokenBudgetTracker()
  const circuitBreaker = createCircuitBreaker()

  return {
    tokenBudget,
    circuitBreaker,
    canCall(estimatedTokens = 3_000) {
      if (circuitBreaker.isOpen()) {
        return { allowed: false, reason: 'circuit-open' }
      }
      if (!tokenBudget.canSpend(estimatedTokens)) {
        return { allowed: false, reason: 'token-budget-exceeded' }
      }
      return { allowed: true }
    },
    recordOutcome(inputTokens, outputTokens, error) {
      tokenBudget.record(inputTokens, outputTokens)
      if (error) {
        circuitBreaker.recordFailure()
      } else {
        circuitBreaker.recordSuccess()
      }
    },
  }
}
