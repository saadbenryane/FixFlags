export const TOOL_EDUCATION = {
  'meta-preview': {
    title: 'Read the preview before you share the link',
    sections: [
      { title: 'What this tool checks', body: 'See the image, title, and description your page provides for shared links. A missing image or title is worth fixing before you share the page.' },
      { title: 'What if the image is missing?', body: 'Add a link-preview image where you manage your website’s page settings, or ask for help adding one. Publish the update, then check the same page again. The image itself needs to be available on the public web.' },
      { title: 'Why does a social app show the old image?', body: 'Social apps can keep an older copy of your preview. They also choose how to crop and display it. If your update is live but the old image remains, try that app’s own link-preview tool.' },
      { title: 'What else should I check?', body: 'A good link preview does not tell you whether your pages load quickly or your buttons work. If we can’t open the page, we can’t check its preview. Try the full website check to look for other problems.' },
    ],
    links: [
      { href: '/guides/checking-after-publishing', label: 'Check the published website' },
      { href: '/tools/placeholder-detector', label: 'Check for unfinished copy' },
      { href: '/coverage#search', label: 'Understand search coverage' },
    ],
  },
  'broken-links': {
    title: 'Fix the links that lead nowhere',
    sections: [
      { title: 'What this tool checks', body: 'We open your page, collect links to other pages on the same site, and request each one. A link is broken when it returns an error such as 404 or 500, or does not respond.' },
      { title: 'Why some links are not checked', body: 'One free check covers the first 40 links on the page. Links to other websites, email links and phone links are not checked.' },
      { title: 'What should I do with a broken link?', body: 'Restore the missing page, point the link at the right page, or remove it. Publish the update, then check the page again.' },
      { title: 'Do working links mean the page works?', body: 'No. A link can open while the button next to it fails. The full website check tries buttons, forms and key pages, and gives you fix instructions for your AI tool.' },
    ],
    links: [
      { href: '/guides/checking-after-publishing', label: 'Check the published website' },
      { href: '/tools/meta-preview', label: 'Check the link preview' },
      { href: '/ai-builders', label: 'Fix it with your AI tool' },
    ],
  },
  'placeholder-detector': {
    title: 'Find the unfinished text you missed',
    sections: [
      { title: 'What this tool looks for', body: 'Find leftover sample text such as Lorem ipsum, unfinished headings, and template names on a public page. We show each match so you can decide whether it belongs there. This tool cannot tell who wrote the text.' },
      { title: 'A match is not always a defect', body: 'A page explaining Lorem ipsum or showing a TODO example contains those phrases intentionally. Read each match in context. Check unfinished headlines and company-name tokens with particular care.' },
      { title: 'What should I do with a match?', body: 'If a page still says Your company name, replace it with your name where you built the website. Publish the update and check again. Read the surrounding text and check its links too.' },
      { title: 'Does no matches mean all my copy is ready?', body: 'It means we didn’t find the patterns this tool looks for on the page we could read. Give important pages a read yourself. Use the full website check to look for broken pages, slow loading, and other problems.' },
    ],
    links: [
      { href: '/guides/monitoring-ai-built-websites', label: 'Look after an AI-built website' },
      { href: '/tools/meta-preview', label: 'Check the link preview' },
      { href: '/how-it-works#sample', label: 'Try the sample and copy a fix' },
    ],
  },
} as const
