export const SITE_COVERAGE_HELP = {
  introduction: 'Overview shows the flags found on the pages FixFlags checked. Open any category to see its results, supporting details, and coverage.',
  categories: [
    'Pages: which pages were reached and checked.',
    'Conversion: whether visitors can use the main buttons, navigation, and supported forms.',
    'Performance: loading speed and measured opportunities to make pages faster.',
    'Tracking: analytics code and browser requests that were observed. Provider recording and consent need separate confirmation.',
    'Accessibility: automated accessibility checks and keyboard interactions. This is not a full accessibility assessment.',
    'Security: public HTTPS and resource checks. This is not a penetration test.',
    'Search: public crawl rules, page metadata, and indexing signals.',
    'Uptime: whether monitored pages can be reached. Scheduled monitoring requires a saved website.',
  ],
  states: [
    'Running or Waiting: work is still in progress. Results appear as checks finish.',
    '0 Flags: no problems were found in the recorded checks.',
    'Partially checked: some results are available, but part of the category could not be confirmed. Open it to see what was checked.',
    'Not checked yet: there are no results for this area.',
    'Out of date: run a new check for current results.',
  ],
  timeline: 'Timeline shows how results change across checks. Sign in to keep the website, return to its results, and track fixes over time.',
  limitation: 'A flag count describes the results that were collected. It does not mean every page, interaction, or connected service was checked.',
} as const
