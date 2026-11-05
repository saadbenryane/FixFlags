import { FlagSource } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { readRepairSources } from '../domain/repair-source'

const source = { id: 'source-flag', auditId: 'source-audit', checkId: 'journey-checkout-failed-add_to_cart_noop',
  fingerprint: 'outcome:v1:checkout:entry', pageUrl: 'https://example.com/', affectedPaths: null,
  attentionPolicy: null, verificationRule: null, evidenceTargets: null, supportingObservations: null }

describe('immutable repair source provenance', () => {
  it.each(Object.values(FlagSource))('retains the database %s source without relabeling its evidence', provenance => {
    const receipt = { version: 1, flags: [{ ...source, source: provenance }] }
    expect(readRepairSources(receipt)).toEqual(receipt)
  })
  it('refuses unknown provenance and duplicated source captures', () => {
    expect(readRepairSources({ version: 1, flags: [{ ...source, source: 'INFERRED' }] })).toBeNull()
    const flag = { ...source, source: FlagSource.JOURNEY }
    expect(readRepairSources({ version: 1, flags: [flag, flag] })).toBeNull()
  })
})
