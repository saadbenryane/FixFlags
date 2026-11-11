/**
 * For agencies: what works for client sites today. Shared client workspaces and
 * multi-website plans are not shipped, so the page says so once and links the waitlist.
 */
export const AGENCIES_PAGE = {
  label: 'For agencies',
  title: 'Know a client site broke before the client does.',
  body: 'Check any client site with nothing to install on it. Hand the fix to whoever maintains it, then confirm it with a recheck of the live site.',
  seo: {
    title: 'Website checks for agencies and freelancers | FixFlags',
    description: 'Check client websites without installing anything, hand fix instructions to the developer or AI tool that maintains them, and confirm each fix with a fresh recheck.',
  },
  stepsTitle: 'How agencies use it today',
  steps: [
    { title: 'Check without touching the site', body: 'Paste the client’s URL. FixFlags opens the live site in a real browser and tries its pages and main actions. No tag, plugin, or client access is needed for public pages.' },
    { title: 'Hand off the fix', body: 'Each Flag has its evidence and fix instructions. Paste them into the AI tool that built the site or send them to the developer who maintains it.' },
    { title: 'Confirm the fix', body: 'After the fix is published, Recheck runs the same check on the same page. When it passes, the Flag shows a Verified receipt: the page, when the problem was found, and when the fix was confirmed.' },
    { title: 'Catch the next break', body: 'Save the Site to keep watching it. Add one request to the deploy pipeline to check after every release, and get an email when a fixed problem comes back.' },
  ],
  limits: {
    title: 'What is not here yet',
    body: 'During the open beta each account saves one website. Plans for more websites are coming soon, and shared client workspaces are not available yet. Only check websites you have permission to test.',
    action: 'Join the waitlist',
    href: '/waitlist/agency',
  },
} as const
