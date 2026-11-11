import type { EditorMarkName } from '@/lib/integrations/editor-catalog'
import { PRODUCT_STORY } from './product-story'

/**
 * For AI builders: one hub and one page per tool. Each page describes the copy-and-paste
 * handoff that works today. Tool steps stay generic enough to remain true as tools change.
 */
export type AiBuilderTool = {
  slug: string
  name: string
  mark: EditorMarkName | null
  kind: 'builder' | 'agent'
  summary: string
  where: string
  publish: string
  example: { flag: string; page: string; observed: string; expected: string }
  tip: string
}

const SHARED_STOP = 'Stop before submitting payment or placing an order.'

export const AI_BUILDER_TOOLS: readonly AiBuilderTool[] = [
  {
    slug: 'lovable', name: 'Lovable', mark: 'Lovable', kind: 'builder',
    summary: 'Lovable builds and previews your app as you chat. FixFlags checks the site you published.',
    where: 'Open your project in Lovable and paste the fix instructions into the chat.',
    publish: 'Review the change in the preview, then publish the update from Lovable.',
    example: { flag: 'Signup button leads to a blank page', page: '/signup', observed: 'Selecting Sign up opens a page with no form.', expected: 'The signup form appears and can be submitted.' },
    tip: 'Lovable can check your preview. FixFlags checks what your visitors get after you publish.',
  },
  {
    slug: 'bolt', name: 'Bolt', mark: 'Bolt', kind: 'builder',
    summary: 'Bolt writes and runs your app in the browser. FixFlags checks the site people actually visit.',
    where: 'Open your project in Bolt and paste the fix instructions into the chat.',
    publish: 'Check the change in Bolt, then publish the update.',
    example: { flag: 'Pricing page is not loading', page: '/pricing', observed: 'The pricing page returned 404.', expected: 'The pricing page opens with its plans.' },
    tip: 'Paste one Flag at a time so the change stays small and easy to review.',
  },
  {
    slug: 'v0', name: 'v0', mark: null, kind: 'builder',
    summary: 'v0 generates your interface and deploys it. FixFlags checks the deployed site on desktop and mobile.',
    where: 'Open your chat in v0 and paste the fix instructions as a new message.',
    publish: 'Review the new version, then deploy it from v0.',
    example: { flag: 'Menu button does nothing on mobile', page: '/', observed: 'On a phone, selecting the menu button does not open the navigation.', expected: 'The navigation opens and its links can be selected.' },
    tip: 'Mobile layout Flags include the screen size we checked, so v0 can reproduce the problem.',
  },
  {
    slug: 'replit', name: 'Replit', mark: 'Replit', kind: 'builder',
    summary: 'Replit Agent builds and hosts your app. FixFlags checks the published app from outside.',
    where: 'Open your app in Replit and paste the fix instructions into Agent.',
    publish: 'Test the change, then republish your app from Replit.',
    example: { flag: 'Contact form shows no confirmation', page: '/contact', observed: 'After submitting, the form stays on screen with no message.', expected: 'A confirmation appears after the form is submitted.' },
    tip: 'After you republish, select Recheck in FixFlags to check the same page and action again.',
  },
  {
    slug: 'cursor', name: 'Cursor', mark: 'Cursor', kind: 'agent',
    summary: 'Cursor edits your code with an agent. FixFlags tells it exactly what broke on the live site.',
    where: 'Open your project in Cursor and paste the fix instructions into the Agent chat.',
    publish: 'Review the diff, then deploy the change the way you normally ship.',
    example: { flag: 'Add to cart didn’t add the product', page: '/products/canvas-tote', observed: 'The Add to cart button responds, but the cart stays empty.', expected: 'The product appears in the cart and checkout opens.' },
    tip: 'Fix instructions name the page, the action and the expected result, so the agent can find the code path.',
  },
  {
    slug: 'claude-code', name: 'Claude Code', mark: 'Claude Code', kind: 'agent',
    summary: 'Claude Code works in your terminal and repository. FixFlags hands it a recorded failure from production.',
    where: 'Start Claude Code in your project folder and paste the fix instructions into the session.',
    publish: 'Review the change, then deploy it the way you normally ship.',
    example: { flag: 'Add to cart didn’t add the product', page: '/products/canvas-tote', observed: 'The Add to cart button responds, but the cart stays empty.', expected: 'The product appears in the cart and checkout opens.' },
    tip: 'Claude Code can test locally. FixFlags rechecks the live site after you deploy, so the agent never marks its own work.',
  },
]

