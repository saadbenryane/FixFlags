/**
 * Locked 2026-09-06 — Saad.
 * Webmaster checklist vs PageSpeed Insights vs an agent/skill.
 * Homepage + pricing. No uptime / Can AI find me claims.
 */
export const SITE_COMPARE = {
  label: "Compare",
  headlineDisplay: "What your site should answer",
  headlineAccentPeriod: true,
  headline: "What your site should answer.",
  subline:
    "PageSpeed answers speed. An agent answers once. FixFlags answers the webmaster checklist with fixes.",
  columns: [
    { id: "psi", label: "PageSpeed Insights" },
    { id: "agent", label: "An agent / skill" },
    { id: "fixflags", label: "FixFlags", highlight: true },
  ] as const,
  rows: [
    {
      id: "seo",
      question: "Is my SEO good?",
      values: { psi: false, agent: false, fixflags: true },
    },
    {
      id: "broken-links",
      question: "Do I have broken links?",
      values: { psi: false, agent: false, fixflags: true },
    },
    {
      id: "load-fast",
      question: "Does the page load fast?",
      values: { psi: true, agent: false, fixflags: true },
    },
    {
      id: "mobile",
      question: "Does it work on mobile?",
      values: { psi: false, agent: false, fixflags: true },
    },
    {
      id: "funnel",
      question: "Is my funnel converting?",
      tooltip:
        "CTA clear, path to signup/buy not dead, trust and friction on the way.",
      values: { psi: false, agent: false, fixflags: true },
    },
    {
      id: "share",
      question: "Will my link look right when shared?",
      values: { psi: false, agent: false, fixflags: true },
    },
    {
      id: "fix-prompts",
      question: "Fix prompts for Cursor / Lovable / Claude",
      values: { psi: false, agent: false, fixflags: true },
    },
  ] as const,
} as const;
