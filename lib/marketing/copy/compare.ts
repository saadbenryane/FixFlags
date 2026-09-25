/**
 * Owner revision 2026-09-24.
 * Cells are phrases. A speed score and an agent must not add up to FixFlags.
 * Shared by the Care homepage and pricing through MarketingCompareSection.
 */
export const SITE_COMPARE = {
  label: "Compare",
  headlineDisplay: "A score and a prompt still leave it unwatched",
  headlineAccentPeriod: true,
  headline: "A score and a prompt still leave it unwatched.",
  subline:
    "PageSpeed times a page. An agent answers what you remember to ask. Use both, and the live site is still waiting for you to look. FixFlags keeps watch and proves a fix with a fresh check.",
  columns: [
    { id: "psi", label: "PageSpeed Insights" },
    { id: "agent", label: "An agent you ask" },
    { id: "fixflags", label: "FixFlags", highlight: true },
  ] as const,
  rows: [
    {
      id: "speed",
      question: "Is this page slow right now?",
      values: {
        psi: "A lab score for that URL",
        agent: "Only if you ask, and it may guess",
        fixflags: "Measured on the live site",
      },
    },
    {
      id: "tomorrow",
      question: "Will you know if checkout breaks next week?",
      values: {
        psi: "Only if someone runs it again",
        agent: "Only if someone asks again",
        fixflags: "Watch raises a Flag",
      },
    },
    {
      id: "fixed",
      question: "Who decides the fix worked?",
      values: {
        psi: "A new score does not retry the purchase",
        agent: "Often the same agent that made the change",
        fixflags: "A fresh, independent check",
      },
    },
    {
      id: "proof",
      question: "Where does the proof stay?",
      values: {
        psi: "A report from that run",
        agent: "A chat that moves on",
        fixflags: "The Site, the page, and the Flag",
      },
    },
    {
      id: "ask",
      question: "What if you never ask the right question?",
      values: {
        psi: "You opened one tool for one URL",
        agent: "Nothing runs until you write the prompt",
        fixflags: "It watches the outcome anyway",
      },
    },
  ] as const,
} as const;
