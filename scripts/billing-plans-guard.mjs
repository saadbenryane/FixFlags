#!/usr/bin/env node
/**
 * CI guard: plan enforcement limits must match PRICING_COPY marketing numbers.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const plans = readFileSync(join(root, 'lib/billing/plans.ts'), 'utf8')
const planDefinitions = plans.slice(plans.indexOf('export const PLAN_DEFINITIONS'))
const terminology = readFileSync(join(root, 'lib/marketing/copy/terminology.ts'), 'utf8')

function extractPricingCopy(key) {
  const match = terminology.match(new RegExp(`${key}:\\s*(\\d+)`))
  return match ? Number(match[1]) : null
}

function extractPlanLimit(plan) {
  const block = planDefinitions.match(new RegExp(`${plan}:\\s*\\{[\\s\\S]*?auditLimit:\\s*(\\d+)`))
  if (!block) return null
  return Number(block[1])
}

const expected = {
  FREE: {
    audit: extractPricingCopy('freeProductReviewsPerMonth'),
  },
  BUILDER: {
    audit: extractPricingCopy('proProductReviewsPerMonth'),
  },
  TEAM: {
    audit: extractPricingCopy('studioProductReviewsPerMonth'),
  },
}

const errors = []
for (const plan of ['FREE', 'BUILDER', 'TEAM']) {
  const audit = extractPlanLimit(plan)
  if (audit !== expected[plan].audit) {
    errors.push(`${plan} auditLimit ${audit} !== PRICING_COPY ${expected[plan].audit}`)
  }
}

if (errors.length > 0) {
  console.error('billing-plans-guard failed:')
  for (const err of errors) console.error(`  - ${err}`)
  process.exit(1)
}

console.log('billing-plans-guard: OK')
