export const TOOL_EDUCATION = {
  'meta-preview': {
    title: 'Read the preview before you share the link',
    sections: [
      { title: 'What this tool checks', body: 'The tool reads the page response and its title, description, Open Graph and Twitter card metadata. It shows a representative social preview and the values it found. A missing image or title is something to inspect before you share an important page.' },
      { title: 'A useful way to fix a missing image', body: 'For example, a page might have a title but no og:image. Add an absolute public image URL to the page metadata, publish the change, and check that same page again. Also open the image URL directly. A tag being present does not establish that the image loads in every sharing service.' },
      { title: 'Why a social app can still show an older card', body: 'Sharing services cache previews and choose their own presentation. Their cached image, crop, and text can differ from this representative preview. Check the platform’s own preview or debugging tools if the new metadata is live but the old card remains.' },
      { title: 'What a successful result leaves unverified', body: 'This is a metadata inspection of one public URL. It does not establish search indexing, rankings, AI citations, page performance, or whether a visitor can finish an action. A blocked or failed fetch is an unavailable inspection, not a clean page. Use the broader website check when you need supported evidence beyond these tags.' },
    ],
    links: [
      { href: '/guides/checking-after-publishing', label: 'Check the published website' },
      { href: '/tools/placeholder-detector', label: 'Check for unfinished copy' },
      { href: '/coverage#search', label: 'Understand search coverage' },
    ],
  },
  'placeholder-detector': {
    title: 'Use matches as review prompts',
    sections: [
      { title: 'What this tool looks for', body: 'The detector looks for known placeholder patterns, unfinished template text, and unreplaced tokens in a fetched public page. It provides the matching text and context so you can decide whether the content belongs there. It does not establish who wrote the page or whether AI generated it.' },
      { title: 'A match is not always a defect', body: 'A documentation page explaining Lorem ipsum or showing a TODO code example may legitimately contain a matched phrase. Read the context before editing it. A match in your customer-facing headline or an unreplaced company-name token is more likely to need attention than the same text in a teaching example.' },
      { title: 'A practical follow-up', body: 'Suppose a controlled example page still says Your company name in a contact section. Replace the token with the intended public name, publish the edit, and inspect the same URL again. Check the surrounding sentence and destination link as well. Removing a token does not prove that the contact form sends a message.' },
      { title: 'What no matches means', body: 'No matches means the retrieved page did not contain a pattern this detector recognized. It is not a guarantee that all copy is finished, correct, or trustworthy. Content that the fetch cannot retrieve remains outside this inspection. Check important pages yourself and use a broader website analysis for supported page and interaction evidence.' },
    ],
    links: [
      { href: '/guides/monitoring-ai-built-websites', label: 'Look after an AI-built website' },
      { href: '/tools/meta-preview', label: 'Check the link preview' },
      { href: '/samples', label: 'Explore evidence and fix guidance' },
    ],
  },
} as const
