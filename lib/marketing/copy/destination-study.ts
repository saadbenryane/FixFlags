import receipt from '@/docs/growth/metrics/destination-study-serving-base-2026-11-09.json'
import { GUIDE_REVIEWED_AT } from './guides'

// Change only with explicit publication approval for the reviewed study.
const PUBLICATION_APPROVED = false
export const GUIDE_WITH_STUDY = 'website-online-but-not-working'

const labels: Record<string, string> = {
  'booking-control': 'Booking page with a time link',
  'missing-with-404': 'Removed page',
  'booking-soft-404': 'Booking link shows a missing page',
  'booking-repaired': 'Booking page restored at the same URL',
  'booking-recurred': 'Missing page returns at the same URL',
  'wrong-page': 'Homepage served instead of booking',
  'unresolved-shell': 'Booking link shows a loading screen',
  'access-challenge': 'Browser verification screen',
  'incomplete-body': 'Response exceeds the body limit',
  'working-404-guide': 'Working article about HTTP 404',
  'sign-in-required': 'Member booking behind sign-in',
}

const observations: Record<string, string> = {
  reachable: 'Reachable',
  not_found: 'Missing',
  render_error: 'Marked missing',
  blocked: 'Blocked',
  unknown: 'Unknown',
  auth_required: 'Sign-in needed',
}

export const destinationStudyEdition = {
  id: 'http-200-booking-study',
  title: 'What HTTP 200 missed',
  caption: `HTTP status and FixFlags results across ${receipt.observations.length} controlled responses`,
  columns: ['Supplied response', 'HTTP status', 'Destination check'],
  dateLabel: 'Study recorded',
  date: receipt.observedAt.slice(0, 10),
  contentModifiedAt: '2026-11-09',
  introduction: 'We replayed hand-authored GET responses through the FixFlags destination check. At the same booking URL, we replaced a missing-page message with the booking page, then switched back. Each response returned HTTP 200. A status-only check saw the same success code every time.',
  interpretation: [
    'A reachable response can still show the wrong page. The check also marked the oversized response as reachable even though its body exceeded the collection limit. In the same study, FixFlags marked a working article about HTTP 404 as missing. Open the page before changing a link flagged on the basis of its error wording.',
    'After a fix, reopen the original link and look for a specific part of the intended page, such as the booking title and time selector. Keep access challenges and incomplete responses unconfirmed until you can check them again.',
    'The study used synthetic responses. It did not run JavaScript, submit a booking, or measure customer sites or AI builders.',
  ],
  sources: [
    { title: 'HTTP Semantics on 200 OK', href: 'https://www.rfc-editor.org/rfc/rfc9110.html#name-200-ok' },
    { title: 'Google Search Central on soft 404s', href: 'https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors#soft-404-errors' },
  ],
  rows: receipt.observations.map(row => ({
    id: row.caseId,
    label: labels[row.caseId],
    status: row.httpStatus,
    observation: observations[row.destinationOutcome],
  })),
}

export function guideDestinationStudy(slug: string) {
  const preview = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  if (slug !== GUIDE_WITH_STUDY || (!PUBLICATION_APPROVED && !preview)) return null
  return destinationStudyEdition
}

export function guideContentModifiedAt(slug: string) {
  return guideDestinationStudy(slug)?.contentModifiedAt ?? GUIDE_REVIEWED_AT
}
