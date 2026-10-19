import { describe, expect, it } from 'vitest'
import { runMetadataChecks } from './metadata-checks'
import { healthyMeta } from '../__tests__/check-fixtures'

describe('source-bound metadata guidance', () => {
  it('inspects intended metadata before adding it, without invented assets or replacement copy', () => {
    const flags = runMetadataChecks({ ...healthyMeta(), ogImage: null, ogTitle: null, ogDescription: null, hasFavicon: false })
    for (const checkId of ['og-image-missing', 'og-title-missing', 'og-description-missing', 'favicon-missing']) {
      const finding = flags.find(flag => flag.checkId === checkId)!
      expect(finding).toBeDefined()
      expect(finding.fix).toMatch(/^Review /)
      expect(finding.fix).toContain('If ')
      expect(finding.fix).toContain('Preserve')
      expect(finding.fix).not.toMatch(/yourdomain|\/favicon\.ico|\/apple-touch-icon|Twitter Card|50-60|200 characters/)
    }
    expect(flags.find(flag => flag.checkId === 'favicon-missing')).toMatchObject({
      problem: 'No favicon link is declared', evidence: 'No link rel="icon" or apple-touch-icon found in <head>',
    })
  })
})
