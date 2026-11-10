/** Free tools index. Each tool checks one thing on one page; the full check covers the Site. */
export const FREE_TOOLS_PAGE = {
  label: 'Free tools',
  title: 'Small checks. No signup.',
  body: 'Each tool checks one thing on one page and answers in seconds. When you want the whole site tried like a visitor, run a full check.',
  seo: {
    title: 'Free website tools | FixFlags',
    description: 'Free single-page checks from FixFlags: link previews, broken links, and placeholder copy. No signup. Then check your whole website.',
  },
  open: (name: string) => `Open ${name}`,
  tools: [
    { href: '/tools/meta-preview', name: 'Link preview checker', summary: 'See the image, title, and description people get when you share a page.' },
    { href: '/tools/broken-link-checker', name: 'Broken link checker', summary: 'Find links on a page that return errors or do not respond.' },
    { href: '/tools/placeholder-detector', name: 'Placeholder copy detector', summary: 'Find lorem ipsum, TODOs, and leftover template text before visitors do.' },
  ],
  fullCheck: {
    title: 'What the full check adds',
    body: 'A full check opens your live site in a real browser, tries its main actions on desktop and phone, flags what is broken with evidence, and writes fix instructions for your AI tool. After you publish the fix, Recheck proves it worked.',
  },
} as const
