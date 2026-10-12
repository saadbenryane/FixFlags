import type { SitePresentation } from './presentation'

export type SiteCapture = NonNullable<SitePresentation['identity']['preview']> & {
  auditId: string; device: 'desktop' | 'mobile'; previous: boolean;
}