export function getAiBuilderTool(slug: string) {
  return AI_BUILDER_TOOLS.find(tool => tool.slug === slug) ?? null
}

export function aiBuilderExamplePrompt(tool: AiBuilderTool) {
  const { example } = tool
  return [
    `Fix this FixFlags Flag: ${example.flag}.`,
    `Page: ${example.page}`,
    `What happened: ${example.observed}`,
    `What should happen: ${example.expected}`,
    'Find the cause, make the smallest change that fixes it, and explain what you changed.',
    SHARED_STOP,
  ].join('\n')
}

export const AI_BUILDERS_PAGE = {
  label: 'For AI builders',
  title: 'Built with AI? Check what your visitors get.',
  titleLines: ['Built with AI?', 'Check what your visitors get.'] as const,
  body: 'AI tools build fast and check their own preview. FixFlags checks your live site in a real browser, hands your tool the fix, and rechecks to prove it worked.',
  tools: { label: 'Your tool', lines: ['Pick your tool.', 'Get the fix shaped for it.'] as const },
  kinds: { builder: 'App builder', agent: 'Coding agent' },
  open: (name: string) => `FixFlags for ${name}`,
  loopHeader: { label: 'The loop', lines: ['Check. Flag. Fix. Verify.', 'The same in every tool.'] as const },
  loop: [
    { label: PRODUCT_STORY.loop[0], title: 'Check the live site', body: 'Paste your published URL. No install, no signup to start.' },
    { label: PRODUCT_STORY.loop[1], title: 'See what’s broken', body: 'Each Flag shows the page, what happened, what should happen, and the evidence.' },
    { label: PRODUCT_STORY.loop[2], title: 'Hand your AI the fix', body: 'Copy the fix instructions into the tool you build with. Review the change and publish.' },
    { label: PRODUCT_STORY.loop[3], title: 'Prove it worked', body: 'Select Recheck. FixFlags checks the same page and action on the live site.' },
  ],
  why: {
    label: 'Independent', lines: ['An independent check.', 'Not the tool grading itself.'] as const,
    body: 'The tool that made a change should not certify it. Builders test the preview before publish. FixFlags checks production after, and keeps the before and after with the Flag.',
  },
  tool: {
    back: 'All AI tools',
    label: (name: string) => `FixFlags for ${name}`,
    title: (name: string) => `Find what’s broken. Hand ${name} the fix.`,
    titleLines: (name: string) => ['Find what’s broken.', `Hand ${name} the fix.`] as const,
    stepsTitle: 'How it works',
    steps: (tool: AiBuilderTool) => [
      { title: 'Check your live site', body: 'Paste your published URL into FixFlags. Nothing to install, and no signup to start.' },
      { title: 'Open a Flag and copy the fix', body: 'Each Flag shows what happened, what should happen, and the evidence. Copy its fix instructions.' },
      { title: `Paste it into ${tool.name}`, body: tool.where },
      { title: 'Publish, then prove it', body: `${tool.publish} Then select Recheck in FixFlags to check the same page and action again.` },
    ],
    exampleTitle: 'Example fix instructions',
    exampleNote: 'Sample Flag. Your instructions come from your own check.',
    copy: 'Copy example',
    copied: 'Example copied.',
    tipTitle: 'Tip',
    cta: 'Check your website',
    other: 'Other tools',
  },
  seo: {
    title: 'FixFlags for AI builders | Lovable, Bolt, v0, Replit, Cursor, Claude Code',
    description: 'Check the live site your AI tool built, copy fix instructions into Lovable, Bolt, v0, Replit, Cursor or Claude Code, and recheck to prove the fix worked.',
    tool: (name: string) => ({
      title: `FixFlags for ${name} | Check your live site and hand ${name} the fix`,
      description: `Check the site you built with ${name} in a real browser, paste fix instructions into ${name}, and recheck the live site to prove the fix worked.`,
    }),
  },
} as const
