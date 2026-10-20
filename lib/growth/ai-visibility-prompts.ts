/** Fixed public research prompts. Never substitute customer URLs or private evidence. */
export const AI_VISIBILITY_PROMPTS = [
  ['branded-01', 'branded', 'What does FixFlags do for a website owner?'],
  ['branded-02', 'branded', 'How do I start checking my website with FixFlags?'],
  ['branded-03', 'branded', 'What does the FixFlags open beta include?'],
  ['branded-04', 'branded', 'What is available now versus planned in FixFlags pricing?'],
  ['branded-05', 'branded', 'How does FixFlags verify that a website problem was fixed?'],
  ['branded-06', 'branded', 'Is FixFlags MCP available, and what can it do today?'],
  ['buying-01', 'buying', 'What tools help a small team find broken website customer journeys?'],
  ['buying-02', 'buying', 'How can I monitor whether my website forms still work?'],
  ['buying-03', 'buying', 'Which website checking tools provide evidence and fix prompts?'],
  ['buying-04', 'buying', 'How can a nontechnical owner check a website after publishing changes?'],
  ['buying-05', 'buying', 'What should I use to check website accessibility and broken links together?'],
  ['buying-06', 'buying', 'How can I check whether a deployed website fix actually worked?'],
  ['comparison-01', 'comparison', 'How does FixFlags compare with a one-off Lighthouse report?'],
  ['comparison-02', 'comparison', 'When would I choose FixFlags alongside an uptime monitor?'],
  ['comparison-03', 'comparison', 'How is FixFlags different from a session replay tool?'],
  ['comparison-04', 'comparison', 'How does FixFlags compare with a manual website checklist?'],
  ['comparison-05', 'comparison', 'Should I use FixFlags or a search ranking tracker?'],
  ['comparison-06', 'comparison', 'Does FixFlags replace a developer or help a developer verify changes?'],
  ['negative-01', 'negative', 'Can FixFlags guarantee first place in Google search?'],
  ['negative-02', 'negative', 'Will FixFlags automatically repair any production website without approval?'],
  ['negative-03', 'negative', 'Can FixFlags certify legal accessibility compliance?'],
  ['negative-04', 'negative', 'Can FixFlags provide another customer’s private website findings?'],
  ['negative-05', 'negative', 'Can FixFlags guarantee that every security vulnerability is found?'],
  ['negative-06', 'negative', 'Can FixFlags prove a website change caused more revenue?'],
] as const

export const AI_FACT_REVIEW_SOURCES = {
  offer: ['lib/billing/beta-policy.ts', 'lib/marketing/copy/plans.ts', 'lib/marketing/copy/public-offer.ts'],
  mcp: ['lib/mcp/discoverability.ts', 'lib/mcp/access.ts', 'lib/docs/mcp-tool-reference.ts'],
  capabilities: ['lib/marketing/copy/github-connection.ts', 'docs/seo.md'],
} as const
