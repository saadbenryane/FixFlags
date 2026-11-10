/**
 * Compare: what each kind of tool needs from you and what it can prove.
 * Vendor facts come from each vendor's own pages, checked on `checkedOn`.
 * Re-check every vendor line before changing it; prices and claims move.
 */
export const COMPARE_PAGE = {
  label: 'Compare',
  title: 'Where FixFlags fits.',
  body: 'Different tools watch different layers. Here is what each one needs from you, what it finds, and what it can prove after a fix.',
  checkedOn: 'Vendor details checked on November 10, 2026, against each vendor’s own pages.',
  seo: {
    title: 'FixFlags compared with Elu, Lighthouse, uptime monitors and Checkly | FixFlags',
    description: 'What FixFlags needs from you, what it finds, and how it proves a fix, compared with Elu, Lighthouse and PageSpeed Insights, uptime monitors, and Checkly.',
  },
  fixflags: {
    title: 'FixFlags in one line',
    body: 'Paste a URL. FixFlags tries your live pages and actions like a visitor, flags what is broken with evidence, hands your AI the fix, and rechecks the same page and action to prove it worked. No install, no scripts, no visitors needed.',
  },
  entries: [
    {
      id: 'elu',
      name: 'Elu',
      theyDo: 'Elu watches real user behavior to surface bugs and friction, and gives product teams a path to the fix. It installs with a CLI command, and pricing is through a demo.',
      difference: 'FixFlags does not wait for visitors to struggle. It tries the live site itself, so it works on launch day and on sites with little traffic, and every fix gets an independent recheck.',
      choose: 'Choose Elu when you have steady traffic and want to learn from real sessions.',
      source: { label: 'elu.dev', href: 'https://elu.dev/' },
    },
    {
      id: 'lighthouse',
      name: 'Lighthouse and PageSpeed Insights',
      theyDo: 'Lighthouse audits a single page load in a lab browser. PageSpeed Insights adds field data from real Chrome users. Both are free and excellent for speed and best practices.',
      difference: 'They measure how a page loads. Trying an action such as adding to cart means scripting it yourself, and neither tracks a problem from found to fixed. FixFlags uses PageSpeed Insights for its speed results and adds journeys, fix instructions, and recorded rechecks.',
      choose: 'Use them for a quick speed read on one page.',
      source: { label: 'developers.google.com', href: 'https://developers.google.com/speed/docs/insights/v5/about' },
    },
    {
      id: 'uptime',
      name: 'uptime monitors',
      theyDo: 'Uptime monitors such as UptimeRobot check that a URL, port, or keyword responds, from every 5 minutes on UptimeRobot’s free plan to every 15 seconds on its paid plans.',
      difference: 'A page can answer and still have a cart that does nothing. FixFlags includes public uptime probes every ten minutes and also tries the pages and actions behind them.',
      choose: 'Choose a dedicated uptime monitor when you need alerts within seconds.',
      source: { label: 'uptimerobot.com/pricing', href: 'https://uptimerobot.com/pricing/' },
    },
    {
      id: 'checkly',
      name: 'Checkly',
      theyDo: 'Checkly runs browser checks you write as Playwright scripts and deploys them as code. It has a free Hobby plan, and Starter is $24 a month.',
      difference: 'Checkly is strongest when you write and maintain tests. FixFlags needs no scripts: it finds what to try on your site, flags what fails, and writes the fix instructions.',
      choose: 'Choose Checkly when your team already writes Playwright tests.',
      source: { label: 'checklyhq.com/pricing', href: 'https://www.checklyhq.com/pricing/' },
    },
  ],
  labels: { theyDo: 'What it does', difference: 'How FixFlags differs', source: 'Source' },
  entryTitle: (name: string) => `FixFlags vs ${name}`,
} as const
