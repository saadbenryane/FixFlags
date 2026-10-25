import { repairGuidanceState, type RepairGuidanceInput, type RepairGuidanceState } from '@/lib/improvements/repair-guidance'
import type { SiteHomeView } from './site-home'
import { readSiteHomeView } from './site-view-contract'

/** Reading a scan does not grant access to its owner-only repair instructions. */
export function viewerRepairGuidance(flag: RepairGuidanceInput & { repairGuidance?: RepairGuidanceState }, owner: boolean) {
  return {
    fix: owner ? flag.fix ?? '' : '',
    repairGuidance: owner ? flag.repairGuidance ?? repairGuidanceState(flag) : 'unavailable' as const,
  }
}

/** Both the initial render and refresh publish the same allowlisted wire model. */
export function projectSiteHomeForViewer(view: SiteHomeView): SiteHomeView {
  const owner = view.actions.ownership === 'owner'
  const flags = (items: SiteHomeView['flags']) => items.map(flag => ({ ...flag, ...viewerRepairGuidance(flag, owner) }))
  return readSiteHomeView({ ...view,
    settings: { ...view.settings, github: owner ? view.settings.github : undefined },
    flags: flags(view.flags), recommendations: flags(view.recommendations), resolvedFlags: flags(view.resolvedFlags),
    cards: view.cards.map(card => ({ ...card, flagChips: card.flagChips.map(chip => owner ? chip : {
      ...chip, repairGuidanceReady: false, repairGuidance: 'unavailable',
    }) })),
  }, view.site.siteId)
}
